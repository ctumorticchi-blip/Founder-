import type { BusinessAction, GameState, MonthActions } from "@founder/engine";
import { MONTHLY_TIME_BUDGET_HOURS } from "@founder/engine";
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

/** Construit le `MonthActions` du moteur à partir du brouillon courant. */
export function buildMonthActions(draft: MonthDraft): MonthActions {
  const businessActions: BusinessAction[] = [];
  if (draft.business) {
    const b: BusinessDraft = draft.business;
    const action: BusinessAction = {
      businessId: b.businessId,
      founderHoursAllocated: draft.timeAllocation.business,
      decisions: b.decisions,
      marketingBudget: b.marketingBudget,
      rentBudget: b.rentBudget,
      adminBudget: b.adminBudget,
      ...(b.isNew && b.createSpec ? { create: b.createSpec } : {}),
      ...(b.capex > 0 ? { capex: b.capex } : {}),
      ...(b.targetHeadcount !== null ? { targetHeadcount: b.targetHeadcount } : {}),
      ...(b.capitalInjection > 0 ? { capitalInjection: b.capitalInjection } : {}),
    };
    businessActions.push(action);
  }

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
    previousDraft.business && stillExists ? { ...previousDraft.business, isNew: false, createSpec: null, targetHeadcount: null, capitalInjection: 0 } : null;

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
