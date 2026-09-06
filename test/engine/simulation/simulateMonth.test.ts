import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { MonthActions } from "../../../src/engine/simulation/types.js";
import type { Market } from "../../../src/types/market.js";

const MARKET: Market = {
  id: "nettoyage-local",
  family: "service",
  sizeMonthlyRevenuePotential: 500_000,
  growthRateMonthly: 0.01,
  averageMargin: 0.4,
  fragmentation: 0.8,
  competitiveIntensity: 0.3,
  capitalIntensity: 0.1,
  regulation: 0.2,
  innovationRate: 0.1,
  priceSensitivity: 0.5,
  entryBarriers: 0.2,
  cyclicality: 0.3,
};

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 12345;

const JOB_ONLY_ACTIONS: MonthActions = {
  timeAllocation: { emploi: 140, apprentissage: 10, business: 0, reseau: 10 },
  jobHourlyWage: 12,
};

describe("simulateMonth", () => {
  it("avance la date d'un mois", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const next = simulateMonth(state, JOB_ONLY_ACTIONS, SEED);
    expect(next.date).toEqual({ year: 2026, month: 2 });
  });

  it("est déterministe : mêmes state+actions+seed -> même résultat", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const a = simulateMonth(state, JOB_ONLY_ACTIONS, SEED);
    const b = simulateMonth(state, JOB_ONLY_ACTIONS, SEED);
    expect(a).toEqual(b);
  });

  it("ne mute pas le state d'origine", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const snapshot = JSON.stringify(state);
    simulateMonth(state, JOB_ONLY_ACTIONS, SEED);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("un emploi génère du cash proportionnel aux heures allouées", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const next = simulateMonth(state, JOB_ONLY_ACTIONS, SEED);
    expect(next.character.cash).toBeCloseTo(12 * 140);
  });

  it("émet un événement 'job-started' la première fois seulement", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const month1 = simulateMonth(state, JOB_ONLY_ACTIONS, SEED);
    expect(month1.events.some((e) => e.kind === "job-started")).toBe(true);

    const month2 = simulateMonth(month1, JOB_ONLY_ACTIONS, SEED);
    expect(month2.events.some((e) => e.kind === "job-started")).toBe(false);
  });

  it("rejette une allocation de temps invalide (budget dépassé)", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const badActions: MonthActions = {
      timeAllocation: { emploi: 200, apprentissage: 0, business: 0, reseau: 0 },
      jobHourlyWage: 12,
    };
    expect(() => simulateMonth(state, badActions, SEED)).toThrow();
  });

  it("crée une entreprise et exige businessDecisions le même mois", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      createBusiness: { costPerLaborHour: 5 },
      businessDecisions: {
        price: 30,
        targetHours: 100,
        marketingBudget: 100,
        rentBudget: 200,
        adminBudget: 50,
        payrollBudget: 0,
      },
    };
    const next = simulateMonth(state, actions, SEED);
    expect(next.playerBusiness).not.toBeNull();
    expect(next.events.some((e) => e.kind === "business-created")).toBe(true);
    expect(next.memory.some((e) => e.kind === "business-created")).toBe(true);
  });

  it("rejette createBusiness si une entreprise existe déjà", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const createActions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      createBusiness: { costPerLaborHour: 5 },
      businessDecisions: {
        price: 30,
        targetHours: 100,
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        payrollBudget: 0,
      },
    };
    const withBusiness = simulateMonth(state, createActions, SEED);
    expect(() => simulateMonth(withBusiness, createActions, SEED)).toThrow(RangeError);
  });

  it("rejette businessDecisions sans entreprise existante ni création", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const actions: MonthActions = {
      timeAllocation: { emploi: 140, apprentissage: 0, business: 0, reseau: 0 },
      jobHourlyWage: 12,
      businessDecisions: {
        price: 30,
        targetHours: 100,
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        payrollBudget: 0,
      },
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow(RangeError);
  });

  it("rejette une entreprise active sans businessDecisions ce mois-ci", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const createActions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      createBusiness: { costPerLaborHour: 5 },
      businessDecisions: {
        price: 30,
        targetHours: 100,
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        payrollBudget: 0,
      },
    };
    const withBusiness = simulateMonth(state, createActions, SEED);
    expect(() =>
      simulateMonth(withBusiness, { timeAllocation: JOB_ONLY_ACTIONS.timeAllocation, jobHourlyWage: 12 }, SEED),
    ).toThrow(RangeError);
  });

  it("une entreprise structurellement déficitaire finit par être liquidée après un signal (spec §3.7)", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, MARKET);
    const createActions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      createBusiness: { costPerLaborHour: 100 },
      businessDecisions: {
        price: 1,
        targetHours: 10,
        marketingBudget: 5_000,
        rentBudget: 5_000,
        adminBudget: 5_000,
        payrollBudget: 5_000,
      },
    };
    state = simulateMonth(state, createActions, SEED);

    const ruinousActions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessDecisions: createActions.businessDecisions,
    };

    let sawWarning = false;
    for (let month = 0; month < 10 && state.playerBusiness; month++) {
      state = simulateMonth(state, ruinousActions, SEED);
      if (state.events.some((e) => e.kind === "cash-crisis-warning")) {
        sawWarning = true;
      }
    }

    expect(state.playerBusiness).toBeNull();
    expect(sawWarning).toBe(true);
    expect(state.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
  });
});
