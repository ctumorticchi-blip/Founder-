import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../src/engine/simulation/game.js";
import { simulateMonth } from "../../src/engine/simulation/simulateMonth.js";
import type { MonthActions } from "../../src/engine/simulation/types.js";
import {
  AGENCY_MARKET,
  HOSPITALITY_MARKET,
  RETAIL_MARKET,
  SERVICE_MARKET,
  SUBSCRIPTION_MARKET,
} from "../../src/scenarios/markets.js";

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };
const SEED = 555;

/**
 * Le portefeuille du joueur n'est plus limité à une seule entreprise
 * (consolidation, tâche 3). Ces tests font tourner 2-3 entreprises de
 * familles différentes simultanément avec le même `simulateMonth`.
 */
describe("multi-entreprises", () => {
  it("fait tourner 3 entreprises de familles différentes en parallèle, chacune avec ses propres finances", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET, HOSPITALITY_MARKET, SUBSCRIPTION_MARKET]);

    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          businessId: "svc",
          founderHoursAllocated: 50,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "service",
            name: "Svc",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_000,
            creditLineLimit: 20_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "service" },
          marketingBudget: 100,
          rentBudget: 200,
          adminBudget: 50,
        },
        {
          businessId: "resto",
          founderHoursAllocated: 50,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "hospitality",
            name: "Resto",
            marketId: HOSPITALITY_MARKET.id,
            foodCostPerCover: 9,
            averageMonthlySalary: 2_000,
            creditLineLimit: 60_000,
            creditLineInterestRateAnnual: 0.09,
          },
          decisions: { family: "hospitality" },
          marketingBudget: 200,
          rentBudget: 1_000,
          adminBudget: 100,
          targetHeadcount: 3,
          capex: 20_000,
        },
        {
          businessId: "saas",
          founderHoursAllocated: 50,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "subscription",
            name: "Saas",
            marketId: SUBSCRIPTION_MARKET.id,
            arpu: 29,
            churnRateBase: 0.04,
            cogsRatio: 0.2,
            initialActiveSubscribers: 0,
            averageMonthlySalary: 3_000,
            creditLineLimit: 20_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "subscription" },
          marketingBudget: 300,
          rentBudget: 100,
          adminBudget: 50,
        },
      ],
    };

    const next = simulateMonth(state, actions, SEED);
    expect(next.businesses).toHaveLength(3);
    const ids = next.businesses.map((b) => b.id).sort();
    expect(ids).toEqual(["resto", "saas", "svc"]);

    // Chaque entreprise a sa propre trésorerie, indépendante des autres.
    const svc = next.businesses.find((b) => b.id === "svc")!;
    const resto = next.businesses.find((b) => b.id === "resto")!;
    const saas = next.businesses.find((b) => b.id === "saas")!;
    expect(svc.business.treasury).not.toEqual(resto.business.treasury);
    expect(resto.business.treasury.creditLine.drawn).toBeGreaterThan(0); // absorbe le CAPEX de lancement
    expect(saas.familyState.family).toBe("subscription");

    state = next;
  });

  it("la faillite d'une entreprise n'affecte pas les autres entreprises du portefeuille", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [SERVICE_MARKET, HOSPITALITY_MARKET]);

    const healthyAction = (businessId: string, isCreation: boolean) => ({
      businessId,
      founderHoursAllocated: 75,
      founderProspectionHoursAllocated: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
      ...(isCreation
        ? {
            create: {
              family: "service" as const,
              name: "Svc",
              marketId: SERVICE_MARKET.id,
              costPerLaborHour: 8,
              averageMonthlySalary: 2_000,
              creditLineLimit: 30_000,
              creditLineInterestRateAnnual: 0.08,
            },
            offerActions: [
              { kind: "create" as const, spec: { id: "svc-offer", name: "Prestations Svc", businessModel: "service-hours" as const, positioning: "standard" as const, targetSegment: "", price: 45 } },
              { kind: "launch" as const, offerId: "svc-offer" },
            ],
          }
        : {}),
      decisions: { family: "service" as const },
      marketingBudget: 100,
      rentBudget: 200,
      adminBudget: 50,
    });

    const ruinousAction = (businessId: string, isCreation: boolean) => ({
      businessId,
      founderHoursAllocated: 75,
      founderProspectionHoursAllocated: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
      ...(isCreation
        ? {
            create: {
              family: "hospitality" as const,
              name: "Resto",
              marketId: HOSPITALITY_MARKET.id,
              foodCostPerCover: 200,
              averageMonthlySalary: 2_000,
              creditLineLimit: 500,
              creditLineInterestRateAnnual: 0.1,
            },
          }
        : {}),
      decisions: { family: "hospitality" as const },
      marketingBudget: 5_000,
      rentBudget: 5_000,
      adminBudget: 5_000,
    });

    for (let month = 0; month < 10; month++) {
      const isCreation = month === 0;
      state = simulateMonth(
        state,
        {
          timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
          jobHourlyWage: null,
          businessActions: [
            healthyAction("svc", isCreation),
            ...(state.businesses.some((b) => b.id === "resto") || isCreation ? [ruinousAction("resto", isCreation)] : []),
          ],
        },
        SEED,
      );
    }

    const svc = state.businesses.find((b) => b.id === "svc");
    const resto = state.businesses.find((b) => b.id === "resto");
    expect(svc).not.toBeUndefined();
    expect(svc!.business.treasury.isInsolvent).toBe(false);
    expect(svc!.business.treasury.cash).toBeGreaterThan(0);
    expect(resto).toBeUndefined(); // liquidée
    expect(state.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
  });

  it("les 5/5 familles P0 sont réellement jouables simultanément via simulateMonth (spec de clôture M9.5)", () => {
    let state = createInitialGameState(SEED, BIRTH_DATE, START_DATE, [
      SERVICE_MARKET,
      HOSPITALITY_MARKET,
      SUBSCRIPTION_MARKET,
      RETAIL_MARKET,
      AGENCY_MARKET,
    ]);

    const actions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          businessId: "svc",
          founderHoursAllocated: 30,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "service",
            name: "Svc",
            marketId: SERVICE_MARKET.id,
            costPerLaborHour: 8,
            averageMonthlySalary: 2_000,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "service" },
          marketingBudget: 50,
          rentBudget: 50,
          adminBudget: 50,
        },
        {
          businessId: "resto",
          founderHoursAllocated: 30,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "hospitality",
            name: "Resto",
            marketId: HOSPITALITY_MARKET.id,
            foodCostPerCover: 9,
            averageMonthlySalary: 2_000,
            creditLineLimit: 30_000,
            creditLineInterestRateAnnual: 0.09,
          },
          decisions: { family: "hospitality" },
          marketingBudget: 50,
          rentBudget: 200,
          adminBudget: 50,
          capex: 5_000,
        },
        {
          businessId: "saas",
          founderHoursAllocated: 30,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "subscription",
            name: "Saas",
            marketId: SUBSCRIPTION_MARKET.id,
            arpu: 29,
            churnRateBase: 0.04,
            cogsRatio: 0.2,
            initialActiveSubscribers: 0,
            averageMonthlySalary: 3_000,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "subscription" },
          marketingBudget: 100,
          rentBudget: 50,
          adminBudget: 50,
        },
        {
          businessId: "fleur",
          founderHoursAllocated: 30,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "retail",
            name: "Fleur",
            marketId: RETAIL_MARKET.id,
            unitCostOfGoods: 6,
            averageMonthlySalary: 1_800,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "retail", stockUnits: 1_000 },
          marketingBudget: 50,
          rentBudget: 100,
          adminBudget: 50,
        },
        {
          businessId: "conseil",
          founderHoursAllocated: 30,
          founderProspectionHoursAllocated: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
          create: {
            family: "agency",
            name: "Conseil",
            marketId: AGENCY_MARKET.id,
            averageMonthlyFeePerMandate: 4_000,
            deliveryCostRatio: 0.3,
            averageMonthlySalary: 3_500,
            creditLineLimit: 10_000,
            creditLineInterestRateAnnual: 0.08,
          },
          decisions: { family: "agency" },
          marketingBudget: 50,
          rentBudget: 50,
          adminBudget: 50,
        },
      ],
    };

    const next = simulateMonth(state, actions, SEED);
    expect(next.businesses).toHaveLength(5);
    const families = next.businesses.map((b) => b.familyState.family).sort();
    expect(families).toEqual(["agency", "hospitality", "retail", "service", "subscription"]);
    for (const business of next.businesses) {
      expect(business.lastStatement).not.toBeUndefined();
      expect(Number.isFinite(business.lastStatement!.revenue)).toBe(true);
    }
  });
});
