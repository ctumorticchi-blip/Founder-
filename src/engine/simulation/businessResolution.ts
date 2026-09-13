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
import { getMarketSegments } from "../market/segments.js";
import { computeOfferDemand } from "../market/demand.js";
import { computeSegmentExpectation } from "../customer/expectations.js";
import { computeDeliveredExperience, computeOperationalPenalty } from "../customer/experience.js";
import { computeSatisfaction } from "../customer/satisfaction.js";
import {
  computeRepeatDemand,
  computeReputationUpdate,
  computeSubscriptionChurnAdjustment,
  computeWordOfMouth,
  updateSegmentMemory,
} from "../customer/retention.js";
import {
  allocateContractOutcomes,
  computeContractedVolumeForOffer,
  computeContractualCapacityAllocation,
  computeContractualDemandAdjustment,
  wonOpportunitiesForOffer,
  type ContractOutcome,
} from "../business/strategicAccounts.js";
import { computeAccountRelationshipUpdate } from "../business/accountRelationship.js";
import type { MonthlyFinancialStatement, EconomicFamily } from "../../types/business.js";
import type { OwnedProperty } from "../../types/realEstate.js";
import type { Offer, OfferAction } from "../../types/offer.js";
import type { DemandFunnelResult } from "../../types/demand.js";
import type { CustomerSegment } from "../../types/customerSegment.js";
import type { SegmentCustomerMemory } from "../../types/satisfaction.js";
import type { Market } from "../../types/market.js";
import type { StrategicAccountOpportunity } from "../../types/strategicAccount.js";
import type { BusinessAction, BusinessFamilyState, CreateBusinessSpec, OwnedBusiness } from "./types.js";

export const INITIAL_REPUTATION_SCORE = 0.1;

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
        reputationScore: INITIAL_REPUTATION_SCORE,
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

  return {
    id,
    business,
    workforce,
    marketId: spec.marketId,
    familyState,
    saleProcess: null,
    strategicAccounts: [],
    strategicAccountOpportunities: [],
  };
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

/**
 * Volume mensuel (unité native de la famille) au-delà duquel un mois pèse
 * "pleinement" sur la réputation/le bouche-à-oreille (spec M11.2.3 §9,
 * §10) — calibré sur l'ordre de grandeur des marchés de démonstration
 * (`src/scenarios/markets.ts`). Subscription n'a pas de valeur fixe : voir
 * `subscriptionReferenceVolume`.
 */
const FAMILY_REFERENCE_VOLUME: Readonly<Record<Exclude<EconomicFamily, "subscription">, number>> = {
  service: 200,
  hospitality: 600,
  retail: 400,
  agency: 6,
};

/** Plancher de volume de référence pour Subscription (spec §9) : une base naissante ne doit pas rendre le seuil nul. */
const SUBSCRIPTION_REFERENCE_VOLUME_FLOOR = 50;

/**
 * Volume de référence utilisé pour le bouche-à-oreille/la réputation d'une
 * famille (spec §9, §10) — exporté pour que l'écran puisse reproduire
 * EXACTEMENT le même calcul que celui utilisé en interne (via
 * `computeWordOfMouth`) pour afficher un signal qualitatif honnête, sans
 * dupliquer ni réinventer le calibrage (spec §13, §15 : aucun coefficient
 * interne inventé côté web).
 */
export function wordOfMouthReferenceVolume(family: EconomicFamily, activeSubscribers?: number): number {
  if (family === "subscription") {
    return Math.max(activeSubscribers ?? 0, SUBSCRIPTION_REFERENCE_VOLUME_FLOOR);
  }
  return FAMILY_REFERENCE_VOLUME[family];
}

/** Moyenne pondérée par le volume ; `50` (neutre) si le volume total est nul (spec §6.2 : aucune mémoire -> aucun effet). */
function volumeWeightedSatisfaction(entries: readonly { readonly value: number; readonly weight: number }[]): number {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) return 50;
  return entries.reduce((sum, e) => sum + e.value * e.weight, 0) / totalWeight;
}

/** Entrées bouche-à-oreille agrégées depuis la mémoire (spec §6.2) : satisfaction lissée pondérée + volume lissé total. */
function aggregateWordOfMouthInputs(memory: readonly SegmentCustomerMemory[]): { readonly satisfaction: number; readonly volume: number } {
  const volume = memory.reduce((sum, m) => sum + m.retainedBaseVolume, 0);
  const satisfaction = volumeWeightedSatisfaction(memory.map((m) => ({ value: m.smoothedSatisfactionScore, weight: m.retainedBaseVolume })));
  return { satisfaction, volume };
}

interface OfferOutcome {
  readonly updatedMemory: readonly SegmentCustomerMemory[];
  readonly volumeForReputation: number;
  readonly satisfactionForReputation: number;
}

/** Aucune mécanique de repeat demand transactionnel pour Subscription (spec M11.2.3.1 §8, §12) — réutilisée telle quelle, jamais recréée par appel. */
const EMPTY_REPEAT_DEMAND: ReadonlyMap<string, number> = new Map();

/** Demande de réachat par segment, calculée depuis la mémoire PRÉALABLE de l'offre (spec M11.2.3.1 §2-§3). `Map` vide pour une famille sans mécanique de repeat demand (Subscription, spec §12). */
function computeRepeatDemandBySegment(customerMemory: readonly SegmentCustomerMemory[]): ReadonlyMap<string, number> {
  return new Map(customerMemory.map((m) => [m.segmentId, computeRepeatDemand(m)]));
}

/**
 * Demande totale (nouvelle + récurrente) d'une offre ce mois-ci (spec
 * M11.2.3.1 §1, §3) : `newDemand` vient de `computeOfferDemand` (M11.2.2,
 * inchangé), `repeatDemand` de la mémoire client préalable. C'est cette
 * somme — jamais `funnel.demand` seul — qui doit désormais être opposée à
 * la capacité de la famille.
 */
function computeTotalDemand(
  funnel: Omit<DemandFunnelResult, "capacity" | "sales" | "lostToCapacity">,
  repeatDemandBySegment: ReadonlyMap<string, number>,
): number {
  return funnel.bySegment.reduce((sum, s) => sum + s.demand + (repeatDemandBySegment.get(s.segmentId) ?? 0), 0);
}

/**
 * Ventile les ventes réelles ET les ventes perdues d'une offre entre
 * segments, puis entre clients nouveaux/récurrents au sein de chaque
 * segment — allocation proportionnelle pure, aucune priorité cachée entre
 * nouveaux et habitués (spec M11.2.3.1 §3, §6). Jamais de resimulation du
 * moteur économique : `totalSales`/`totalLostToCapacity` sont déjà
 * entièrement déterminés par l'appelant. Met à jour la mémoire client de
 * chaque segment avec des FLUX RÉELS (spec §7, §9) — plus de
 * reclassification après coup. `deliveredExperience`/`operationalPenalty`
 * sont déjà calculées par l'appelant (la pression opérationnelle diffère
 * selon la famille — spec M11.2.3 §4). La satisfaction reste calculée
 * UNIQUEMENT sur les clients réellement servis (spec §10) — jamais sur la
 * demande récurrente refusée.
 */
function resolveOfferOutcome(
  offer: Offer,
  segments: readonly CustomerSegment[],
  funnel: Omit<DemandFunnelResult, "capacity" | "sales" | "lostToCapacity">,
  repeatDemandBySegment: ReadonlyMap<string, number>,
  deliveredExperience: number,
  operationalPenalty: number,
  totalSales: number,
  totalLostToCapacity: number,
  reputationScore: number,
): OfferOutcome {
  const segmentById = new Map(segments.map((s) => [s.id, s]));
  const priorMemoryById = new Map(offer.customerMemory.map((m) => [m.segmentId, m]));
  const totalDemand = computeTotalDemand(funnel, repeatDemandBySegment);

  const satisfactionEntries: { value: number; weight: number }[] = [];

  const updatedMemory: SegmentCustomerMemory[] = funnel.bySegment.map((seg) => {
    const newDemandForSegment = seg.demand;
    const repeatDemandForSegment = repeatDemandBySegment.get(seg.segmentId) ?? 0;
    const segmentTotalDemand = newDemandForSegment + repeatDemandForSegment;

    const share = totalDemand > 0 ? segmentTotalDemand / totalDemand : 0;
    const segmentSales = totalSales * share;
    const segmentLost = totalLostToCapacity * share;
    const newShare = segmentTotalDemand > 0 ? newDemandForSegment / segmentTotalDemand : 0;

    const newVolumeThisMonth = segmentSales * newShare;
    const retainedVolumeThisMonth = segmentSales * (1 - newShare);
    const unservedRepeatDemandThisMonth = segmentLost * (1 - newShare);

    const segment = segmentById.get(seg.segmentId);
    let satisfactionThisMonth: number | null = null;
    let diagnosisThisMonth = null as ReturnType<typeof computeSatisfaction>["diagnosis"] | null;
    const totalServed = newVolumeThisMonth + retainedVolumeThisMonth;
    if (totalServed > 0 && segment) {
      const expectation = computeSegmentExpectation(offer, segment, reputationScore);
      const priceRatio = offer.price / segment.referencePrice;
      const result = computeSatisfaction(expectation, deliveredExperience, priceRatio, operationalPenalty);
      satisfactionThisMonth = result.score;
      diagnosisThisMonth = result.diagnosis;
      satisfactionEntries.push({ value: result.score, weight: totalServed });
    }

    return updateSegmentMemory(priorMemoryById.get(seg.segmentId) ?? null, {
      segmentId: seg.segmentId,
      segmentLabel: seg.segmentLabel,
      newVolumeThisMonth,
      retainedVolumeThisMonth,
      repeatDemandThisMonth: repeatDemandForSegment,
      unservedRepeatDemandThisMonth,
      satisfactionThisMonth,
      diagnosisThisMonth,
    });
  });

  return {
    updatedMemory,
    volumeForReputation: totalSales,
    satisfactionForReputation: volumeWeightedSatisfaction(satisfactionEntries),
  };
}

interface ContractualIntegration {
  /** Funnel avec la demande du segment ciblé réduite de `overlap` (spec §2) — à passer TEL QUEL à `computeTotalDemand`/`resolveOfferOutcome`, jamais modifiées. */
  readonly adjustedFunnel: Omit<DemandFunnelResult, "capacity" | "sales" | "lostToCapacity">;
  readonly allocation: ReturnType<typeof computeContractualCapacityAllocation>;
  readonly contractedVolume: number;
  readonly wonOpportunities: readonly StrategicAccountOpportunity[];
}

/**
 * Point d'entrée unique de l'intégration contractuelle (spec M11.2.4.3
 * §2-§3, décision 2 du plan) — structure identique pour les 4 familles à
 * capacité (seule l'unité change) : ajuste le funnel pour retirer le
 * chevauchement avec le volume contracté, puis calcule l'allocation à 3
 * flux. Ne modifie JAMAIS `computeTotalDemand` : l'appelle simplement avec
 * le funnel ajusté.
 */
function integrateContractualDemand(
  funnel: Omit<DemandFunnelResult, "capacity" | "sales" | "lostToCapacity">,
  repeatDemandBySegment: ReadonlyMap<string, number>,
  offer: Offer,
  capacityForOffer: number,
  strategicAccountOpportunities: readonly StrategicAccountOpportunity[],
): ContractualIntegration {
  const contractedVolume = computeContractedVolumeForOffer(strategicAccountOpportunities, offer.id);
  const targetIndex = funnel.bySegment.findIndex((s) => s.segmentId === offer.targetSegment);
  const aggregateDemandForTarget = targetIndex === -1 ? 0 : funnel.bySegment[targetIndex]!.demand;
  const { overlap } = computeContractualDemandAdjustment(aggregateDemandForTarget, contractedVolume);
  const adjustedFunnel =
    targetIndex === -1
      ? funnel
      : { ...funnel, bySegment: funnel.bySegment.map((s, i) => (i === targetIndex ? { ...s, demand: s.demand - overlap } : s)) };
  const newRepeatTotalDemand = computeTotalDemand(adjustedFunnel, repeatDemandBySegment);
  const allocation = computeContractualCapacityAllocation({ newRepeatTotalDemand, contractedVolume, capacityForOffer });
  const wonOpportunities = wonOpportunitiesForOffer(strategicAccountOpportunities, offer.id);
  return { adjustedFunnel, allocation, contractedVolume, wonOpportunities };
}

/**
 * CA réellement facturé pour une offre (spec §3, principe 9, décision 3) :
 * l'engin économique a été appelé au tarif générique de l'offre pour TOUT
 * le volume (y compris contractuel) — ce correctif remplace la part
 * contractuelle par son propre prix, sans jamais dupliquer un moteur de
 * revenu.
 */
function computeOfferRevenueWithContracts(genericRevenue: number, offerPrice: number, allocation: ContractualIntegration["allocation"], contractOutcomes: readonly ContractOutcome[]): number {
  const contractRevenue = contractOutcomes.reduce((sum, o) => sum + o.revenue, 0);
  return genericRevenue - allocation.contractualSales * offerPrice + contractRevenue;
}

/**
 * Fusionne les résultats d'exécution d'un mois dans la carte des
 * opportunités de l'entreprise (spec M11.2.4.3 §5, M11.2.4.4 §9) : chaque
 * contrat exécuté voit son volume réellement livré/perdu enregistré,
 * `monthsRemaining` décrémenté d'un mois (plancher 0, aucun effet à 0 —
 * renouvellement/perte différés à M11.2.4.5), ET sa satisfaction/
 * confiance mises à jour (`computeAccountRelationshipUpdate`, tous les
 * paramètres customer/* intouchés — voir ce module).
 */
function applyContractExecutionOutcomes(
  opportunitiesById: Map<string, StrategicAccountOpportunity>,
  outcomes: readonly ContractOutcome[],
  context: {
    readonly offer: Offer;
    readonly segments: readonly CustomerSegment[];
    readonly genericOperationalPenalty: number;
    readonly reputationScore: number;
    readonly date: GameDate;
  },
): void {
  for (const outcome of outcomes) {
    const opportunity = opportunitiesById.get(outcome.opportunityId);
    if (!opportunity?.contract) continue;
    const updatedContract = {
      ...opportunity.contract,
      lastMonthServedVolume: outcome.servedVolume,
      lastMonthUnservedVolume: outcome.unservedVolume,
      monthsRemaining: Math.max(0, opportunity.contract.monthsRemaining - 1),
    };
    const segment = context.segments.find((s) => s.id === opportunity.segmentId);
    const relationship = segment
      ? computeAccountRelationshipUpdate({
          previous: opportunity.relationship,
          contract: updatedContract,
          offer: context.offer,
          segment,
          genericOperationalPenalty: context.genericOperationalPenalty,
          reputationScore: context.reputationScore,
          date: context.date,
        })
      : opportunity.relationship;
    opportunitiesById.set(outcome.opportunityId, { ...opportunity, contract: updatedContract, relationship });
  }
}

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
  market: Market,
): ResolvedBusinessMonth {
  if (!action.decisions) {
    throw new RangeError(`resolveBusinessMonth: businessId="${action.businessId}" nécessite des décisions ce mois-ci.`);
  }

  const headcountResult =
    action.targetHeadcount !== undefined
      ? adjustHeadcount(owned.workforce, action.targetHeadcount)
      : { workforce: owned.workforce, hired: 0, fired: 0, recruitmentCost: 0, severanceCost: 0 };

  // Offres (spec M11.2.2 §6) : appliquées AVANT le calcul économique du mois
  // pour qu'une offre créée/lancée/repriceé ce mois-ci pèse immédiatement
  // sur la demande captée (ex. lancer une offre -> observer les premiers
  // clients le mois même).
  const { offers: offersAfterActions, developmentSpend } = applyOfferActions(
    owned.business.offers,
    action.offerActions ?? [],
    date,
  );

  let familyState: BusinessFamilyState = owned.familyState;
  let revenue = 0;
  let variableCosts = 0;
  let offersWithDemand: readonly Offer[] = offersAfterActions;
  // Contrats grands comptes (spec M11.2.4.3) : initialisée depuis TOUTES les
  // opportunités de l'entreprise (pas seulement celles de l'offre en cours
  // de traitement) — chaque famille y fusionne les résultats d'exécution
  // des offres qu'elle traite, jamais une résimulation.
  const opportunitiesById = new Map(owned.strategicAccountOpportunities.map((o) => [o.id, o]));

  switch (action.decisions.family) {
    case "service": {
      const state = requireFamilyState(owned.familyState, "service");
      const segments = getMarketSegments(market.family);
      const launchedOffers = offersAfterActions.filter((offer) => offer.status === "launched");
      let remainingCapacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      let totalRevenue = 0;
      let totalVariableCosts = 0;
      let totalVolumeForReputation = 0;
      const reputationEntries: { value: number; weight: number }[] = [];
      const demandById = new Map<string, DemandFunnelResult>();
      const memoryById = new Map<string, readonly SegmentCustomerMemory[]>();
      for (const offer of launchedOffers) {
        const priorWordOfMouth = aggregateWordOfMouthInputs(offer.customerMemory);
        const organicWordOfMouth = computeWordOfMouth(priorWordOfMouth.satisfaction, priorWordOfMouth.volume, FAMILY_REFERENCE_VOLUME.service);
        const funnel = computeOfferDemand(offer, market, segments, {
          demandShare,
          reputationScore: state.reputationScore,
          prospectionHours: action.founderProspectionHoursAllocated,
          date,
          organicWordOfMouth,
        });
        // Demande totale = acquisition (M11.2.2, inchangée) + réachat réel de la base
        // client existante (spec M11.2.3.1 §1-§3) — c'est elle, jamais la seule
        // demande d'acquisition, qui doit désormais être opposée à la capacité.
        const repeatDemandBySegment = computeRepeatDemandBySegment(offer.customerMemory);
        const capacityForOffer = remainingCapacityHours;
        const { adjustedFunnel, allocation, contractedVolume, wonOpportunities } = integrateContractualDemand(
          funnel,
          repeatDemandBySegment,
          offer,
          capacityForOffer,
          owned.strategicAccountOpportunities,
        );
        const contribution = computeServiceMonth(
          { hourlyRate: offer.price, costPerLaborHour: state.costPerLaborHour, reputationScore: state.reputationScore },
          { capacityHours: capacityForOffer, targetHours: allocation.totalDemandIncludingContractual },
          { rng: rng.fork(`business:${owned.id}:service:${offer.id}`) },
        );
        const contractOutcomes = allocateContractOutcomes(wonOpportunities, allocation.contractualSales, allocation.unservedContractual, contractedVolume);
        totalRevenue += computeOfferRevenueWithContracts(contribution.revenue, offer.price, allocation, contractOutcomes);
        totalVariableCosts += contribution.variableCosts;
        remainingCapacityHours = Math.max(0, remainingCapacityHours - contribution.hoursSold);
        const lostToCapacity = allocation.lostToCapacity;
        demandById.set(offer.id, {
          ...adjustedFunnel,
          demand: allocation.totalDemandIncludingContractual,
          capacity: capacityForOffer,
          sales: contribution.hoursSold,
          lostToCapacity,
        });

        const saturationRatio =
          capacityForOffer > 0
            ? allocation.totalDemandIncludingContractual / capacityForOffer
            : allocation.totalDemandIncludingContractual > 0
              ? Number.POSITIVE_INFINITY
              : 0;
        const operationalPenalty = computeOperationalPenalty({ saturationRatio });
        applyContractExecutionOutcomes(opportunitiesById, contractOutcomes, {
          offer,
          segments,
          genericOperationalPenalty: operationalPenalty,
          reputationScore: state.reputationScore,
          date,
        });
        const deliveredExperience = computeDeliveredExperience(offer.qualityLevel, operationalPenalty);
        const outcome = resolveOfferOutcome(
          offer,
          segments,
          adjustedFunnel,
          repeatDemandBySegment,
          deliveredExperience,
          operationalPenalty,
          allocation.newRepeatSales,
          allocation.newRepeatLost,
          state.reputationScore,
        );
        memoryById.set(offer.id, outcome.updatedMemory);
        totalVolumeForReputation += outcome.volumeForReputation;
        reputationEntries.push({ value: outcome.satisfactionForReputation, weight: outcome.volumeForReputation });
      }
      revenue = totalRevenue;
      variableCosts = totalVariableCosts;
      familyState =
        launchedOffers.length > 0
          ? {
              ...state,
              reputationScore: computeReputationUpdate(
                state.reputationScore,
                volumeWeightedSatisfaction(reputationEntries),
                totalVolumeForReputation,
                FAMILY_REFERENCE_VOLUME.service,
              ),
            }
          : state;
      offersWithDemand = offersAfterActions.map((offer) =>
        demandById.has(offer.id) ? { ...offer, lastDemand: demandById.get(offer.id)!, customerMemory: memoryById.get(offer.id)! } : offer,
      );
      break;
    }
    case "hospitality": {
      const state = requireFamilyState(owned.familyState, "hospitality");
      const segments = getMarketSegments(market.family);
      const launchedOffers = offersAfterActions.filter((offer) => offer.status === "launched");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      let remainingCoversCapacity = capacityHours / LABOR_HOURS_PER_COVER;
      let totalRevenue = 0;
      let totalVariableCosts = 0;
      let totalVolumeForReputation = 0;
      const reputationEntries: { value: number; weight: number }[] = [];
      const demandById = new Map<string, DemandFunnelResult>();
      const memoryById = new Map<string, readonly SegmentCustomerMemory[]>();
      for (const offer of launchedOffers) {
        const priorWordOfMouth = aggregateWordOfMouthInputs(offer.customerMemory);
        const organicWordOfMouth = computeWordOfMouth(priorWordOfMouth.satisfaction, priorWordOfMouth.volume, FAMILY_REFERENCE_VOLUME.hospitality);
        const funnel = computeOfferDemand(offer, market, segments, {
          demandShare,
          reputationScore: state.reputationScore,
          prospectionHours: action.founderProspectionHoursAllocated,
          date,
          organicWordOfMouth,
        });
        const repeatDemandBySegment = computeRepeatDemandBySegment(offer.customerMemory);
        const capacityForOffer = remainingCoversCapacity;
        const { adjustedFunnel, allocation, contractedVolume, wonOpportunities } = integrateContractualDemand(
          funnel,
          repeatDemandBySegment,
          offer,
          capacityForOffer,
          owned.strategicAccountOpportunities,
        );
        const contribution = computeHospitalityMonth(
          { averageTicketPrice: offer.price, foodCostPerCover: state.foodCostPerCover, reputationScore: state.reputationScore },
          { coversCapacity: capacityForOffer, expectedDemandCovers: allocation.totalDemandIncludingContractual },
          { rng: rng.fork(`business:${owned.id}:hospitality:${offer.id}`) },
        );
        const contractOutcomes = allocateContractOutcomes(wonOpportunities, allocation.contractualSales, allocation.unservedContractual, contractedVolume);
        totalRevenue += computeOfferRevenueWithContracts(contribution.revenue, offer.price, allocation, contractOutcomes);
        totalVariableCosts += contribution.variableCosts;
        remainingCoversCapacity = Math.max(0, remainingCoversCapacity - contribution.coversServed);
        const lostToCapacity = allocation.lostToCapacity;
        demandById.set(offer.id, {
          ...adjustedFunnel,
          demand: allocation.totalDemandIncludingContractual,
          capacity: capacityForOffer,
          sales: contribution.coversServed,
          lostToCapacity,
        });

        const saturationRatio =
          capacityForOffer > 0
            ? allocation.totalDemandIncludingContractual / capacityForOffer
            : allocation.totalDemandIncludingContractual > 0
              ? Number.POSITIVE_INFINITY
              : 0;
        const operationalPenalty = computeOperationalPenalty({ saturationRatio });
        applyContractExecutionOutcomes(opportunitiesById, contractOutcomes, {
          offer,
          segments,
          genericOperationalPenalty: operationalPenalty,
          reputationScore: state.reputationScore,
          date,
        });
        const deliveredExperience = computeDeliveredExperience(offer.qualityLevel, operationalPenalty);
        const outcome = resolveOfferOutcome(
          offer,
          segments,
          adjustedFunnel,
          repeatDemandBySegment,
          deliveredExperience,
          operationalPenalty,
          allocation.newRepeatSales,
          allocation.newRepeatLost,
          state.reputationScore,
        );
        memoryById.set(offer.id, outcome.updatedMemory);
        totalVolumeForReputation += outcome.volumeForReputation;
        reputationEntries.push({ value: outcome.satisfactionForReputation, weight: outcome.volumeForReputation });
      }
      revenue = totalRevenue;
      variableCosts = totalVariableCosts;
      familyState =
        launchedOffers.length > 0
          ? {
              ...state,
              reputationScore: computeReputationUpdate(
                state.reputationScore,
                volumeWeightedSatisfaction(reputationEntries),
                totalVolumeForReputation,
                FAMILY_REFERENCE_VOLUME.hospitality,
              ),
            }
          : state;
      offersWithDemand = offersAfterActions.map((offer) =>
        demandById.has(offer.id) ? { ...offer, lastDemand: demandById.get(offer.id)!, customerMemory: memoryById.get(offer.id)! } : offer,
      );
      break;
    }
    case "subscription": {
      const state = requireFamilyState(owned.familyState, "subscription");
      const segments = getMarketSegments(market.family);
      const launchedOffers = offersAfterActions.filter((offer) => offer.status === "launched");
      const subscriptionReferenceVolume = Math.max(state.activeSubscribers, SUBSCRIPTION_REFERENCE_VOLUME_FLOOR);

      const requiredHeadcount = state.activeSubscribers / SUBSCRIBERS_PER_SUPPORT_HEADCOUNT;
      const staffingRatio = computeStaffingRatio(headcountResult.workforce.headcount, requiredHeadcount);
      const understaffingPenalty =
        staffingRatio < 1 ? (1 - staffingRatio) * MAX_UNDERSTAFFING_CHURN_PENALTY : 0;

      // Ajustement de churn dérivé de la satisfaction agrégée de toutes les
      // offres lancées (spec M11.2.3 §13) : distinct de `understaffingPenalty`
      // (tension de capacité support, pas expérience perçue) — les deux se
      // combinent multiplicativement, sans compter deux fois le même phénomène.
      const businessWordOfMouthInputs = aggregateWordOfMouthInputs(launchedOffers.flatMap((offer) => offer.customerMemory));
      const satisfactionChurnAdjustment = computeSubscriptionChurnAdjustment(businessWordOfMouthInputs.satisfaction);
      const effectiveChurnRate = clamp(
        state.churnRateBase * (1 + understaffingPenalty) * (1 + satisfactionChurnAdjustment),
        0,
        1,
      );

      // Expérience délivrée (spec §4, §13) : Subscription n'a pas de ratio
      // capacité/demande (capacité illimitée) — la seule pression
      // opérationnelle observable est la tension support déjà mesurée par
      // `understaffingPenalty`, réutilisée directement comme `saturationRatio`.
      // Calculée ICI (avant la boucle) — indépendante de la demande captée —
      // pour être disponible dès l'exécution contractuelle (M11.2.4.4 §9).
      const operationalPenalty = computeOperationalPenalty({ saturationRatio: understaffingPenalty });

      let totalNewSubscribers = 0;
      const demandById = new Map<string, DemandFunnelResult>();
      const funnelById = new Map<string, Omit<DemandFunnelResult, "capacity" | "sales" | "lostToCapacity">>();
      // Allocation contractuelle par offre (spec M11.2.4.3, décision 7) —
      // relue par le second passage ci-dessous pour n'attribuer à
      // resolveOfferOutcome que la part new/repeat (jamais contractuelle,
      // décision 8 : réputation encore new+repeat uniquement).
      const allocationById = new Map<string, ReturnType<typeof computeContractualCapacityAllocation>>();
      for (const offer of launchedOffers) {
        const priorWordOfMouth = aggregateWordOfMouthInputs(offer.customerMemory);
        const organicWordOfMouth = computeWordOfMouth(priorWordOfMouth.satisfaction, priorWordOfMouth.volume, subscriptionReferenceVolume);
        const funnel = computeOfferDemand(offer, market, segments, {
          demandShare,
          reputationScore: state.reputationScore,
          prospectionHours: action.founderProspectionHoursAllocated,
          date,
          organicWordOfMouth,
        });
        // `computeSubscriptionMonth` n'a aucun plafond d'admission (vérifié à
        // la lecture, spec §6.2) : `capacityForOffer = Infinity` fait
        // dégénérer `computeContractualCapacityAllocation` exactement comme
        // voulu par la décision 7 — tout le volume contractuel est servi
        // (`contractualSales = contractedVolume`), jamais de
        // `unservedContractual` pour cette famille (cohérent avec « aucun
        // plafond d'admission »).
        const { adjustedFunnel, allocation, contractedVolume, wonOpportunities } = integrateContractualDemand(
          funnel,
          EMPTY_REPEAT_DEMAND,
          offer,
          Infinity,
          owned.strategicAccountOpportunities,
        );
        totalNewSubscribers += allocation.totalDemandIncludingContractual;
        funnelById.set(offer.id, adjustedFunnel);
        allocationById.set(offer.id, allocation);
        // CA volontairement PAS corrigé au prix du contrat (décision 7,
        // limitation documentée) : `revenue` reste `endingSubscribers × arpu`
        // générique pour tous les abonnés, contrat compris — seul le VOLUME
        // est intégré fidèlement (overlap/incremental).
        const contractOutcomes = allocateContractOutcomes(wonOpportunities, allocation.contractualSales, allocation.unservedContractual, contractedVolume);
        applyContractExecutionOutcomes(opportunitiesById, contractOutcomes, {
          offer,
          segments,
          genericOperationalPenalty: operationalPenalty,
          reputationScore: state.reputationScore,
          date,
        });
        demandById.set(offer.id, {
          ...adjustedFunnel,
          capacity: Infinity,
          sales: allocation.totalDemandIncludingContractual,
          lostToCapacity: 0,
        });
      }
      // Premier lancé (ordre de création) fixe le tarif du pool mono-tarif
      // actuel (spec §6.2) — corrige la limitation M11.2.1 où le prix de
      // l'offre était décoratif pour Subscription.
      const arpu = launchedOffers[0]?.price ?? state.arpu;
      const contribution = computeSubscriptionMonth(
        { activeSubscribers: state.activeSubscribers, arpu, churnRate: effectiveChurnRate, cogsRatio: state.cogsRatio },
        { newSubscribers: totalNewSubscribers },
        { rng: rng.fork(`business:${owned.id}:subscription`) },
      );
      revenue = contribution.revenue;
      variableCosts = contribution.variableCosts;

      let totalVolumeForReputation = 0;
      const reputationEntries: { value: number; weight: number }[] = [];
      const memoryById = new Map<string, readonly SegmentCustomerMemory[]>();
      for (const offer of launchedOffers) {
        const funnel = funnelById.get(offer.id)!;
        const allocation = allocationById.get(offer.id)!;
        const deliveredExperience = computeDeliveredExperience(offer.qualityLevel, operationalPenalty);
        // Pas de plafond de capacité par offre en Subscription (spec §6.2) :
        // toute la demande captée est réputée servie. Pas de repeat demand
        // transactionnel non plus (spec M11.2.3.1 §8, §12) : la vraie
        // mécanique de rétention de Subscription est `activeSubscribers`
        // (acquisition/churn ci-dessus), pas cette mémoire par segment — la
        // `Map` vide fait absorber 100% du flux par `newVolumeThisMonth`.
        // `newRepeatSales` (jamais le volume contractuel, décision 8) :
        // réputation encore new+repeat uniquement tant qu'aucun signal de
        // satisfaction de compte n'existe (M11.2.4.4).
        const outcome = resolveOfferOutcome(
          offer,
          segments,
          funnel,
          EMPTY_REPEAT_DEMAND,
          deliveredExperience,
          operationalPenalty,
          allocation.newRepeatSales,
          allocation.newRepeatLost,
          state.reputationScore,
        );
        memoryById.set(offer.id, outcome.updatedMemory);
        totalVolumeForReputation += outcome.volumeForReputation;
        reputationEntries.push({ value: outcome.satisfactionForReputation, weight: outcome.volumeForReputation });
      }

      familyState = {
        ...state,
        activeSubscribers: contribution.endingSubscribers,
        reputationScore:
          launchedOffers.length > 0
            ? computeReputationUpdate(
                state.reputationScore,
                volumeWeightedSatisfaction(reputationEntries),
                totalVolumeForReputation,
                subscriptionReferenceVolume,
              )
            : state.reputationScore,
      };
      offersWithDemand = offersAfterActions.map((offer) =>
        demandById.has(offer.id) ? { ...offer, lastDemand: demandById.get(offer.id)!, customerMemory: memoryById.get(offer.id)! } : offer,
      );
      break;
    }
    case "retail": {
      const state = requireFamilyState(owned.familyState, "retail");
      const segments = getMarketSegments(market.family);
      const launchedOffers = offersAfterActions.filter((offer) => offer.status === "launched");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      const laborCapacityUnits = capacityHours / LABOR_HOURS_PER_UNIT_SOLD;
      let remainingCapacityUnits = Math.min(action.decisions.stockUnits, laborCapacityUnits);
      let totalRevenue = 0;
      let totalVariableCosts = 0;
      let totalVolumeForReputation = 0;
      const reputationEntries: { value: number; weight: number }[] = [];
      const demandById = new Map<string, DemandFunnelResult>();
      const memoryById = new Map<string, readonly SegmentCustomerMemory[]>();
      for (const offer of launchedOffers) {
        const priorWordOfMouth = aggregateWordOfMouthInputs(offer.customerMemory);
        const organicWordOfMouth = computeWordOfMouth(priorWordOfMouth.satisfaction, priorWordOfMouth.volume, FAMILY_REFERENCE_VOLUME.retail);
        const funnel = computeOfferDemand(offer, market, segments, {
          demandShare,
          reputationScore: state.reputationScore,
          prospectionHours: action.founderProspectionHoursAllocated,
          date,
          organicWordOfMouth,
        });
        const repeatDemandBySegment = computeRepeatDemandBySegment(offer.customerMemory);
        const capacityForOffer = remainingCapacityUnits;
        const { adjustedFunnel, allocation, contractedVolume, wonOpportunities } = integrateContractualDemand(
          funnel,
          repeatDemandBySegment,
          offer,
          capacityForOffer,
          owned.strategicAccountOpportunities,
        );
        const contribution = RetailEngine.computeMonth(
          { unitPrice: offer.price, unitCostOfGoods: state.unitCostOfGoods, reputationScore: state.reputationScore },
          { stockUnits: capacityForOffer, expectedFootTraffic: allocation.totalDemandIncludingContractual },
          { rng: rng.fork(`business:${owned.id}:retail:${offer.id}`) },
        );
        const contractOutcomes = allocateContractOutcomes(wonOpportunities, allocation.contractualSales, allocation.unservedContractual, contractedVolume);
        totalRevenue += computeOfferRevenueWithContracts(contribution.revenue, offer.price, allocation, contractOutcomes);
        totalVariableCosts += contribution.variableCosts;
        remainingCapacityUnits = Math.max(0, remainingCapacityUnits - contribution.unitsSold);
        const lostToCapacity = allocation.lostToCapacity;
        demandById.set(offer.id, {
          ...adjustedFunnel,
          demand: allocation.totalDemandIncludingContractual,
          capacity: capacityForOffer,
          sales: contribution.unitsSold,
          lostToCapacity,
        });

        const saturationRatio =
          capacityForOffer > 0
            ? allocation.totalDemandIncludingContractual / capacityForOffer
            : allocation.totalDemandIncludingContractual > 0
              ? Number.POSITIVE_INFINITY
              : 0;
        const operationalPenalty = computeOperationalPenalty({ saturationRatio });
        applyContractExecutionOutcomes(opportunitiesById, contractOutcomes, {
          offer,
          segments,
          genericOperationalPenalty: operationalPenalty,
          reputationScore: state.reputationScore,
          date,
        });
        const deliveredExperience = computeDeliveredExperience(offer.qualityLevel, operationalPenalty);
        const outcome = resolveOfferOutcome(
          offer,
          segments,
          adjustedFunnel,
          repeatDemandBySegment,
          deliveredExperience,
          operationalPenalty,
          allocation.newRepeatSales,
          allocation.newRepeatLost,
          state.reputationScore,
        );
        memoryById.set(offer.id, outcome.updatedMemory);
        totalVolumeForReputation += outcome.volumeForReputation;
        reputationEntries.push({ value: outcome.satisfactionForReputation, weight: outcome.volumeForReputation });
      }
      revenue = totalRevenue;
      variableCosts = totalVariableCosts;
      familyState =
        launchedOffers.length > 0
          ? {
              ...state,
              reputationScore: computeReputationUpdate(
                state.reputationScore,
                volumeWeightedSatisfaction(reputationEntries),
                totalVolumeForReputation,
                FAMILY_REFERENCE_VOLUME.retail,
              ),
            }
          : state;
      offersWithDemand = offersAfterActions.map((offer) =>
        demandById.has(offer.id) ? { ...offer, lastDemand: demandById.get(offer.id)!, customerMemory: memoryById.get(offer.id)! } : offer,
      );
      break;
    }
    case "agency": {
      const state = requireFamilyState(owned.familyState, "agency");
      const segments = getMarketSegments(market.family);
      const launchedOffers = offersAfterActions.filter((offer) => offer.status === "launched");
      const capacityHours =
        action.founderHoursAllocated + computeWorkforceCapacityHours(headcountResult.workforce, founderLeadershipSkill);
      let remainingCapacityMandates = capacityHours / LABOR_HOURS_PER_MANDATE;
      let totalRevenue = 0;
      let totalVariableCosts = 0;
      let totalVolumeForReputation = 0;
      const reputationEntries: { value: number; weight: number }[] = [];
      const demandById = new Map<string, DemandFunnelResult>();
      const memoryById = new Map<string, readonly SegmentCustomerMemory[]>();
      for (const offer of launchedOffers) {
        const priorWordOfMouth = aggregateWordOfMouthInputs(offer.customerMemory);
        const organicWordOfMouth = computeWordOfMouth(priorWordOfMouth.satisfaction, priorWordOfMouth.volume, FAMILY_REFERENCE_VOLUME.agency);
        const funnel = computeOfferDemand(offer, market, segments, {
          demandShare,
          reputationScore: state.reputationScore,
          prospectionHours: action.founderProspectionHoursAllocated,
          date,
          organicWordOfMouth,
        });
        const repeatDemandBySegment = computeRepeatDemandBySegment(offer.customerMemory);
        const capacityForOffer = remainingCapacityMandates;
        const { adjustedFunnel, allocation, contractedVolume, wonOpportunities } = integrateContractualDemand(
          funnel,
          repeatDemandBySegment,
          offer,
          capacityForOffer,
          owned.strategicAccountOpportunities,
        );
        const contribution = AgencyEngine.computeMonth(
          {
            // Corrige la limitation M11.2.1 (spec §6.2) : le prix de
            // l'offre pilote désormais réellement le CA de l'agence, plus
            // une constante figée à la création.
            averageMonthlyFeePerMandate: offer.price,
            deliveryCostRatio: state.deliveryCostRatio,
            reputationScore: state.reputationScore,
            skillFactor: clamp(founderLeadershipSkill / 100, 0, 1),
          },
          { capacityMandates: capacityForOffer, targetMandates: allocation.totalDemandIncludingContractual },
          { rng: rng.fork(`business:${owned.id}:agency:${offer.id}`) },
        );
        const contractOutcomes = allocateContractOutcomes(wonOpportunities, allocation.contractualSales, allocation.unservedContractual, contractedVolume);
        totalRevenue += computeOfferRevenueWithContracts(contribution.revenue, offer.price, allocation, contractOutcomes);
        totalVariableCosts += contribution.variableCosts;
        remainingCapacityMandates = Math.max(0, remainingCapacityMandates - contribution.wonMandates);
        const lostToCapacity = allocation.lostToCapacity;
        demandById.set(offer.id, {
          ...adjustedFunnel,
          demand: allocation.totalDemandIncludingContractual,
          capacity: capacityForOffer,
          sales: contribution.wonMandates,
          lostToCapacity,
        });

        const saturationRatio =
          capacityForOffer > 0
            ? allocation.totalDemandIncludingContractual / capacityForOffer
            : allocation.totalDemandIncludingContractual > 0
              ? Number.POSITIVE_INFINITY
              : 0;
        const operationalPenalty = computeOperationalPenalty({ saturationRatio });
        applyContractExecutionOutcomes(opportunitiesById, contractOutcomes, {
          offer,
          segments,
          genericOperationalPenalty: operationalPenalty,
          reputationScore: state.reputationScore,
          date,
        });
        const deliveredExperience = computeDeliveredExperience(offer.qualityLevel, operationalPenalty);
        const outcome = resolveOfferOutcome(
          offer,
          segments,
          adjustedFunnel,
          repeatDemandBySegment,
          deliveredExperience,
          operationalPenalty,
          allocation.newRepeatSales,
          allocation.newRepeatLost,
          state.reputationScore,
        );
        memoryById.set(offer.id, outcome.updatedMemory);
        totalVolumeForReputation += outcome.volumeForReputation;
        reputationEntries.push({ value: outcome.satisfactionForReputation, weight: outcome.volumeForReputation });
      }
      revenue = totalRevenue;
      variableCosts = totalVariableCosts;
      familyState =
        launchedOffers.length > 0
          ? {
              ...state,
              reputationScore: computeReputationUpdate(
                state.reputationScore,
                volumeWeightedSatisfaction(reputationEntries),
                totalVolumeForReputation,
                FAMILY_REFERENCE_VOLUME.agency,
              ),
            }
          : state;
      offersWithDemand = offersAfterActions.map((offer) =>
        demandById.has(offer.id) ? { ...offer, lastDemand: demandById.get(offer.id)!, customerMemory: memoryById.get(offer.id)! } : offer,
      );
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

  const businessWithPropertyPayments = { ...owned.business, properties: propertiesAfterPayments, offers: offersWithDemand };

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
    updated: {
      ...owned,
      business,
      workforce: headcountResult.workforce,
      familyState,
      lastStatement: statement,
      strategicAccountOpportunities: Array.from(opportunitiesById.values()),
    },
    statement,
    outcome,
    hired: headcountResult.hired,
    fired: headcountResult.fired,
    recruitmentCost: headcountResult.recruitmentCost,
    severanceCost: headcountResult.severanceCost,
  };
}
