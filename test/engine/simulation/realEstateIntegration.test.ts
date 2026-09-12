import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import type { BusinessAction, MonthActions } from "../../../src/engine/simulation/types.js";
import type { OfferAction } from "../../../src/types/offer.js";
import { SERVICE_MARKET } from "../../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 909;

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
      creditLineLimit: 200_000,
      creditLineInterestRateAnnual: 0.08,
    },
    offerActions: [CREATE_OFFER, LAUNCH_OFFER],
  });
}

describe("achat immobilier professionnel (spec M11.1.5 §4)", () => {
  it("refuse l'achat le mois de création (aucun historique financier)", () => {
    const state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          ...createInitialAction(),
          propertyPurchase: { purchasePrice: 100_000, monthlyMaintenance: 200, downPaymentFromPersonalCash: 0, mortgageTermMonths: 120, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 },
        },
      ],
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow(/historique/i);
  });

  it("achète le bien à crédit (sans apport) et l'ajoute à properties", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, { timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: null, businessActions: [createInitialAction()] }, SEED);

    const businessBefore = state.businesses.find((b) => b.id === "svc")!;
    expect(businessBefore.lastStatement).not.toBeUndefined();
    const cashBefore = businessBefore.business.treasury.cash;

    const purchaseActions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        serviceAction({
          propertyPurchase: { purchasePrice: 5_000, monthlyMaintenance: 50, downPaymentFromPersonalCash: 0, mortgageTermMonths: 60, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 },
        }),
      ],
    };
    const next = simulateMonth(state, purchaseActions, SEED);
    const businessAfter = next.businesses.find((b) => b.id === "svc")!;

    expect(businessAfter.business.properties).toHaveLength(1);
    expect(businessAfter.business.properties[0]!.purchasePrice).toBe(5_000);
    expect(businessAfter.business.properties[0]!.mortgage).not.toBeNull();
    expect(businessAfter.business.properties[0]!.mortgage!.originalPrincipal).toBe(5_000);
    expect(next.events.some((e) => e.kind === "property-purchased")).toBe(true);
    expect(cashBefore).toBeGreaterThanOrEqual(0);
  });

  it("refuse un apport supérieur au cash personnel disponible", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, { timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: null, businessActions: [createInitialAction()] }, SEED);

    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        serviceAction({
          propertyPurchase: { purchasePrice: 500_000, monthlyMaintenance: 500, downPaymentFromPersonalCash: 500_000, mortgageTermMonths: 120, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 },
        }),
      ],
    };
    expect(() => simulateMonth(state, actions, SEED)).toThrow(RangeError);
  });

  it("un apport personnel finançable réduit le cash personnel exactement du montant de l'apport", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    // Un mois d'emploi à côté de l'entreprise pour constituer du cash personnel.
    state = simulateMonth(
      state,
      { timeAllocation: { emploi: 20, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: 100, businessActions: [createInitialAction()] },
      SEED,
    );
    expect(state.character.cash).toBeCloseTo(2_000, 6);

    const next = simulateMonth(
      state,
      {
        timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
        jobHourlyWage: null,
        businessActions: [
          serviceAction({
            propertyPurchase: { purchasePrice: 1_500, monthlyMaintenance: 50, downPaymentFromPersonalCash: 1_500, mortgageTermMonths: 60, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 },
          }),
        ],
      },
      SEED,
    );
    expect(next.character.cash).toBeCloseTo(500, 6);
    const business = next.businesses.find((b) => b.id === "svc")!;
    expect(business.business.properties[0]!.mortgage).toBeNull(); // apport = prix total
  });

  it("le principal restant dû décroît sur plusieurs mois et la maintenance apparaît dans le compte de résultat", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    state = simulateMonth(state, { timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: null, businessActions: [createInitialAction()] }, SEED);

    state = simulateMonth(
      state,
      {
        timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 },
        jobHourlyWage: null,
        businessActions: [
          serviceAction({
            propertyPurchase: { purchasePrice: 50_000, monthlyMaintenance: 100, downPaymentFromPersonalCash: 0, mortgageTermMonths: 60, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 },
          }),
        ],
      },
      SEED,
    );
    const afterPurchase = state.businesses.find((b) => b.id === "svc")!;
    expect(afterPurchase.business.properties[0]!.mortgage).not.toBeNull();
    const principalAfterPurchase = afterPurchase.business.properties[0]!.mortgage!.principalRemaining;

    state = simulateMonth(state, { timeAllocation: { emploi: 0, apprentissage: 0, business: 140, reseau: 0 }, jobHourlyWage: null, businessActions: [serviceAction()] }, SEED);
    const afterOneMonth = state.businesses.find((b) => b.id === "svc")!;
    expect(afterOneMonth.business.properties[0]!.mortgage!.principalRemaining).toBeLessThan(principalAfterPurchase);
    expect(afterOneMonth.lastStatement!.admin).toBeGreaterThan(0);
    expect(afterOneMonth.business.properties).toHaveLength(1); // persiste, ne disparaît pas
  });
});
