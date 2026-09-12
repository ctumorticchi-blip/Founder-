import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { BusinessAction, GameState, MonthActions } from "../../../src/engine/simulation/types.js";
import type { OfferAction } from "../../../src/types/offer.js";
import { SERVICE_MARKET } from "../../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 20260907;

const CREATE_OFFER: OfferAction = {
  kind: "create",
  spec: { id: "svc-offer", name: "Prestations Svc", businessModel: "service-hours", positioning: "standard", targetSegment: "", price: 60 },
};
const LAUNCH_OFFER: OfferAction = { kind: "launch", offerId: "svc-offer" };

function serviceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return {
    businessId: "svc",
    founderHoursAllocated: 140,
    founderProspectionHoursAllocated: 0,
    decisions: { family: "service" },
    marketingBudget: 0,
    rentBudget: 0,
    adminBudget: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

function createInitialAction(): BusinessAction {
  return serviceAction({
    create: {
      family: "service",
      name: "Svc",
      marketId: SERVICE_MARKET.id,
      costPerLaborHour: 5,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    },
    offerActions: [CREATE_OFFER, LAUNCH_OFFER],
  });
}

function monthOf(action: BusinessAction): MonthActions {
  return { timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: null, businessActions: [action] };
}

function playUntilOffer(seed: number, maxMonths = 30): GameState {
  let state = createInitialGameState(seed, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
  state = simulateMonth(state, monthOf(createInitialAction()), seed);
  state = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "list" } })), seed);
  for (let i = 0; i < maxMonths; i++) {
    const business = state.businesses.find((b) => b.id === "svc");
    if (!business) break;
    if (business.saleProcess?.status === "offer-pending") break;
    state = simulateMonth(state, monthOf(serviceAction()), seed);
  }
  return state;
}

describe("processus de cession (spec M11.1.5 §6.2)", () => {
  it("mettre en vente crée un saleProcess 'listed' et un événement business-listed-for-sale", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, monthOf(createInitialAction()), SEED);
    const next = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "list" } })), SEED);
    const business = next.businesses.find((b) => b.id === "svc")!;
    expect(business.saleProcess?.status).toBe("listed");
    expect(next.events.some((e) => e.kind === "business-listed-for-sale")).toBe(true);
  });

  it("est déterministe : même seed -> même déroulé du processus sur plusieurs mois", () => {
    const a = playUntilOffer(SEED);
    const b = playUntilOffer(SEED);
    expect(a).toEqual(b);
  });

  it("une société saine finit par recevoir une offre, avec un événement sale-offer-received", () => {
    const state = playUntilOffer(SEED, 30);
    const business = state.businesses.find((b) => b.id === "svc")!;
    expect(business.saleProcess?.status).toBe("offer-pending");
    expect(business.saleProcess?.currentOffer).not.toBeNull();
    expect(state.events.some((e) => e.kind === "sale-offer-received") || state.memory.some((e) => e.kind === "sale-offer-received")).toBe(true);
  });

  it("accepter une offre transfère le produit net au cash personnel et retire l'entreprise du portefeuille", () => {
    const state = playUntilOffer(SEED, 30);
    const business = state.businesses.find((b) => b.id === "svc")!;
    expect(business.saleProcess?.status).toBe("offer-pending");
    const offerAmount = business.saleProcess!.currentOffer!.amount;
    const cashBefore = state.character.cash;

    const next = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "accept" } })), SEED);

    expect(next.businesses.some((b) => b.id === "svc")).toBe(false); // n'est plus contrôlée
    expect(next.character.cash).toBeGreaterThan(cashBefore);
    expect(next.character.cash).toBeLessThanOrEqual(cashBefore + offerAmount);
    expect(next.events.some((e) => e.kind === "business-sold")).toBe(true);
  });

  it("refuser une offre ne clôture rien et ne touche pas la trésorerie personnelle", () => {
    const state = playUntilOffer(SEED, 30);
    const cashBefore = state.character.cash;
    const next = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "reject" } })), SEED);
    const business = next.businesses.find((b) => b.id === "svc");
    expect(business).not.toBeUndefined();
    expect(business!.saleProcess?.status).toBe("listed");
    expect(business!.saleProcess?.currentOffer).toBeNull();
    expect(next.character.cash).toBeCloseTo(cashBefore, 6);
  });

  it("withdraw retire le processus de cession sans affecter le contrôle de l'entreprise", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, monthOf(createInitialAction()), SEED);
    state = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "list" } })), SEED);
    const next = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "withdraw" } })), SEED);
    const business = next.businesses.find((b) => b.id === "svc");
    expect(business).not.toBeUndefined();
    expect(business!.saleProcess).toBeNull();
  });

  it("une société sans historique n'a pas encore de saleProcess et peut néanmoins continuer à jouer", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const next = simulateMonth(state, monthOf(createInitialAction()), SEED);
    const business = next.businesses.find((b) => b.id === "svc")!;
    expect(business.saleProcess).toBeNull();
  });

  it("une société très mauvaise (déficitaire, endettée) ne reçoit aucune offre sur une longue période (invendable)", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    // costPerLaborHour délibérément énorme -> EBITDA très négatif.
    state = simulateMonth(
      state,
      monthOf(
        serviceAction({
          create: {
            family: "service",
            name: "Bad Co",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 500,
            averageMonthlySalary: 2_000,
            creditLineLimit: 500,
            creditLineInterestRateAnnual: 0.1,
          },
          decisions: { family: "service" },
          marketingBudget: 5_000,
          rentBudget: 5_000,
          adminBudget: 5_000,
        }),
      ),
      SEED,
    );
    state = simulateMonth(state, monthOf(serviceAction({ saleDecision: { action: "list" }, marketingBudget: 5_000, rentBudget: 5_000, adminBudget: 5_000, decisions: { family: "service" } })), SEED);

    for (let i = 0; i < 20; i++) {
      const business = state.businesses.find((b) => b.id === "svc");
      if (!business) break; // liquidée, ce qui est aussi acceptable pour "invendable"
      if (business.saleProcess?.status === "offer-pending") {
        throw new Error("une société très mauvaise ne devrait jamais recevoir d'offre");
      }
      state = simulateMonth(
        state,
        monthOf(serviceAction({ marketingBudget: 5_000, rentBudget: 5_000, adminBudget: 5_000, decisions: { family: "service" } })),
        SEED,
      );
    }
  });
});
