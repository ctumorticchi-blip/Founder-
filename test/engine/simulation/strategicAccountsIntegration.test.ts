import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { BusinessAction, GameState, MonthActions } from "../../../src/engine/simulation/types.js";
import { AGENCY_MARKET } from "../../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };

function agencyCreateAction(): BusinessAction {
  return {
    businessId: "conseil-1",
    founderHoursAllocated: 150,
    founderProspectionHoursAllocated: 0,
    create: {
      family: "agency",
      name: "Conseil Plus",
      marketId: AGENCY_MARKET.id,
      averageMonthlyFeePerMandate: 6_000,
      deliveryCostRatio: 0.4,
      averageMonthlySalary: 3_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    },
    decisions: { family: "agency" },
    offerActions: [
      {
        kind: "create",
        spec: {
          // "service-hours" a un seuil de lancement de 0% (offer.ts) : lancement
          // immédiat sans développement préalable, pour isoler l'effet testé ici
          // (apparition d'opportunités) de la mécanique de développement d'offre.
          id: "offer-1",
          name: "Mandat conseil",
          businessModel: "service-hours",
          positioning: "premium",
          targetSegment: "agency-grands-comptes",
          price: 8_000,
        },
      },
      { kind: "launch", offerId: "offer-1" },
    ],
    marketingBudget: 0,
    rentBudget: 0,
    adminBudget: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
  };
}

function monthActions(businessId: string, existing: boolean): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      existing
        ? {
            businessId,
            founderHoursAllocated: 150,
            founderProspectionHoursAllocated: 0,
            decisions: { family: "agency" },
            offerActions: [],
            marketingBudget: 0,
            rentBudget: 0,
            adminBudget: 0,
            headcountCapacity: Number.POSITIVE_INFINITY,
            storageCapacity: Number.POSITIVE_INFINITY,
          }
        : agencyCreateAction(),
    ],
  };
}

describe("Strategic Account Opportunities — intégration mensuelle (spec M11.2.4.1 §15)", () => {
  it("une entreprise fraîchement créée porte strategicAccounts:[] et strategicAccountOpportunities toujours un tableau (jamais undefined)", () => {
    const state = createInitialGameState(1, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    const next = simulateMonth(state, monthActions("conseil-1", false), 1);
    const business = next.businesses[0]!;
    expect(business.strategicAccounts).toEqual([]);
    expect(Array.isArray(business.strategicAccountOpportunities)).toBe(true);
    expect(business.strategicAccountOpportunities.length).toBeLessThanOrEqual(1);
  });

  it("des opportunités finissent par apparaître sur un horizon suffisant, jamais de doublon d'id, jamais de conversion en compte confirmé", () => {
    let state: GameState = createInitialGameState(2, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    state = simulateMonth(state, monthActions("conseil-1", false), 2);
    for (let month = 0; month < 48; month++) {
      state = simulateMonth(state, monthActions("conseil-1", true), 2);
    }
    const business = state.businesses[0]!;
    expect(business.strategicAccountOpportunities.length).toBeGreaterThan(0);
    expect(business.strategicAccounts).toEqual([]); // Core ne convertit jamais
    const ids = new Set(business.strategicAccountOpportunities.map((o) => o.id));
    expect(ids.size).toBe(business.strategicAccountOpportunities.length);
    for (const o of business.strategicAccountOpportunities) expect(o.status).toBe("researching");
  });

  it("est déterministe : même seed, même déroulé -> mêmes opportunités", () => {
    function run(seed: number) {
      let state: GameState = createInitialGameState(seed, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
      state = simulateMonth(state, monthActions("conseil-1", false), seed);
      for (let month = 0; month < 12; month++) state = simulateMonth(state, monthActions("conseil-1", true), seed);
      return state.businesses[0]!.strategicAccountOpportunities;
    }
    expect(run(5)).toEqual(run(5));
  });
});
