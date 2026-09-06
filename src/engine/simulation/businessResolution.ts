import type { Rng } from "../rng/rng.js";
import { clamp } from "../util/math.js";
import {
  adjustHeadcount,
  computePayrollCost,
  computeStaffingRatio,
  computeWorkforceCapacityHours,
} from "../employees/employees.js";
import { computeMonthlyFinancials } from "../business/accounting.js";
import { applyMonthlyCashFlow, computeMonthlyInterest, injectCapital, type FinancingOutcome } from "../business/treasury.js";
import { computeServiceMonth } from "../economic-models/service.js";
import { computeHospitalityMonth } from "../economic-models/hospitality.js";
import { computeSubscriptionMonth } from "../economic-models/subscription.js";
import { createBusiness } from "../business/treasury.js";
import { createWorkforce } from "../employees/employees.js";
import type { MonthlyFinancialStatement } from "../../types/business.js";
import type { BusinessAction, BusinessFamilyState, CreateBusinessSpec, OwnedBusiness } from "./types.js";

const INITIAL_REPUTATION_SCORE = 0.1;

/** Crée une nouvelle entreprise possédée à partir d'une spécification de création (spec §3). */
export function createOwnedBusiness(id: string, spec: CreateBusinessSpec): OwnedBusiness {
  const business = createBusiness(id, [spec.family], {
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
  }

  return { id, business, workforce, marketId: spec.marketId, familyState };
}

/** Taux d'imposition standard appliqué en P0 (simplification : pas de barème progressif). */
const TAX_RATE = 0.25;

/** Heures de main-d'œuvre nécessaires pour servir un couvert (Hospitality). */
const LABOR_HOURS_PER_COVER = 0.5;

/** Abonnés supportables par un équivalent temps plein support/succès client (Subscription). */
const SUBSCRIBERS_PER_SUPPORT_HEADCOUNT = 500;
/** Majoration maximale du churn en cas de sous-effectif support total (staffingRatio -> 0). */
const MAX_UNDERSTAFFING_CHURN_PENALTY = 1.0;

export interface ResolvedBusinessMonth {
  readonly updated: OwnedBusiness;
  readonly statement: MonthlyFinancialStatement;
  readonly outcome: FinancingOutcome;
  readonly hired: number;
  readonly fired: number;
  readonly recruitmentCost: number;
  readonly severanceCost: number;
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
  }

  const interest = computeMonthlyInterest(owned.business.treasury.creditLine);
  const statement = computeMonthlyFinancials({
    revenue,
    variableCosts,
    payroll: computePayrollCost(headcountResult.workforce),
    marketing: action.marketingBudget,
    rent: action.rentBudget,
    admin: action.adminBudget + headcountResult.recruitmentCost + headcountResult.severanceCost,
    depreciation: 0,
    interest,
    taxRate: TAX_RATE,
    capex: action.capex ?? 0,
    workingCapitalChange: 0,
  });

  const businessBeforeCashFlow =
    action.capitalInjection && action.capitalInjection > 0
      ? injectCapital(owned.business, action.capitalInjection)
      : owned.business;
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
