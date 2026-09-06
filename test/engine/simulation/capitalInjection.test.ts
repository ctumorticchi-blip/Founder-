import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { MonthActions } from "../../../src/engine/simulation/types.js";
import { SERVICE_MARKET } from "../../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 42;

/**
 * "Une trésorerie réellement négative ne doit pas être possible sans
 * mécanisme explicite permettant de la financer" — ces tests vérifient que
 * `simulateMonth` refuse toute dépense (ici, un apport de capital) qui ne
 * peut pas être financée par une source réelle (le cash personnel du
 * joueur), plutôt que de laisser un solde négatif apparaître par magie.
 */
describe("impossibilité de dépenses sans source de financement", () => {
  it("rejette un apport de capital supérieur au cash personnel disponible", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          businessId: "svc",
          founderHoursAllocated: 150,
          create: {
            family: "service",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_000,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "service", price: 40, targetHours: 100 },
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          capitalInjection: 100_000, // le personnage a 0 € en poche
        },
      ],
    };

    expect(() => simulateMonth(state, actions, SEED)).toThrow(RangeError);
  });

  it("accepte un apport couvert par le cash personnel, y compris le salaire du mois même", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 100, apprentissage: 0, business: 50, reseau: 0 },
      jobHourlyWage: 20, // génère 2000 ce mois-ci
      businessActions: [
        {
          businessId: "svc",
          founderHoursAllocated: 50,
          create: {
            family: "service",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_000,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "service", price: 40, targetHours: 100 },
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          capitalInjection: 2_000, // exactement le salaire gagné ce mois-ci
        },
      ],
    };

    const next = simulateMonth(state, actions, SEED);
    expect(next.character.cash).toBeCloseTo(0);
    expect(next.events.some((e) => e.kind === "capital-injected")).toBe(true);
  });

  it("plusieurs apports dans des entreprises différentes ne peuvent pas ensemble dépasser le cash personnel", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    // Amène le personnage à 1000 € de cash via un mois de salaire.
    state = simulateMonth(
      state,
      { timeAllocation: { emploi: 100, apprentissage: 0, business: 0, reseau: 0 }, jobHourlyWage: 10, businessActions: [] },
      SEED,
    );
    expect(state.character.cash).toBeCloseTo(1_000);

    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          businessId: "svc-a",
          founderHoursAllocated: 75,
          create: {
            family: "service",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_000,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "service", price: 40, targetHours: 100 },
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          capitalInjection: 600,
        },
        {
          businessId: "svc-b",
          founderHoursAllocated: 75,
          create: {
            family: "service",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_000,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "service", price: 40, targetHours: 100 },
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          capitalInjection: 600, // 600 + 600 > 1000 disponibles
        },
      ],
    };

    expect(() => simulateMonth(state, actions, SEED)).toThrow(RangeError);
  });
});
