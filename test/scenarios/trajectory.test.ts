import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../src/engine/simulation/game.js";
import { simulateMonth } from "../../src/engine/simulation/simulateMonth.js";
import type { MonthActions } from "../../src/engine/simulation/types.js";
import type { GameState } from "../../src/engine/simulation/types.js";
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

function jobAction(wage: number): MonthActions {
  return {
    timeAllocation: { emploi: 140, apprentissage: 10, business: 0, reseau: 10 },
    jobHourlyWage: wage,
  };
}

function healthyBusinessAction(withCreation: boolean): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 10 },
    jobHourlyWage: null,
    ...(withCreation ? { createBusiness: { costPerLaborHour: 8 } } : {}),
    businessDecisions: {
      price: 45,
      targetHours: 160,
      marketingBudget: 300,
      rentBudget: 400,
      adminBudget: 150,
      payrollBudget: 0,
    },
  };
}

function ruinousBusinessAction(withCreation: boolean): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
    jobHourlyWage: null,
    ...(withCreation ? { createBusiness: { costPerLaborHour: 120 } } : {}),
    businessDecisions: {
      price: 2,
      targetHours: 20,
      marketingBudget: 6_000,
      rentBudget: 6_000,
      adminBudget: 6_000,
      payrollBudget: 6_000,
    },
  };
}

function runMonths(seed: number, buildActions: (monthIndex: number, state: GameState) => MonthActions, months: number): GameState {
  let state = createInitialGameState(seed, BIRTH_DATE, START_DATE, MARKET);
  for (let i = 0; i < months; i++) {
    state = simulateMonth(state, buildActions(i, state), seed);
  }
  return state;
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
    expect(finalState.playerBusiness === null || Number.isFinite(finalState.playerBusiness.business.cash)).toBe(true);
  });
});

describe("trajectoire : succès (petit boulot -> business de service -> croissance)", () => {
  it("fait croître la trésorerie de l'entreprise sur la durée avec des décisions saines", () => {
    const buildActions = (monthIndex: number): MonthActions =>
      monthIndex < 6 ? jobAction(13) : healthyBusinessAction(monthIndex === 6);

    const after12MonthsOfBusiness = runMonths(SEED, buildActions, 6 + 12);
    const after60MonthsOfBusiness = runMonths(SEED, buildActions, 6 + 60);

    expect(after12MonthsOfBusiness.playerBusiness).not.toBeNull();
    expect(after60MonthsOfBusiness.playerBusiness).not.toBeNull();
    expect(after60MonthsOfBusiness.playerBusiness!.business.cash).toBeGreaterThan(
      after12MonthsOfBusiness.playerBusiness!.business.cash,
    );
  });
});

describe("trajectoire : faillite (mêmes mécaniques, décisions structurellement mauvaises)", () => {
  it("mène à une liquidation forcée précédée d'un signal, sans branche de code dédiée", () => {
    const buildActions = (monthIndex: number): MonthActions => ruinousBusinessAction(monthIndex === 0);

    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    let sawWarning = false;
    let liquidated = false;
    for (let month = 0; month < 24; month++) {
      state = simulateMonth(state, buildActions(month), SEED);
      if (state.events.some((e) => e.kind === "cash-crisis-warning")) {
        sawWarning = true;
      }
      if (state.playerBusiness === null && month > 0) {
        liquidated = true;
        break;
      }
    }

    expect(sawWarning).toBe(true);
    expect(liquidated).toBe(true);
    expect(state.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
  });
});
