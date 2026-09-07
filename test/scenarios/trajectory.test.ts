import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../src/engine/simulation/game.js";
import { simulateMonth } from "../../src/engine/simulation/simulateMonth.js";
import type { GameState, MonthActions } from "../../src/engine/simulation/types.js";
import type { Market } from "../../src/types/market.js";

/**
 * Tests de trajectoire bout-en-bout (spec P0 §11, critères d'acceptation) :
 * déterminisme sur 120 mois, et deux issues opposées (faillite / succès)
 * produites par le même moteur, sans branche de code dédiée à chaque issue.
 */

const MARKET: Market = {
  id: "nettoyage-local",
  family: "service",
  sizeMonthlyRevenuePotential: 2_000_000,
  growthRateMonthly: 0.008,
  averageMargin: 0.4,
  fragmentation: 0.8,
  competitiveIntensity: 0.25,
  capitalIntensity: 0.1,
  regulation: 0.15,
  innovationRate: 0.1,
  priceSensitivity: 0.4,
  entryBarriers: 0.15,
  cyclicality: 0.2,
};

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 20260906;
const BUSINESS_ID = "clean-co";

function jobAction(wage: number): MonthActions {
  return {
    timeAllocation: { emploi: 140, apprentissage: 10, business: 0, reseau: 10 },
    jobHourlyWage: wage,
    businessActions: [],
  };
}

function healthyBusinessAction(withCreation: boolean): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 10 },
    jobHourlyWage: null,
    businessActions: [
      {
        businessId: BUSINESS_ID,
        founderHoursAllocated: 150,
        ...(withCreation
          ? {
              create: {
                family: "service" as const,
                name: "Clean Co",
                marketId: MARKET.id,
                costPerLaborHour: 8,
                averageMonthlySalary: 2_200,
                creditLineLimit: 15_000,
                creditLineInterestRateAnnual: 0.08,
              },
            }
          : {}),
        // targetHours volontairement très supérieur à la capacité (fondateur
        // seul, sans effectif) : la vente est donc bornée par la capacité,
        // pas par l'effort commercial, ce qui rend le scénario robuste au
        // tirage aléatoire de la part de marché disponible (concurrence).
        decisions: { family: "service" as const, price: 45, targetHours: 1_000 },
        marketingBudget: 300,
        rentBudget: 400,
        adminBudget: 150,
      },
    ],
  };
}

function ruinousBusinessAction(withCreation: boolean): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      {
        businessId: BUSINESS_ID,
        founderHoursAllocated: 150,
        ...(withCreation
          ? {
              create: {
                family: "service" as const,
                name: "Clean Co",
                marketId: MARKET.id,
                costPerLaborHour: 120,
                averageMonthlySalary: 2_000,
                creditLineLimit: 2_000,
                creditLineInterestRateAnnual: 0.1,
              },
            }
          : {}),
        decisions: { family: "service" as const, price: 2, targetHours: 20 },
        marketingBudget: 6_000,
        rentBudget: 6_000,
        adminBudget: 6_000,
      },
    ],
  };
}

function runMonths(
  seed: number,
  buildActions: (monthIndex: number, state: GameState) => MonthActions,
  months: number,
): GameState {
  let state = createInitialGameState(seed, BIRTH_DATE, START_DATE, [MARKET]);
  for (let i = 0; i < months; i++) {
    state = simulateMonth(state, buildActions(i, state), seed);
  }
  return state;
}

function findBusiness(state: GameState) {
  return state.businesses.find((business) => business.id === BUSINESS_ID) ?? null;
}

describe("trajectoire : déterminisme sur 120 mois", () => {
  it("produit un état final strictement identique pour un même (seed, actions)", () => {
    const buildActions = (monthIndex: number): MonthActions =>
      monthIndex < 6 ? jobAction(13) : healthyBusinessAction(monthIndex === 6);

    const runA = runMonths(SEED, buildActions, 120);
    const runB = runMonths(SEED, buildActions, 120);
    expect(runA).toEqual(runB);
  });

  it("simule 120 mois sans crash ni valeur invalide (NaN/Infinity)", () => {
    const buildActions = (monthIndex: number): MonthActions =>
      monthIndex < 6 ? jobAction(13) : healthyBusinessAction(monthIndex === 6);
    const finalState = runMonths(SEED, buildActions, 120);

    expect(Number.isFinite(finalState.character.cash)).toBe(true);
    const business = findBusiness(finalState);
    expect(business === null || Number.isFinite(business.business.treasury.cash)).toBe(true);
  });
});

describe("trajectoire : succès (petit boulot -> business de service -> croissance)", () => {
  it("fait croître la trésorerie de l'entreprise sur la durée avec des décisions saines", () => {
    const buildActions = (monthIndex: number): MonthActions =>
      monthIndex < 6 ? jobAction(13) : healthyBusinessAction(monthIndex === 6);

    const after12MonthsOfBusiness = runMonths(SEED, buildActions, 6 + 12);
    const after60MonthsOfBusiness = runMonths(SEED, buildActions, 6 + 60);

    const business12 = findBusiness(after12MonthsOfBusiness);
    const business60 = findBusiness(after60MonthsOfBusiness);
    expect(business12).not.toBeNull();
    expect(business60).not.toBeNull();

    const netWorth12 = business12!.business.treasury.cash - business12!.business.treasury.creditLine.drawn;
    const netWorth60 = business60!.business.treasury.cash - business60!.business.treasury.creditLine.drawn;
    expect(netWorth60).toBeGreaterThan(netWorth12);
    expect(netWorth60).toBeGreaterThan(0);
  });
});

describe("trajectoire : faillite (mêmes mécaniques, décisions structurellement mauvaises)", () => {
  it("mène à une liquidation forcée précédée d'un signal, sans branche de code dédiée", () => {
    const buildActions = (monthIndex: number): MonthActions => ruinousBusinessAction(monthIndex === 0);

    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [MARKET]);
    let sawWarning = false;
    let liquidated = false;
    for (let month = 0; month < 24; month++) {
      state = simulateMonth(state, buildActions(month), SEED);
      if (state.events.some((e) => e.kind === "cash-crisis-warning")) {
        sawWarning = true;
      }
      if (findBusiness(state) === null && month > 0) {
        liquidated = true;
        break;
      }
    }

    expect(sawWarning).toBe(true);
    expect(liquidated).toBe(true);
    expect(state.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
  });
});
