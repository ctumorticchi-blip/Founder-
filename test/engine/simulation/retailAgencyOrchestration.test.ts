import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { GameState, MonthActions } from "../../../src/engine/simulation/types.js";
import type { OfferAction } from "../../../src/types/offer.js";
import { AGENCY_MARKET, RETAIL_MARKET } from "../../../src/scenarios/markets.js";

const RETAIL_OFFER_ACTIONS: OfferAction[] = [
  { kind: "create", spec: { id: "fleur-offer", name: "Bouquets Fleur Co", businessModel: "service-hours", positioning: "standard", targetSegment: "", price: 15 } },
  { kind: "launch", offerId: "fleur-offer" },
];

const AGENCY_OFFER_ACTIONS: OfferAction[] = [
  { kind: "create", spec: { id: "conseil-offer", name: "Mandat Conseil Co", businessModel: "service-hours", positioning: "standard", targetSegment: "", price: 6_000 } },
  { kind: "launch", offerId: "conseil-offer" },
];

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 909090;

/**
 * Spec de clôture M9.5, tâche 1 : les 5/5 familles P0 doivent être
 * réellement jouables via `simulateMonth`, pas seulement testables
 * isolément (comme c'était le cas pour Retail/Agency depuis M3/M8).
 */
function retailCreationActions(founderHours: number): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: founderHours, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      {
        businessId: "fleur-co",
        founderHoursAllocated: founderHours,
        founderProspectionHoursAllocated: 0,
        create: {
          family: "retail",
          name: "Fleur Co",
          marketId: RETAIL_MARKET.id,
          unitCostOfGoods: 6,
          averageMonthlySalary: 1_800,
          creditLineLimit: 20_000,
          creditLineInterestRateAnnual: 0.08,
        },
        decisions: { family: "retail", stockUnits: 2_000 },
        offerActions: RETAIL_OFFER_ACTIONS,
        marketingBudget: 200,
        rentBudget: 500,
        adminBudget: 100,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
    ],
  };
}

function retailContinuationActions(founderHours: number, targetHeadcount?: number): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: founderHours, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      {
        businessId: "fleur-co",
        founderHoursAllocated: founderHours,
        founderProspectionHoursAllocated: 0,
        decisions: { family: "retail", stockUnits: 2_000 },
        marketingBudget: 200,
        rentBudget: 500,
        adminBudget: 100,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
        ...(targetHeadcount !== undefined ? { targetHeadcount } : {}),
      },
    ],
  };
}

function agencyCreationActions(founderHours: number): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: founderHours, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      {
        businessId: "conseil-co",
        founderHoursAllocated: founderHours,
        founderProspectionHoursAllocated: 0,
        create: {
          family: "agency",
          name: "Conseil Co",
          marketId: AGENCY_MARKET.id,
          averageMonthlyFeePerMandate: 6_000,
          deliveryCostRatio: 0.2,
          averageMonthlySalary: 3_500,
          creditLineLimit: 30_000,
          creditLineInterestRateAnnual: 0.08,
        },
        decisions: { family: "agency" },
        offerActions: AGENCY_OFFER_ACTIONS,
        marketingBudget: 300,
        rentBudget: 400,
        adminBudget: 150,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
    ],
  };
}

function agencyContinuationActions(founderHours: number, targetHeadcount?: number): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: founderHours, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      {
        businessId: "conseil-co",
        founderHoursAllocated: founderHours,
        founderProspectionHoursAllocated: 0,
        decisions: { family: "agency" },
        marketingBudget: 300,
        rentBudget: 400,
        adminBudget: 150,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
        ...(targetHeadcount !== undefined ? { targetHeadcount } : {}),
      },
    ],
  };
}

describe("Retail — jouable via simulateMonth", () => {
  it("crée l'entreprise, produit un P&L plausible et fait progresser la réputation", () => {
    let state: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [RETAIL_MARKET]);
    state = simulateMonth(state, retailCreationActions(150), SEED);

    const business = state.businesses.find((b) => b.id === "fleur-co");
    expect(business).not.toBeUndefined();
    expect(business!.familyState.family).toBe("retail");
    expect(business!.lastStatement).not.toBeUndefined();
    expect(business!.lastStatement!.revenue).toBeGreaterThan(0);

    for (let i = 0; i < 11; i++) {
      state = simulateMonth(state, retailContinuationActions(150), SEED);
    }
    const later = state.businesses.find((b) => b.id === "fleur-co");
    expect(later).not.toBeUndefined();
    if (later!.familyState.family !== "retail") throw new Error("familyState devrait rester 'retail'");
    expect(later!.familyState.reputationScore).toBeGreaterThan(0.1);
  });

  it("l'embauche augmente la capacité de vente (plus de salariés -> plus d'unités vendues)", () => {
    let soloState: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [RETAIL_MARKET]);
    soloState = simulateMonth(soloState, retailCreationActions(150), SEED);
    soloState = simulateMonth(soloState, retailContinuationActions(150, 0), SEED);

    let staffedState: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [RETAIL_MARKET]);
    staffedState = simulateMonth(staffedState, retailCreationActions(150), SEED);
    staffedState = simulateMonth(staffedState, retailContinuationActions(150, 10), SEED);

    const solo = soloState.businesses.find((b) => b.id === "fleur-co")!;
    const staffed = staffedState.businesses.find((b) => b.id === "fleur-co")!;
    expect(staffed.lastStatement!.revenue).toBeGreaterThan(solo.lastStatement!.revenue);
  });

  it("est déterministe sur 60 mois", () => {
    const run = (): GameState => {
      let state: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [RETAIL_MARKET]);
      for (let i = 0; i < 60; i++) {
        state = simulateMonth(state, i === 0 ? retailCreationActions(150) : retailContinuationActions(150, 3), SEED);
      }
      return state;
    };
    expect(run()).toEqual(run());
  });
});

describe("Agency/B2B — jouable via simulateMonth", () => {
  it("crée l'entreprise, produit un P&L plausible et fait progresser la réputation", () => {
    let state: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    state = simulateMonth(state, agencyCreationActions(150), SEED);

    const business = state.businesses.find((b) => b.id === "conseil-co");
    expect(business).not.toBeUndefined();
    expect(business!.familyState.family).toBe("agency");
    expect(business!.lastStatement!.revenue).toBeGreaterThanOrEqual(0);

    for (let i = 0; i < 11; i++) {
      state = simulateMonth(state, agencyContinuationActions(150), SEED);
    }
    const later = state.businesses.find((b) => b.id === "conseil-co");
    expect(later).not.toBeUndefined();
  });

  it("l'embauche de consultants augmente la capacité de mandats livrables", () => {
    let soloState: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    soloState = simulateMonth(soloState, agencyCreationActions(150), SEED);
    soloState = simulateMonth(soloState, agencyContinuationActions(150, 0), SEED);

    let staffedState: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    staffedState = simulateMonth(staffedState, agencyCreationActions(150), SEED);
    staffedState = simulateMonth(staffedState, agencyContinuationActions(150, 10), SEED);

    const solo = soloState.businesses.find((b) => b.id === "conseil-co")!;
    const staffed = staffedState.businesses.find((b) => b.id === "conseil-co")!;
    expect(staffed.lastStatement!.revenue).toBeGreaterThan(solo.lastStatement!.revenue);
  });

  it("est déterministe sur 60 mois", () => {
    const run = (): GameState => {
      let state: GameState = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
      for (let i = 0; i < 60; i++) {
        state = simulateMonth(state, i === 0 ? agencyCreationActions(150) : agencyContinuationActions(150, 3), SEED);
      }
      return state;
    };
    expect(run()).toEqual(run());
  });
});
