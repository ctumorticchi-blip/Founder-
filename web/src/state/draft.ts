import type { BusinessAction, GameState, MonthActions } from "@founder/engine";
import { MONTHLY_TIME_BUDGET_HOURS } from "@founder/engine";
import {
  computeAdminMonthlyCost,
  computeInfrastructureMonthlyCost,
  computeInfrastructureSetupCost,
  computePurchasesCost,
} from "./businessCosts";
import type { BusinessDraft, MonthDraft } from "./types";

export function createEmptyDraft(): MonthDraft {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 0, reseau: 0 },
    job: null,
    business: null,
  };
}

export const TOTAL_MONTHLY_HOURS = MONTHLY_TIME_BUDGET_HOURS;

export function totalAllocatedHours(draft: MonthDraft): number {
  const { emploi, apprentissage, business, reseau } = draft.timeAllocation;
  return emploi + apprentissage + business + reseau;
}

export function remainingHours(draft: MonthDraft): number {
  return TOTAL_MONTHLY_HOURS - totalAllocatedHours(draft);
}

/**
 * Traduit les choix catalogue du brouillon en `rentBudget`/`adminBudget`/
 * `capex` (spec M11.1 §2, §4) : agrégation pure de prix affichés, jamais une
 * conséquence économique — la conséquence reste calculée à 100 % par
 * `simulateMonth` une fois ces nombres transmis.
 */
function buildBusinessAction(b: BusinessDraft, founderHoursAllocated: number): BusinessAction {
  const setupCost = b.isNew ? computeInfrastructureSetupCost(b.infrastructureId) : 0;
  const capex = computePurchasesCost(b.purchases) + setupCost;
  return {
    businessId: b.businessId,
    founderHoursAllocated,
    decisions: b.decisions,
    marketingBudget: b.marketingBudget,
    rentBudget: computeInfrastructureMonthlyCost(b.infrastructureId),
    adminBudget: computeAdminMonthlyCost(b.adminOptionalIds),
    ...(b.isNew && b.createSpec ? { create: b.createSpec } : {}),
    ...(capex > 0 ? { capex } : {}),
    ...(b.targetHeadcount !== null ? { targetHeadcount: b.targetHeadcount } : {}),
    ...(b.capitalInjection > 0 ? { capitalInjection: b.capitalInjection } : {}),
  };
}

/** Construit le `MonthActions` du moteur à partir du brouillon courant. */
export function buildMonthActions(draft: MonthDraft): MonthActions {
  const businessActions: BusinessAction[] = draft.business
    ? [buildBusinessAction(draft.business, draft.timeAllocation.business)]
    : [];

  return {
    timeAllocation: draft.timeAllocation,
    jobHourlyWage: draft.job ? draft.job.hourlyWage : null,
    businessActions,
  };
}

/** Reconduit le brouillon pour le mois suivant à partir du nouvel état moteur. */
export function deriveNextDraft(previousDraft: MonthDraft, nextState: GameState): MonthDraft {
  const stillExists = previousDraft.business
    ? nextState.businesses.find((business) => business.id === previousDraft.business!.businessId)
    : undefined;

  const business: BusinessDraft | null =
    previousDraft.business && stillExists
      ? { ...previousDraft.business, isNew: false, createSpec: null, targetHeadcount: null, capitalInjection: 0, purchases: [] }
      : null;

  return {
    timeAllocation: {
      ...previousDraft.timeAllocation,
      business: business ? previousDraft.timeAllocation.business : 0,
    },
    job: nextState.job ? previousDraft.job : null,
    business,
  };
}

/** Validation côté UI, en plus (jamais à la place) des validations du moteur. */
export function draftValidationError(draft: MonthDraft): string | null {
  const total = totalAllocatedHours(draft);
  if (total > TOTAL_MONTHLY_HOURS) {
    return `Vous avez alloué ${Math.round(total)} h, mais vous n'avez que ${TOTAL_MONTHLY_HOURS} h par mois.`;
  }
  if (draft.business?.isNew && draft.timeAllocation.business <= 0 && !draft.business.targetHeadcount) {
    return "Allouez du temps \"entreprise\" (ou recrutez) pour que votre nouvelle activité produise dès son premier mois.";
  }
  return null;
}
