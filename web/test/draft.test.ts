import { describe, expect, it } from "vitest";
import { createInitialGameState, simulateMonth } from "@founder/engine";
import { SERVICE_MARKET } from "@founder/scenarios/markets.js";
import { buildMonthActions, createEmptyDraft, deriveNextDraft, draftValidationError, remainingHours, totalAllocatedHours } from "../src/state/draft";
import type { MonthDraft } from "../src/state/types";

const BIRTH_DATE = { year: 2007, month: 1 };
const START_DATE = { year: 2025, month: 1 };
const SEED = 42;

describe("draft — helpers purs", () => {
  it("createEmptyDraft ne consomme aucune heure", () => {
    const draft = createEmptyDraft();
    expect(totalAllocatedHours(draft)).toBe(0);
    expect(remainingHours(draft)).toBeGreaterThan(0);
  });

  it("buildMonthActions traduit un brouillon sans entreprise en MonthActions minimal", () => {
    const draft: MonthDraft = { timeAllocation: { emploi: 100, apprentissage: 0, business: 0, reseau: 0 }, job: { offerId: "x", label: "X", hourlyWage: 10 }, business: null };
    const actions = buildMonthActions(draft);
    expect(actions.jobHourlyWage).toBe(10);
    expect(actions.businessActions).toEqual([]);
  });

  it("buildMonthActions inclut 'create' uniquement pour une nouvelle entreprise", () => {
    const draft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: {
        businessId: "svc-1",
        family: "service",
        isNew: true,
        createSpec: { family: "service", marketId: SERVICE_MARKET.id, costPerLaborHour: 8, averageMonthlySalary: 2000, creditLineLimit: 10000, creditLineInterestRateAnnual: 0.08 },
        decisions: { family: "service", price: 40, targetHours: 200 },
        marketingBudget: 100,
        rentBudget: 100,
        adminBudget: 50,
        capex: 0,
        targetHeadcount: null,
        capitalInjection: 0,
      },
    };
    const actions = buildMonthActions(draft);
    expect(actions.businessActions).toHaveLength(1);
    expect(actions.businessActions[0]!.create).toBeDefined();
    expect(actions.businessActions[0]!.founderHoursAllocated).toBe(150);
  });

  it("draftValidationError signale un dépassement du budget de temps", () => {
    const draft: MonthDraft = { timeAllocation: { emploi: 100, apprentissage: 40, business: 40, reseau: 0 }, job: null, business: null };
    expect(draftValidationError(draft)).toMatch(/alloué/i);
  });

  it("deriveNextDraft retire l'entreprise du brouillon si elle a été liquidée", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const draft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: {
        businessId: "svc-1",
        family: "service",
        isNew: true,
        createSpec: { family: "service", marketId: SERVICE_MARKET.id, costPerLaborHour: 200, averageMonthlySalary: 2000, creditLineLimit: 100, creditLineInterestRateAnnual: 0.1 },
        decisions: { family: "service", price: 1, targetHours: 10 },
        marketingBudget: 5000,
        rentBudget: 5000,
        adminBudget: 5000,
        capex: 0,
        targetHeadcount: null,
        capitalInjection: 0,
      },
    };
    // Simule une entreprise structurellement déficitaire jusqu'à liquidation.
    let currentDraft = draft;
    for (let i = 0; i < 10 && (i === 0 || state.businesses.length > 0); i++) {
      state = simulateMonth(state, buildMonthActions(currentDraft), SEED);
      currentDraft = deriveNextDraft(currentDraft, state);
    }
    expect(state.businesses).toHaveLength(0);
    expect(currentDraft.business).toBeNull();
    expect(currentDraft.timeAllocation.business).toBe(0);
  });
});
