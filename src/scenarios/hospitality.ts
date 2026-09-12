import { createInitialGameState } from "../engine/simulation/game.js";
import type { BusinessAction, GameState, MonthActions } from "../engine/simulation/types.js";
import type { OfferAction } from "../types/offer.js";
import { HOSPITALITY_MARKET } from "./markets.js";

/**
 * Vertical slice "Hospitality" (consolidation, tâche 4) : capital plus
 * élevé, coûts fixes, personnel dès le départ, risque de liquidité réel au
 * lancement (gros CAPEX d'aménagement financé partiellement par la ligne de
 * crédit). Même moteur que les autres scénarios, aucune branche dédiée.
 */
export const HOSPITALITY_SCENARIO_BIRTH_DATE = { year: 2008, month: 1 };
export const HOSPITALITY_SCENARIO_START_DATE = { year: 2026, month: 1 };
export const HOSPITALITY_BUSINESS_ID = "resto-co";

const JOB_PHASE_MONTHS = 18;
const JOB_HOURLY_WAGE = 13;
const FITOUT_CAPEX = 40_000;
const HOSPITALITY_OFFER_ID = "resto-co-offer-1";
const HOSPITALITY_PROSPECTION_HOURS = 20;

export function createHospitalityScenarioInitialState(seed: number): GameState {
  return createInitialGameState(seed, HOSPITALITY_SCENARIO_BIRTH_DATE, HOSPITALITY_SCENARIO_START_DATE, [
    HOSPITALITY_MARKET,
  ]);
}

function targetHeadcountForCash(cash: number): number {
  if (cash < 10_000) return 3; // un restaurant a besoin de personnel dès le lancement
  if (cash < 60_000) return 4;
  if (cash < 150_000) return 8;
  return 15;
}

function founderHoursForHeadcount(headcount: number): number {
  return Math.max(20, 150 - HOSPITALITY_PROSPECTION_HOURS - headcount * 5);
}

export function buildHospitalityScenarioActions(monthIndex: number, state: GameState): MonthActions {
  const wasLiquidated = state.memory.some((entry) => entry.kind === "business-liquidated");

  if (monthIndex < JOB_PHASE_MONTHS || wasLiquidated) {
    return {
      timeAllocation: { emploi: 140, apprentissage: 0, business: 0, reseau: 20 },
      jobHourlyWage: JOB_HOURLY_WAGE,
      businessActions: [],
    };
  }

  const existing = state.businesses.find((business) => business.id === HOSPITALITY_BUSINESS_ID);
  const isCreationMonth = !existing;
  const currentHeadcount = existing?.workforce.headcount ?? 0;
  const cash = existing?.business.treasury.cash ?? 0;
  const targetHeadcount = targetHeadcountForCash(cash);
  const founderHours = founderHoursForHeadcount(Math.max(currentHeadcount, targetHeadcount));

  const offerActions: OfferAction[] = isCreationMonth
    ? [
        {
          kind: "create",
          spec: { id: HOSPITALITY_OFFER_ID, name: "Carte Resto & Co", businessModel: "service-hours", positioning: "standard", targetSegment: "", price: 26 },
        },
        { kind: "launch", offerId: HOSPITALITY_OFFER_ID },
      ]
    : [];

  const businessAction: BusinessAction = {
    businessId: HOSPITALITY_BUSINESS_ID,
    founderHoursAllocated: founderHours,
    founderProspectionHoursAllocated: HOSPITALITY_PROSPECTION_HOURS,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...(isCreationMonth
      ? {
          create: {
            family: "hospitality",
            name: "Resto & Co",
            marketId: HOSPITALITY_MARKET.id,
            foodCostPerCover: 9,
            averageMonthlySalary: 2_000,
            creditLineLimit: 80_000,
            creditLineInterestRateAnnual: 0.09,
          },
          capex: FITOUT_CAPEX,
        }
      : {}),
    offerActions,
    decisions: { family: "hospitality" },
    marketingBudget: 300 + currentHeadcount * 30,
    rentBudget: 1_500 + currentHeadcount * 50,
    adminBudget: 200 + currentHeadcount * 40,
    targetHeadcount,
  };

  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: founderHours + HOSPITALITY_PROSPECTION_HOURS, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [businessAction],
  };
}
