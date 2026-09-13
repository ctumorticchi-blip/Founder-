import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

const STORAGE_KEY = "founder.save.v1";

function seedAgencySaveWithOpportunity() {
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
      character: { cash: 500, age: 18, skills: {}, timeAllocation: { emploi: 0, apprentissage: 0, business: 80, reseau: 0 } },
      job: null,
      businesses: [
        {
          id: "agy-1",
          business: {
            name: "Conseil Plus",
            families: ["agency"],
            treasury: {
              cash: 5_000,
              creditLine: { limit: 10_000, drawn: 0, interestRateAnnual: 0.08 },
              unpaidObligations: 0,
              consecutiveUnpaidMonths: 0,
              isInsolvent: false,
            },
            properties: [],
            offers: [],
          },
          workforce: { headcount: 2, averageMonthlySalary: 3_000 },
          marketId: "conseil-marketing-b2b",
          familyState: { family: "agency", reputationScore: 0.5, averageMonthlyFeePerMandate: 6_000, deliveryCostRatio: 0.4 },
          saleProcess: null,
          strategicAccounts: [],
          strategicAccountOpportunities: [
            {
              id: "agy-1:offer-1:agency-grands-comptes:24305",
              businessId: "agy-1",
              offerId: "offer-1",
              segmentId: "agency-grands-comptes",
              companyName: "Groupe Meridien",
              contactName: "Camille Marchand",
              contactRole: "Directrice générale",
              source: "network",
              discoveredAt: { year: 2025, month: 6 },
              status: "researching",
            },
          ],
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
          businessId: "agy-1",
          family: "agency",
          isNew: false,
          createSpec: null,
          decisions: { family: "agency" },
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
      "agy-1": { displayName: "Conseil Plus", description: "", activity: "", targetCustomers: "", createdAt: { year: 2025, month: 1 } },
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

describe("Strategic Accounts — écran consultatif (spec M11.2.4.1 §13)", () => {
  it("affiche la carte 'Comptes stratégiques' sur la fiche entreprise et navigue vers la liste sans fuite d'id technique", async () => {
    seedAgencySaveWithOpportunity();
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByText(/conseil plus/i));
    expect(await screen.findByText(/comptes stratégiques/i)).toBeInTheDocument();
    await user.click(screen.getByText(/comptes stratégiques/i));

    expect(await screen.findByRole("heading", { name: /comptes stratégiques/i })).toBeInTheDocument();
    expect(screen.getByText(/groupe meridien/i)).toBeInTheDocument();
    expect(screen.getByText(/camille marchand/i)).toBeInTheDocument();
    expect(screen.getByText(/réseau/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("agy-1:offer-1:agency-grands-comptes:24305");
    expect(document.body.textContent).not.toContain("researching");
  });
});
