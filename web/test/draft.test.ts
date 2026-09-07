import { describe, expect, it } from "vitest";
import { createInitialGameState, simulateMonth } from "@founder/engine";
import { SERVICE_MARKET } from "@founder/scenarios/markets.js";
import { buildMonthActions, createEmptyDraft, deriveNextDraft, draftValidationError, remainingHours, totalAllocatedHours } from "../src/state/draft";
import type { BusinessDraft, MonthDraft } from "../src/state/types";

const BIRTH_DATE = { year: 2007, month: 1 };
const START_DATE = { year: 2025, month: 1 };
const SEED = 42;

function makeBusinessDraft(overrides: Partial<BusinessDraft> = {}): BusinessDraft {
  return {
    businessId: "svc-1",
    family: "service",
    isNew: true,
    createSpec: {
      family: "service",
      name: "Svc Co",
      marketId: SERVICE_MARKET.id,
      costPerLaborHour: 8,
      averageMonthlySalary: 2000,
      creditLineLimit: 10000,
      creditLineInterestRateAnnual: 0.08,
    },
    name: "Svc Co",
    description: "Une petite société de service.",
    activity: "Service aux particuliers",
    targetCustomers: "Particuliers",
    decisions: { family: "service", price: 40, targetHours: 200 },
    marketingBudget: 100,
    infrastructureId: "domicile",
    adminOptionalIds: [],
    purchases: [],
    targetHeadcount: null,
    capitalInjection: 0,
    ...overrides,
  };
}

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
      business: makeBusinessDraft(),
    };
    const actions = buildMonthActions(draft);
    expect(actions.businessActions).toHaveLength(1);
    expect(actions.businessActions[0]!.create).toBeDefined();
    expect(actions.businessActions[0]!.founderHoursAllocated).toBe(150);
  });

  it("buildMonthActions calcule rentBudget/adminBudget à partir des catalogues choisis, pas de nombres bruts", () => {
    const draft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: makeBusinessDraft({ infrastructureId: "coworking", adminOptionalIds: ["logiciels"] }),
    };
    const actions = buildMonthActions(draft);
    const action = actions.businessActions[0]!;
    expect(action.rentBudget).toBe(250); // coworking
    expect(action.adminBudget).toBe(190 + 60); // requis + logiciels
  });

  it("buildMonthActions inclut le coût d'installation dans capex uniquement au mois de création", () => {
    const creationDraft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: makeBusinessDraft({ isNew: true, infrastructureId: "petit-bureau", purchases: [] }),
    };
    const creationActions = buildMonthActions(creationDraft);
    expect(creationActions.businessActions[0]!.capex).toBe(2_000); // setupCost du petit bureau

    const continuationDraft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: makeBusinessDraft({ isNew: false, createSpec: null, infrastructureId: "petit-bureau", purchases: [] }),
    };
    const continuationActions = buildMonthActions(continuationDraft);
    expect(continuationActions.businessActions[0]!.capex).toBeUndefined();
  });

  it("buildMonthActions additionne les achats du mois au capex", () => {
    const draft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: makeBusinessDraft({
        isNew: false,
        createSpec: null,
        infrastructureId: "domicile",
        purchases: [{ itemId: "ordinateur", quantity: 1 }],
      }),
    };
    const actions = buildMonthActions(draft);
    expect(actions.businessActions[0]!.capex).toBe(1_200);
  });

  it("draftValidationError signale un dépassement du budget de temps", () => {
    const draft: MonthDraft = { timeAllocation: { emploi: 100, apprentissage: 40, business: 40, reseau: 0 }, job: null, business: null };
    expect(draftValidationError(draft)).toMatch(/alloué/i);
  });

  it("deriveNextDraft remet les achats à zéro chaque mois (corrige le bug latent §1.5 de la spec)", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const previousDraft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: makeBusinessDraft({
        isNew: false,
        createSpec: null,
        purchases: [{ itemId: "ordinateur", quantity: 3 }],
        infrastructureId: "coworking",
        adminOptionalIds: ["logiciels"],
      }),
    };
    // On simule le mois précédent pour que l'entreprise existe déjà dans nextState.
    const created = simulateMonth(
      state,
      buildMonthActions({ ...previousDraft, business: makeBusinessDraft({ purchases: [] }) }),
      SEED,
    );
    const nextDraft = deriveNextDraft(previousDraft, created);
    expect(nextDraft.business).not.toBeNull();
    expect(nextDraft.business!.purchases).toEqual([]);
    // Les décisions durables (infra/admin) sont conservées, elles.
    expect(nextDraft.business!.infrastructureId).toBe("coworking");
    expect(nextDraft.business!.adminOptionalIds).toEqual(["logiciels"]);
  });

  it("deriveNextDraft retire l'entreprise du brouillon si elle a été liquidée", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const draft: MonthDraft = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      job: null,
      business: makeBusinessDraft({
        createSpec: {
          family: "service",
          name: "Svc Co",
          marketId: SERVICE_MARKET.id,
          costPerLaborHour: 200,
          averageMonthlySalary: 2000,
          creditLineLimit: 100,
          creditLineInterestRateAnnual: 0.1,
        },
        decisions: { family: "service", price: 1, targetHours: 10 },
        marketingBudget: 5000,
        infrastructureId: "bureau-intermediaire",
        adminOptionalIds: ["logiciels", "conformite"],
      }),
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
