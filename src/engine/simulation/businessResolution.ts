import type { Rng } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { clamp } from "../util/math.js";
import {
  adjustHeadcount,
  computePayrollCost,
  computeStaffingRatio,
  computeWorkforceCapacityHours,
} from "../employees/employees.js";
import { computeMonthlyFinancials } from "../business/accounting.js";
import { applyMonthlyCashFlow, computeMonthlyInterest, injectCapital, type FinancingOutcome } from "../business/treasury.js";
import {
  applyMortgagePayment,
  computeMortgagePayment,
  computeTotalMaintenance,
  evaluateFinancingEligibility,
  purchaseProperty,
} from "../business/realEstate.js";
import { createOffer, developOffer, launchOffer, updateOfferPricing } from "../business/offer.js";
import { computeServiceMonth } from "../economic-models/service.js";
import { computeHospitalityMonth } from "../economic-models/hospitality.js";
import { computeSubscriptionMonth } from "../economic-models/subscription.js";
import { RetailEngine } from "../economic-models/retail.js";
import { AgencyEngine } from "../economic-models/agency.js";
import { createBusiness } from "../business/treasury.js";
import { createWorkforce } from "../employees/employees.js";
import type { MonthlyFinancialStatement } from "../../types/business.js";
import type { OwnedProperty } from "../../types/realEstate.js";
import type { Offer, OfferAction } from "../../types/offer.js";
import type { BusinessAction, BusinessFamilyState, CreateBusinessSpec, OwnedBusiness } from "./types.js";

const INITIAL_REPUTATION_SCORE = 0.1;

/** Crée une nouvelle entreprise possédée à partir d'une spécification de création (spec §3). */
export function createOwnedBusiness(id: string, spec: CreateBusinessSpec): OwnedBusiness {
  const business = createBusiness(spec.name, [spec.family], {
    creditLineLimit: spec.creditLineLimit,
    creditLineInterestRateAnnual: spec.creditLineInterestRateAnnual,
  });
  const workforce = createWorkforce(spec.averageMonthlySalary);

  let familyState: BusinessFamilyState;
  switch (spec.family) {
    case "service":
      familyState = { family: "service", reputationScore: INITIAL_REPUTATION_SCORE, costPerLaborHour: spec.costPerLaborHour };
      break;
    case "hospitality":
      familyState = { family: "hospitality", reputationScore: INITIAL_REPUTATION_SCORE, foodCostPerCover: spec.foodCostPerCover };
      break;
    case "subscription":
      familyState = {
        family: "subscription",
        activeSubscribers: spec.initialActiveSubscribers,
        arpu: spec.arpu,
        churnRateBase: spec.churnRateBase,
        cogsRatio: spec.cogsRatio,
      };
      break;
    case "retail":
      familyState = { family: "retail", reputationScore: INITIAL_REPUTATION_SCORE, unitCostOfGoods: spec.unitCostOfGoods };
      break;
    case "agency":
      familyState = {
        family: "agency",
        reputationScore: INITIAL_REPUTATION_SCORE,
        averageMonthlyFeePerMandate: spec.averageMonthlyFeePerMandate,
        deliveryCostRatio: spec.deliveryCostRatio,
      };
      break;
  }

  return { id, business, workforce, marketId: spec.marketId, familyState, saleProcess: null };
}

/** Taux d'imposition standard appliqué en P0 (simplification : pas de barème progressif). */
const TAX_RATE = 0.25;

/** Heures de main-d'œuvre nécessaires pour servir un couvert (Hospitality). */
const LABOR_HOURS_PER_COVER = 0.5;

/** Abonnés supportables par un équivalent temps plein support/succès client (Subscription). */
const SUBSCRIBERS_PER_SUPPORT_HEADCOUNT = 500;
/** Majoration maximale du churn en cas de sous-effectif support total (staffingRatio -> 0). */
const MAX_UNDERSTAFFING_CHURN_PENALTY = 1.0;
/** Heures de main-d'œuvre nécessaires pour traiter la vente d'une unité (Retail, ex. caisse/conseil). */
const LABOR_HOURS_PER_UNIT_SOLD = 0.25;
/** Heures de main-d'œuvre nécessaires pour livrer un mandat par mois (Agency). */
const LABOR_HOURS_PER_MANDATE = 15;

export interface ResolvedBusinessMonth {
  readonly updated: OwnedBusiness;
  readonly statement: MonthlyFinancialStatement;
  readonly outcome: FinancingOutcome;
  readonly hired: number;
  readonly fired: number;
  readonly recruitmentCost: number;
  readonly severanceCost: number;
}

/**
 * Applique les actions du joueur sur les offres de l'entreprise ce mois-ci
 * (spec M11.2 §3.3), dans l'ordre fourni. Le coût de développement cumulé
 * (`developmentSpend`) rejoint la ligne `admin` du compte de résultat —
 * même mécanisme que la maintenance immobilière (M11.1.5 §4.3) : aucun
 * nouveau champ de `MonthlyFinancialStatement`, protégé automatiquement
 * par la cascade d'insolvabilité déjà existante.
 */
function applyOfferActions(
  offers: readonly Offer[],
  actions: readonly OfferAction[],
  date: GameDate,
): { readonly offers: readonly Offer[]; readonly developmentSpend: number } {
  let result = offers;
  let developmentSpend = 0;
  for (const action of actions) {
    switch (action.kind) {
      case "create": {
        result = [...result, createOffer(action.spec, date)];
        break;
      }
      case "develop": {
        const index = result.findIndex((offer) => offer.id === action.offerId);
        if (index === -1) {
          throw new RangeError(`resolveBusinessMonth: offre "${action.offerId}" introuvable pour le développement.`);
        }
        result = result.map((offer, i) => (i === index ? developOffer(offer, action.hours, action.budget) : offer));
        developmentSpend += action.budget;
        break;
      }
      case "launch": {
        const index = result.findIndex((offer) => offer.id === action.offerId);
        if (index === -1) {
          throw new RangeError(`resolveBusinessMonth: offre "${action.offerId}" introuvable pour le lancement.`);
        }
        result = result.map((offer, i) => (i === index ? launchOffer(offer, date) : offer));
        break;
      }
      case "update-pricing": {
        const index = result.findIndex((offer) => offer.id === action.offerId);
        if (index === -1) {
          throw new RangeError(`resolveBusinessMonth: offre "${action.offerId}" introuvable pour la mise à jour du prix.`);
        }
        result = result.map((offer, i) => (i === index ? updateOfferPricing(offer, action.price, action.positioning) : offer));
        break;
      }
    }
  }
  return { offers: result, developmentSpend };
}

function requireFamilyState<TFamily extends BusinessFamilyState["family"]>(
  familyState: BusinessFamilyState,
  family: TFamily,
): Extract<BusinessFamilyState, { family: TFamily }> {
  if (familyState.family !== family) {
    throw new RangeError(
      `resolveBusinessMonth: décisions de famille "${family}" fournies pour une entreprise "${familyState.family}".`,
    );
  }
  return familyState as Extract<BusinessFamilyState, { family: TFamily }>;
}

/**
 * Résout le mois d'une entreprise : effectifs -> production économique
 * (moteur pur de la famille) -> comptabilité -> trésorerie. Toutes les
 * familles partagent la même mécanique de fond ; seule la traduction
 * effectif/temps -> capacité et le moteur économique appelé diffèrent.
 */
export function resolveBusinessMonth(
  owned: OwnedBusiness,
  action: BusinessAction,
  demandShare: number,
  founderLeadershipSkill: number,
  rng: Rng,
  date: GameDate,
): ResolvedBusinessMonth {
  if (!action.decisions) {
    throw new RangeError(`resolveBusinessMonth: businessId="${action.businessId}" nécessite des décisions ce mois-ci.`);
  }

  const headcountResult =
    action.targetHeadcount !== undefined
      ? adjustHeadcount(owned.workforce, action.targetHeadcount)
      : { workforce: owned.workforce, hired: 0, fired: 0, recruitmentCost: 0, severanceCost: 0 };

  let familyState: BusinessFamilyState = owned.familyState;
  let revenue: number;
  let variableCosts: number;

  switch (action.decisions.family) {
    case "service": {
      const state = requireFamilyState(owned.familyState, "service");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      const contribution = computeServiceMonth(
        { hourlyRate: action.decisions.price, costPerLaborHour: state.costPerLaborHour, reputationScore: state.reputationScore },
        { capacityHours, targetHours: action.decisions.targetHours * demandShare },
        { rng: rng.fork(`business:${owned.id}:service`) },
      );
      revenue = contribution.revenue;
      variableCosts = contribution.variableCosts;
      familyState = { ...state, reputationScore: clamp(state.reputationScore + contribution.hoursSold * 0.0005, 0, 1) };
      break;
    }
    case "hospitality": {
      const state = requireFamilyState(owned.familyState, "hospitality");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      const coversCapacity = capacityHours / LABOR_HOURS_PER_COVER;
      const contribution = computeHospitalityMonth(
        {
          averageTicketPrice: action.decisions.averageTicketPrice,
          foodCostPerCover: state.foodCostPerCover,
          reputationScore: state.reputationScore,
        },
        { coversCapacity, expectedDemandCovers: action.decisions.expectedDemandCovers * demandShare },
        { rng: rng.fork(`business:${owned.id}:hospitality`) },
      );
      revenue = contribution.revenue;
      variableCosts = contribution.variableCosts;
      familyState = { ...state, reputationScore: clamp(state.reputationScore + contribution.coversServed * 0.0002, 0, 1) };
      break;
    }
    case "subscription": {
      const state = requireFamilyState(owned.familyState, "subscription");
      const requiredHeadcount = state.activeSubscribers / SUBSCRIBERS_PER_SUPPORT_HEADCOUNT;
      const staffingRatio = computeStaffingRatio(headcountResult.workforce.headcount, requiredHeadcount);
      const understaffingPenalty =
        staffingRatio < 1 ? (1 - staffingRatio) * MAX_UNDERSTAFFING_CHURN_PENALTY : 0;
      const effectiveChurnRate = clamp(state.churnRateBase * (1 + understaffingPenalty), 0, 1);
      const contribution = computeSubscriptionMonth(
        { activeSubscribers: state.activeSubscribers, arpu: state.arpu, churnRate: effectiveChurnRate, cogsRatio: state.cogsRatio },
        { newSubscribers: action.decisions.newSubscribers * demandShare },
        { rng: rng.fork(`business:${owned.id}:subscription`) },
      );
      revenue = contribution.revenue;
      variableCosts = contribution.variableCosts;
      familyState = { ...state, activeSubscribers: contribution.endingSubscribers };
      break;
    }
    case "retail": {
      const state = requireFamilyState(owned.familyState, "retail");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      const laborCapacityUnits = capacityHours / LABOR_HOURS_PER_UNIT_SOLD;
      const contribution = RetailEngine.computeMonth(
        { unitPrice: action.decisions.unitPrice, unitCostOfGoods: state.unitCostOfGoods, reputationScore: state.reputationScore },
        {
          stockUnits: Math.min(action.decisions.stockUnits, laborCapacityUnits),
          expectedFootTraffic: action.decisions.expectedFootTraffic * demandShare,
        },
        { rng: rng.fork(`business:${owned.id}:retail`) },
      );
      revenue = contribution.revenue;
      variableCosts = contribution.variableCosts;
      familyState = { ...state, reputationScore: clamp(state.reputationScore + contribution.unitsSold * 0.0003, 0, 1) };
      break;
    }
    case "agency": {
      const state = requireFamilyState(owned.familyState, "agency");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      const capacityMandates = capacityHours / LABOR_HOURS_PER_MANDATE;
      const contribution = AgencyEngine.computeMonth(
        {
          averageMonthlyFeePerMandate: state.averageMonthlyFeePerMandate,
          deliveryCostRatio: state.deliveryCostRatio,
          reputationScore: state.reputationScore,
          skillFactor: clamp(founderLeadershipSkill / 100, 0, 1),
        },
        { capacityMandates, targetMandates: action.decisions.targetMandates * demandShare },
        { rng: rng.fork(`business:${owned.id}:agency`) },
      );
      revenue = contribution.revenue;
      variableCosts = contribution.variableCosts;
      familyState = { ...state, reputationScore: clamp(state.reputationScore + contribution.wonMandates * 0.001, 0, 1) };
      break;
    }
  }

  // Immobilier (spec M11.1.5 §4.3) : mensualités des emprunts existants
  // appliquées chaque mois, avant tout achat éventuel ce mois-ci (un bien
  // acheté ce mois-ci ne paie pas encore de mensualité).
  const mortgagePayments = owned.business.properties.map((property) =>
    property.mortgage ? { property, payment: applyMortgagePayment(property.mortgage) } : { property, payment: null },
  );
  const propertiesAfterPayments: OwnedProperty[] = mortgagePayments.map(({ property, payment }) =>
    payment ? { ...property, mortgage: payment.mortgage } : property,
  );
  const totalMortgageInterest = mortgagePayments.reduce((sum, { payment }) => sum + (payment?.interestPortion ?? 0), 0);
  const totalMortgagePrincipal = mortgagePayments.reduce((sum, { payment }) => sum + (payment?.principalPortion ?? 0), 0);
  const totalMaintenance = computeTotalMaintenance(propertiesAfterPayments);

  // Offres (spec M11.2 §3.3) : appliquées avant la comptabilité pour que le
  // coût de développement de ce mois-ci apparaisse dans les charges de CE
  // mois-ci, comme la maintenance immobilière.
  const { offers: offersAfterActions, developmentSpend } = applyOfferActions(
    owned.business.offers,
    action.offerActions ?? [],
    date,
  );

  const interest = computeMonthlyInterest(owned.business.treasury.creditLine) + totalMortgageInterest;
  const statement = computeMonthlyFinancials({
    revenue,
    variableCosts,
    payroll: computePayrollCost(headcountResult.workforce),
    marketing: action.marketingBudget,
    rent: action.rentBudget,
    admin:
      action.adminBudget + headcountResult.recruitmentCost + headcountResult.severanceCost + totalMaintenance + developmentSpend,
    depreciation: 0,
    interest,
    taxRate: TAX_RATE,
    // Le remboursement du principal immobilier est un mouvement de bilan
    // (comme un remboursement de ligne de crédit), pas une charge P&L —
    // regroupé avec le CAPEX, seul autre poste de cash-flow non-P&L du modèle.
    capex: (action.capex ?? 0) + totalMortgagePrincipal,
    workingCapitalChange: 0,
  });

  const businessWithPropertyPayments = { ...owned.business, properties: propertiesAfterPayments, offers: offersAfterActions };

  let businessBeforeCashFlow =
    action.capitalInjection && action.capitalInjection > 0
      ? injectCapital(businessWithPropertyPayments, action.capitalInjection)
      : businessWithPropertyPayments;

  if (action.propertyPurchase) {
    const spec = action.propertyPurchase;
    const businessWithDownPayment = injectCapital(businessBeforeCashFlow, spec.downPaymentFromPersonalCash);
    const mortgagePrincipal = spec.purchasePrice - spec.downPaymentFromPersonalCash;
    const monthlyPayment = mortgagePrincipal > 0 ? computeMortgagePayment(mortgagePrincipal, spec.mortgageRateAnnual, spec.mortgageTermMonths) : 0;
    const eligibility = evaluateFinancingEligibility({
      downPayment: spec.downPaymentFromPersonalCash,
      availableCash: businessWithDownPayment.treasury.cash,
      monthlyPayment,
      lastStatementEbitda: owned.lastStatement?.ebitda ?? null,
    });
    if (!eligibility.approved) {
      throw new RangeError(`resolveBusinessMonth: achat immobilier refusé pour "${owned.business.name}" — ${eligibility.reason}`);
    }
    const { business: businessAfterPurchase } = purchaseProperty(
      businessWithDownPayment,
      spec,
      `${owned.id}-property-${businessWithDownPayment.properties.length}`,
    );
    businessBeforeCashFlow = businessAfterPurchase;
  }

  const { business, outcome } = applyMonthlyCashFlow(businessBeforeCashFlow, statement);

  return {
    updated: { ...owned, business, workforce: headcountResult.workforce, familyState, lastStatement: statement },
    statement,
    outcome,
    hired: headcountResult.hired,
    fired: headcountResult.fired,
    recruitmentCost: headcountResult.recruitmentCost,
    severanceCost: headcountResult.severanceCost,
  };
}
