import { createInitialGameState } from "../engine/simulation/game.js";
import type { BusinessAction, GameState, MonthActions } from "../engine/simulation/types.js";
import { SERVICE_MARKET } from "./markets.js";

/**
 * Vertical slice "Service" (consolidation, tâche 4) : 18 ans -> petit boulot
 * -> activité seule -> recrutement -> croissance -> PME ou faillite. Ce
 * fichier ne fait QUE produire des décisions de joueur ; toute la
 * simulation reste dans `simulateMonth` — aucune branche spécifique à ce
 * scénario n'existe dans le moteur.
 */
export const SERVICE_SCENARIO_BIRTH_DATE = { year: 2008, month: 1 };
export const SERVICE_SCENARIO_START_DATE = { year: 2026, month: 1 };
export const SERVICE_BUSINESS_ID = "service-co";

const JOB_PHASE_MONTHS = 12;
const JOB_HOURLY_WAGE = 12;

export function createServiceScenarioInitialState(seed: number): GameState {
  return createInitialGameState(seed, SERVICE_SCENARIO_BIRTH_DATE, SERVICE_SCENARIO_START_DATE, [SERVICE_MARKET]);
}

/** Politique de recrutement : "fondateur seul -> 1 salarié -> 5 -> 20 -> 100+" (brief), gagée sur le cash disponible. */
function targetHeadcountForCash(cash: number): number {
  if (cash < 20_000) return 0;
  if (cash < 60_000) return 1;
  if (cash < 150_000) return 5;
  if (cash < 400_000) return 20;
  return 100;
}

/** Le fondateur délègue progressivement à mesure que l'effectif grandit (spec §13-14). */
function founderHoursForHeadcount(headcount: number): number {
  return Math.max(20, 150 - headcount * 5);
}

export function buildServiceScenarioActions(monthIndex: number, state: GameState): MonthActions {
  const wasLiquidated = state.memory.some((entry) => entry.kind === "business-liquidated");

  if (monthIndex < JOB_PHASE_MONTHS || wasLiquidated) {
    return {
      timeAllocation: { emploi: 140, apprentissage: 10, business: 0, reseau: 10 },
      jobHourlyWage: JOB_HOURLY_WAGE,
      businessActions: [],
    };
  }

  const existing = state.businesses.find((business) => business.id === SERVICE_BUSINESS_ID);
  const currentHeadcount = existing?.workforce.headcount ?? 0;
  const cash = existing?.business.treasury.cash ?? 0;
  const targetHeadcount = targetHeadcountForCash(cash);
  const founderHours = founderHoursForHeadcount(Math.max(currentHeadcount, targetHeadcount));

  const businessAction: BusinessAction = {
    businessId: SERVICE_BUSINESS_ID,
    founderHoursAllocated: founderHours,
    founderProspectionHoursAllocated: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...(existing
      ? {}
      : {
          create: {
            family: "service",
            name: "Service Co",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_200,
            creditLineLimit: 50_000,
            creditLineInterestRateAnnual: 0.08,
          },
        }),
    // targetHours volontairement très supérieur à la capacité : la vente
    // reste bornée par la capacité (fondateur + effectif), pas par l'effort
    // commercial, ce qui isole l'effet du recrutement dans la trajectoire.
    decisions: { family: "service", price: 45, targetHours: 100_000 },
    marketingBudget: 300 + currentHeadcount * 20,
    rentBudget: 400 + currentHeadcount * 150,
    adminBudget: 150 + currentHeadcount * 50,
    targetHeadcount,
  };

  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: founderHours, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [businessAction],
  };
}
