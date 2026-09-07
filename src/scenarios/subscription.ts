import { createInitialGameState } from "../engine/simulation/game.js";
import type { BusinessAction, GameState, MonthActions } from "../engine/simulation/types.js";
import { SUBSCRIPTION_MARKET } from "./markets.js";

/**
 * Vertical slice "Subscription" (consolidation, tâche 4) : apprentissage ->
 * SaaS -> acquisition clients -> churn -> embauche -> croissance. Même
 * moteur que les autres scénarios, aucune branche dédiée.
 */
export const SUBSCRIPTION_SCENARIO_BIRTH_DATE = { year: 2008, month: 1 };
export const SUBSCRIPTION_SCENARIO_START_DATE = { year: 2026, month: 1 };
export const SUBSCRIPTION_BUSINESS_ID = "saas-co";

const LEARNING_PHASE_MONTHS = 18;
const PART_TIME_JOB_HOURLY_WAGE = 10;
/** Abonnés par équivalent temps plein support (doit rester cohérent avec businessResolution.ts). */
const SUBSCRIBERS_PER_SUPPORT_HEADCOUNT = 500;

export function createSubscriptionScenarioInitialState(seed: number): GameState {
  return createInitialGameState(seed, SUBSCRIPTION_SCENARIO_BIRTH_DATE, SUBSCRIPTION_SCENARIO_START_DATE, [
    SUBSCRIPTION_MARKET,
  ]);
}

export function buildSubscriptionScenarioActions(monthIndex: number, state: GameState): MonthActions {
  const wasLiquidated = state.memory.some((entry) => entry.kind === "business-liquidated");

  if (monthIndex < LEARNING_PHASE_MONTHS || wasLiquidated) {
    return {
      timeAllocation: { emploi: 80, apprentissage: 70, business: 0, reseau: 10 },
      jobHourlyWage: PART_TIME_JOB_HOURLY_WAGE,
      businessActions: [],
    };
  }

  const existing = state.businesses.find((business) => business.id === SUBSCRIPTION_BUSINESS_ID);
  const isCreationMonth = !existing;
  const activeSubscribers = existing?.familyState.family === "subscription" ? existing.familyState.activeSubscribers : 0;
  const currentHeadcount = existing?.workforce.headcount ?? 0;
  // Effectif support légèrement au-dessus du seuil de pénalité de sous-effectif (businessResolution.ts).
  const targetHeadcount = Math.ceil(activeSubscribers / (SUBSCRIBERS_PER_SUPPORT_HEADCOUNT * 1.2));
  const monthsSinceLaunch = existing ? monthIndex - LEARNING_PHASE_MONTHS : 0;

  const businessAction: BusinessAction = {
    businessId: SUBSCRIPTION_BUSINESS_ID,
    founderHoursAllocated: 120,
    founderProspectionHoursAllocated: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...(isCreationMonth
      ? {
          create: {
            family: "subscription",
            name: "Subscription Co",
            marketId: SUBSCRIPTION_MARKET.id,
            arpu: 29,
            churnRateBase: 0.04,
            cogsRatio: 0.2,
            initialActiveSubscribers: 0,
            averageMonthlySalary: 3_500,
            creditLineLimit: 40_000,
            creditLineInterestRateAnnual: 0.08,
          },
        }
      : {}),
    decisions: { family: "subscription", newSubscribers: Math.min(600, 20 + monthsSinceLaunch * 3) },
    marketingBudget: 500 + Math.min(activeSubscribers * 2, 5_000),
    rentBudget: 300,
    adminBudget: 200 + currentHeadcount * 50,
    targetHeadcount,
  };

  return {
    timeAllocation: { emploi: 0, apprentissage: 20, business: 120, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [businessAction],
  };
}
