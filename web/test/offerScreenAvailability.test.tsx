import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

const STORAGE_KEY = "founder.save.v1";

function seedServiceSaveWithOffer(customerMemory: readonly Record<string, unknown>[]) {
  const save = {
    version: 1,
    seed: 42,
    birthDate: { year: 2007, month: 1 },
    startDate: { year: 2025, month: 1 },
    gameState: {
      date: { year: 2025, month: 6 },
      macro: { cyclePhase: "expansion", growthRateAnnual: 0.02 },
      markets: {},
      competitions: {},
      character: {
        cash: 500,
        age: 18,
        skills: { finance: 10, strategie: 10, technologie: 10, vente: 10, reseau: 10, operations: 10, leadership: 10 },
        timeAllocation: { emploi: 0, apprentissage: 0, business: 80, reseau: 0 },
      },
      job: null,
      businesses: [
        {
          id: "svc-avail",
          business: {
            name: "Nettoyage Express",
            families: ["service"],
            treasury: { cash: 5_000, creditLine: { limit: 10_000, drawn: 0, interestRateAnnual: 0.08 }, unpaidObligations: 0, consecutiveUnpaidMonths: 0, isInsolvent: false },
            properties: [],
            offers: [
              {
                id: "svc-avail-offer-1",
                name: "Prestation Signature",
                businessModel: "service-hours",
                positioning: "standard",
                targetSegment: "Particuliers",
                price: 45,
                status: "launched",
                maturity: 100,
                qualityLevel: 60,
                developmentHoursInvested: 0,
                developmentBudgetInvested: 0,
                createdAt: { year: 2025, month: 1 },
                launchedAt: { year: 2025, month: 3 },
                lastDemand: {
                  topSegmentLabel: "Particuliers",
                  demandSignal: "moderate",
                  priceSignal: "fair",
                  visibilityLevel: "moderate",
                  reached: 500,
                  interested: 200,
                  demand: 100,
                  capacity: 60,
                  sales: 60,
                  lostToCapacity: 40,
                },
                customerMemory,
              },
            ],
          },
          workforce: { headcount: 2, averageMonthlySalary: 2_000 },
          marketId: "nettoyage-local",
          familyState: { family: "service", reputationScore: 0.5, costPerLaborHour: 8 },
          lastStatement: {
            revenue: 2_700,
            variableCosts: 800,
            grossMargin: 1_900,
            payroll: 2_000,
            marketing: 100,
            rent: 0,
            admin: 190,
            ebitda: -390,
            depreciation: 0,
            interest: 0,
            ebt: -390,
            taxes: 0,
            netIncome: -390,
            capex: 0,
            workingCapitalChange: 0,
            cashFlow: -390,
          },
          saleProcess: null,
        },
      ],
      events: [],
      memory: [],
    },
    draft: {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 80, reseau: 0 },
      job: null,
      businesses: [
        {
          businessId: "svc-avail",
          family: "service",
          isNew: false,
          createSpec: null,
          decisions: { family: "service", price: 45, targetHours: 400 },
          prospectionHours: 0,
          founderHoursAllocated: 40,
          marketingBudget: 0,
          infrastructureId: "domicile",
          committedInfrastructureId: "domicile",
          adminOptionalIds: [],
          purchases: [],
          targetHeadcount: 2,
          capitalInjection: 0,
          propertyPurchase: null,
          saleDecision: null,
          offerActions: [],
        },
      ],
    },
    lastRecap: null,
    businessIdentities: {
      "svc-avail": {
        displayName: "Nettoyage Express",
        description: "Nettoyage pro",
        activity: "Nettoyage",
        targetCustomers: "Particuliers",
        createdAt: { year: 2025, month: 1 },
      },
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

async function openOfferScreen(user: ReturnType<typeof userEvent.setup>) {
  const nav = document.querySelector<HTMLElement>(".bottom-nav")!;
  await user.click(within(nav).getByRole("button", { name: /entreprise/i }));
  await user.click(await screen.findByText(/nettoyage express/i));
  await user.click(await screen.findByText(/prestation signature/i));
  expect(await screen.findByRole("heading", { name: /prestation signature/i })).toBeInTheDocument();
}

const SEGMENT_MEMORY = {
  segmentId: "particuliers",
  segmentLabel: "Particuliers",
  retainedBaseVolume: 200,
  newVolumeThisMonth: 20,
  retainedVolumeThisMonth: 40,
  cumulativeAcquiredVolume: 300,
  lastSatisfactionScore: 80,
  smoothedSatisfactionScore: 80,
  lastDiagnosis: null,
  consecutiveGoodMonths: 2,
  consecutiveBadMonths: 0,
  monthsSinceFirstSale: 6,
  repeatDemandThisMonth: 64,
  unservedRepeatDemandThisMonth: 24,
  availabilityFrustration: 0.3,
};

describe("Disponibilité — clients récurrents non servis (spec M11.2.3.1 §15)", () => {
  it("affiche « Non servis » quand des clients récurrents ont été refusés faute de capacité", async () => {
    seedServiceSaveWithOffer([SEGMENT_MEMORY]);
    const user = userEvent.setup();
    renderApp();
    await openOfferScreen(user);

    expect(screen.getByText(/non servis/i)).toBeInTheDocument();
    expect(screen.getByText("24")).toBeInTheDocument();
  });

  it("n'affiche pas de ligne « Non servis » quand aucun client récurrent n'a été refusé", async () => {
    seedServiceSaveWithOffer([{ ...SEGMENT_MEMORY, unservedRepeatDemandThisMonth: 0 }]);
    const user = userEvent.setup();
    renderApp();
    await openOfferScreen(user);

    expect(screen.queryByText(/non servis/i)).not.toBeInTheDocument();
  });
});
