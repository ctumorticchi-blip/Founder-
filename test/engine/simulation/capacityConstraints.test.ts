import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { BusinessAction, MonthActions } from "../../../src/engine/simulation/types.js";
import { SERVICE_MARKET, RETAIL_MARKET } from "../../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 4242;

function serviceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return {
    businessId: "svc",
    founderHoursAllocated: 140,
    founderProspectionHoursAllocated: 0,
    create: {
      family: "service",
      name: "Svc",
      marketId: SERVICE_MARKET.id,
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    },
    decisions: { family: "service" },
    marketingBudget: 0,
    rentBudget: 0,
    adminBudget: 0,
    headcountCapacity: 4,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

/** Action de continuation (l'entreprise existe déjà) : jamais de champ `create`. */
function continuationServiceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  const { create, ...base } = serviceAction();
  void create;
  return { ...base, ...overrides };
}

describe("capacité d'infrastructure — recrutement (spec M11.1.5 §3.2)", () => {
  it("impossible de recruter au-delà de la capacité physique : rejet explicite avec message actionnable", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ targetHeadcount: 5, headcountCapacity: 4 })],
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow(/capacité atteinte/i);
    expect(() => simulateMonth(state, actions, SEED)).toThrow(/4/);
  });

  it("recruter exactement à la capacité (borne inclusive) est accepté", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ targetHeadcount: 4, headcountCapacity: 4 })],
    };
    const next = simulateMonth(state, actions, SEED);
    expect(next.businesses[0]!.workforce.headcount).toBe(4);
  });

  it("agrandir les locaux (capacité augmentée le mois suivant) débloque le recrutement précédemment refusé", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(
      state,
      { timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: null, businessActions: [serviceAction({ headcountCapacity: 4 })] },
      SEED,
    );

    const blocked: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [continuationServiceAction({ targetHeadcount: 8, headcountCapacity: 4 })],
    };
    expect(() => simulateMonth(state, blocked, SEED)).toThrow(RangeError);

    const expanded: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [continuationServiceAction({ targetHeadcount: 8, headcountCapacity: 25 })],
    };
    const next = simulateMonth(state, expanded, SEED);
    expect(next.businesses[0]!.workforce.headcount).toBe(8);
  });

  it("un rejet de capacité n'altère aucun état (simulateMonth atomique : le state reste intact)", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ targetHeadcount: 5, headcountCapacity: 4 })],
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow();
    expect(state.businesses).toHaveLength(0);
  });
});

describe("capacité de stockage — retail (spec M11.1.5 §3.2)", () => {
  function retailAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
    return {
      businessId: "shop",
      founderHoursAllocated: 140,
      founderProspectionHoursAllocated: 0,
      create: {
        family: "retail",
        name: "Shop",
        marketId: RETAIL_MARKET.id,
        unitCostOfGoods: 6,
        averageMonthlySalary: 1_800,
        creditLineLimit: 10_000,
        creditLineInterestRateAnnual: 0.08,
      },
      decisions: { family: "retail", stockUnits: 500 },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: 200,
      ...overrides,
    };
  }

  it("un stock demandé au-delà de la capacité de stockage est rejeté explicitement", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [RETAIL_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [retailAction({ decisions: { family: "retail", stockUnits: 500 }, storageCapacity: 200 })],
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow(/capacité de stockage/i);
  });

  it("un stock dans la limite de stockage est accepté", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [RETAIL_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [retailAction({ decisions: { family: "retail", stockUnits: 150 }, storageCapacity: 200 })],
    };
    expect(() => simulateMonth(state, actions, SEED)).not.toThrow();
  });

  it("les familles non-retail ignorent storageCapacity, jamais de rejet inattendu", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ storageCapacity: 0 })],
    };
    expect(() => simulateMonth(state, actions, SEED)).not.toThrow();
  });
});

describe("budget de temps fondateur — production + prospection (spec M11.1.5 §7.2)", () => {
  it("rejette une somme production + prospection dépassant le temps 'business' alloué", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 100, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ founderHoursAllocated: 60, founderProspectionHoursAllocated: 50 })], // 110 > 100
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow(/production \+ prospection/i);
  });

  it("accepte une somme production + prospection exactement au budget", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 100, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ founderHoursAllocated: 60, founderProspectionHoursAllocated: 40 })],
    };
    expect(() => simulateMonth(state, actions, SEED)).not.toThrow();
  });
});

describe("note narrative générique (spec M11.1.5 §3.3)", () => {
  it("un 'note' fourni produit un GameEvent business-note avec le message exact", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction({ note: "Déménagement vers Coworking" })],
    };
    const next = simulateMonth(state, actions, SEED);
    const noteEvent = next.events.find((e) => e.kind === "business-note");
    expect(noteEvent?.message).toBe("Déménagement vers Coworking");
  });

  it("sans 'note', aucun événement business-note n'est produit", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [serviceAction()],
    };
    const next = simulateMonth(state, actions, SEED);
    expect(next.events.some((e) => e.kind === "business-note")).toBe(false);
  });
});
