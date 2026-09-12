import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { BusinessAction, MonthActions } from "../../../src/engine/simulation/types.js";
import type { OfferAction } from "../../../src/types/offer.js";
import { SERVICE_MARKET } from "../../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 4242;
const BUSINESS_TIME = 140;

function serviceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return {
    businessId: "svc",
    founderHoursAllocated: BUSINESS_TIME,
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

function createInitialAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return serviceAction({
    create: {
      family: "service",
      name: "Svc",
      marketId: SERVICE_MARKET.id,
      costPerLaborHour: 5,
      averageMonthlySalary: 2_000,
      creditLineLimit: 200_000,
      creditLineInterestRateAnnual: 0.08,
    },
    ...overrides,
  });
}

function actionsFor(businessActions: readonly BusinessAction[], business = BUSINESS_TIME): MonthActions {
  return { timeAllocation: { emploi: 0, apprentissage: 0, business, reseau: 0 }, jobHourlyWage: null, businessActions };
}

const createOfferAction: OfferAction = {
  kind: "create",
  spec: { id: "svc-offer-1", name: "Nettoyage Premium", businessModel: "unit-sale", positioning: "standard", targetSegment: "Particuliers", price: 30 },
};

describe("intégration Offer Engine dans simulateMonth (spec M11.2 §3.3)", () => {
  it("une action develop réduit l'EBITDA/le cash du montant du budget investi ce mois-ci", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, actionsFor([createInitialAction({ offerActions: [createOfferAction] })]), SEED);

    const before = state.businesses.find((b) => b.id === "svc")!;
    expect(before.business.offers).toHaveLength(1);
    expect(before.business.offers[0]!.maturity).toBe(0);

    const developAction: OfferAction = { kind: "develop", offerId: "svc-offer-1", hours: 20, budget: 5_000 };
    const next = simulateMonth(state, actionsFor([serviceAction({ founderHoursAllocated: BUSINESS_TIME - 20, offerActions: [developAction] })]), SEED);

    const after = next.businesses.find((b) => b.id === "svc")!;
    expect(after.business.offers[0]!.maturity).toBeGreaterThan(0);
    expect(after.lastStatement!.admin).toBeGreaterThanOrEqual(5_000);
  });

  it("des heures de développement qui dépassent le temps « business » restant sont rejetées (mois atomique)", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, actionsFor([createInitialAction({ offerActions: [createOfferAction] })]), SEED);

    const overBudget: OfferAction = { kind: "develop", offerId: "svc-offer-1", hours: 200, budget: 0 };
    const actions = actionsFor([serviceAction({ founderHoursAllocated: 100, offerActions: [overBudget] })]);
    expect(() => simulateMonth(state, actions, SEED)).toThrow(RangeError);
  });

  it("un lancement prématuré lève une RangeError sans jamais exposer l'id technique de l'offre", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, actionsFor([createInitialAction({ offerActions: [createOfferAction] })]), SEED);

    const launch: OfferAction = { kind: "launch", offerId: "svc-offer-1" };
    try {
      simulateMonth(state, actionsFor([serviceAction({ offerActions: [launch] })]), SEED);
      expect.fail("devait lever une RangeError");
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      const message = (error as Error).message;
      expect(message).toContain("Nettoyage Premium");
      expect(message).not.toContain("svc-offer-1");
    }
  });

  it("une offre service-hours se lance immédiatement, ce qui fixe un prix consommable le mois suivant", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const create: OfferAction = {
      kind: "create",
      spec: { id: "svc-offer-2", name: "Consulting", businessModel: "service-hours", positioning: "standard", targetSegment: "PME", price: 80 },
    };
    state = simulateMonth(state, actionsFor([createInitialAction({ offerActions: [create] })]), SEED);

    const launch: OfferAction = { kind: "launch", offerId: "svc-offer-2" };
    const next = simulateMonth(state, actionsFor([serviceAction({ offerActions: [launch] })]), SEED);
    const business = next.businesses.find((b) => b.id === "svc")!;
    expect(business.business.offers[0]!.status).toBe("launched");
    expect(business.business.offers[0]!.launchedAt).toEqual(next.date);
  });

  it("deux offres sur la même entreprise progressent indépendamment le même mois", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const createA: OfferAction = {
      kind: "create",
      spec: { id: "svc-offer-a", name: "Offre A", businessModel: "unit-sale", positioning: "standard", targetSegment: "A", price: 10 },
    };
    const createB: OfferAction = {
      kind: "create",
      spec: { id: "svc-offer-b", name: "Offre B", businessModel: "project", positioning: "premium", targetSegment: "B", price: 500 },
    };
    state = simulateMonth(state, actionsFor([createInitialAction({ offerActions: [createA, createB] })]), SEED);

    const developA: OfferAction = { kind: "develop", offerId: "svc-offer-a", hours: 10, budget: 100 };
    const developB: OfferAction = { kind: "develop", offerId: "svc-offer-b", hours: 5, budget: 50 };
    const next = simulateMonth(state, actionsFor([serviceAction({ founderHoursAllocated: BUSINESS_TIME - 15, offerActions: [developA, developB] })]), SEED);
    const business = next.businesses.find((b) => b.id === "svc")!;
    expect(business.business.offers).toHaveLength(2);
    const offerA = business.business.offers.find((o) => o.id === "svc-offer-a")!;
    const offerB = business.business.offers.find((o) => o.id === "svc-offer-b")!;
    expect(offerA.maturity).toBeGreaterThan(0);
    expect(offerB.maturity).toBeGreaterThan(0);
    expect(offerA.developmentHoursInvested).toBe(10);
    expect(offerB.developmentHoursInvested).toBe(5);
  });

  it("deux entreprises différentes du portefeuille développent chacune leur offre sans interférence", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const createSecond: BusinessAction = serviceAction({
      businessId: "svc2",
      create: {
        family: "service",
        name: "Svc 2",
        marketId: SERVICE_MARKET.id,
        costPerLaborHour: 5,
        averageMonthlySalary: 2_000,
        creditLineLimit: 200_000,
        creditLineInterestRateAnnual: 0.08,
      },
      founderHoursAllocated: 0,
    });
    state = simulateMonth(
      state,
      actionsFor([createInitialAction({ offerActions: [createOfferAction] }), createSecond], BUSINESS_TIME),
      SEED,
    );

    const createOther: OfferAction = {
      kind: "create",
      spec: { id: "svc2-offer-1", name: "Offre Svc2", businessModel: "unit-sale", positioning: "standard", targetSegment: "X", price: 5 },
    };
    const developFirst: OfferAction = { kind: "develop", offerId: "svc-offer-1", hours: 10, budget: 100 };
    const next = simulateMonth(
      state,
      actionsFor(
        [
          serviceAction({ founderHoursAllocated: BUSINESS_TIME - 10, offerActions: [developFirst] }),
          serviceAction({ businessId: "svc2", founderHoursAllocated: 0, offerActions: [createOther] }),
        ],
        BUSINESS_TIME,
      ),
      SEED,
    );

    const svc = next.businesses.find((b) => b.id === "svc")!;
    const svc2 = next.businesses.find((b) => b.id === "svc2")!;
    expect(svc.business.offers[0]!.maturity).toBeGreaterThan(0);
    expect(svc2.business.offers).toHaveLength(1);
    expect(svc2.business.offers[0]!.id).toBe("svc2-offer-1");
  });

  it("progression déterministe sur plusieurs mois consécutifs (même seed, même trajectoire)", () => {
    function playThreeMonths(): number {
      let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
      state = simulateMonth(state, actionsFor([createInitialAction({ offerActions: [createOfferAction] })]), SEED);
      for (let i = 0; i < 3; i += 1) {
        const develop: OfferAction = { kind: "develop", offerId: "svc-offer-1", hours: 15, budget: 200 };
        state = simulateMonth(state, actionsFor([serviceAction({ founderHoursAllocated: BUSINESS_TIME - 15, offerActions: [develop] })]), SEED);
      }
      return state.businesses.find((b) => b.id === "svc")!.business.offers[0]!.maturity;
    }
    expect(playThreeMonths()).toBe(playThreeMonths());
  });
});
