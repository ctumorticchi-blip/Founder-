import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";

const STORAGE_KEY = "founder.save.v1";

function seedTwoBusinessSave() {
  const businessDraft = (id: string, family: string) => ({
    businessId: id,
    family,
    isNew: false,
    createSpec: null,
    decisions: family === "service" ? { family: "service", price: 40, targetHours: 400 } : { family: "agency", targetMandates: 20 },
    prospectionHours: 40,
    founderHoursAllocated: 40,
    marketingBudget: 100,
    infrastructureId: "domicile",
    committedInfrastructureId: "domicile",
    adminOptionalIds: [],
    purchases: [],
    targetHeadcount: null,
    capitalInjection: 0,
    propertyPurchase: null,
    saleDecision: null,
    offerActions: [],
  });

  const ownedBusiness = (id: string, family: string, name: string) => ({
    id,
    business: {
      name,
      families: [family],
      treasury: { cash: 5_000, creditLine: { limit: 10_000, drawn: 0, interestRateAnnual: 0.08 }, unpaidObligations: 0, consecutiveUnpaidMonths: 0, isInsolvent: false },
      properties: [],
    },
    workforce: { headcount: 0, averageMonthlySalary: 2_000 },
    marketId: family === "service" ? "nettoyage-local" : "conseil-b2b",
    familyState:
      family === "service"
        ? { family: "service", reputationScore: 0.2, costPerLaborHour: 8 }
        : { family: "agency", reputationScore: 0.2, averageMonthlyFeePerMandate: 4_000, deliveryCostRatio: 0.3 },
    lastStatement: {
      revenue: 3_000,
      variableCosts: 800,
      grossMargin: 2_200,
      payroll: 0,
      marketing: 100,
      rent: 0,
      admin: 190,
      ebitda: 1_910,
      depreciation: 0,
      interest: 0,
      ebt: 1_910,
      taxes: 477,
      netIncome: 1_433,
      capex: 0,
      workingCapitalChange: 0,
      cashFlow: 1_433,
    },
    saleProcess: null,
  });

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
      businesses: [ownedBusiness("svc-multi", "service", "Nettoyage Express"), ownedBusiness("agy-multi", "agency", "Conseil Alpha")],
      events: [],
      memory: [],
    },
    draft: {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 80, reseau: 0 },
      job: null,
      businesses: [businessDraft("svc-multi", "service"), businessDraft("agy-multi", "agency")],
    },
    lastRecap: null,
    businessIdentities: {
      "svc-multi": {
        displayName: "Nettoyage Express",
        description: "Nettoyage pro",
        activity: "Nettoyage",
        targetCustomers: "Particuliers",
        createdAt: { year: 2025, month: 1 },
      },
      "agy-multi": {
        displayName: "Conseil Alpha",
        description: "Conseil",
        activity: "Conseil",
        targetCustomers: "PME",
        createdAt: { year: 2025, month: 3 },
      },
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

describe("Portefeuille multi-entreprises (spec M11.1.5 §5)", () => {
  it("le portefeuille liste les deux entreprises avec leurs vrais noms, sans fuite d'id technique", async () => {
    seedTwoBusinessSave();
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: /entreprise/i }));

    expect(await screen.findByText(/nettoyage express/i)).toBeInTheDocument();
    expect(await screen.findByText(/conseil alpha/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("svc-multi");
    expect(document.body.textContent).not.toContain("agy-multi");
  });

  it("ouvrir une entreprise depuis le portefeuille affiche sa fiche, sans le champ 'Effort commercial visé' (spec §E)", async () => {
    seedTwoBusinessSave();
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByRole("button", { name: /entreprise/i }));
    await user.click(await screen.findByText(/nettoyage express/i));

    expect(await screen.findByRole("heading", { name: /nettoyage express/i })).toBeInTheDocument();
    expect(screen.queryByText(/effort commercial visé/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/targetHours/i)).not.toBeInTheDocument();
    // Le nouveau curseur "Prospection" remplace le champ supprimé.
    expect(screen.getByText(/prospection/i)).toBeInTheDocument();
  });

  it("créer une nouvelle entreprise depuis Opportunités ajoute au portefeuille sans supprimer les précédentes", async () => {
    seedTwoBusinessSave();
    const save = loadSave()!;
    expect(save.draft.businesses).toHaveLength(2);
  });

  it("le portefeuille survit à un reload (sauvegarde/chargement)", async () => {
    seedTwoBusinessSave();
    const user = userEvent.setup();
    const first = renderApp();
    await user.click(await screen.findByRole("button", { name: /entreprise/i }));
    expect(await screen.findByText(/nettoyage express/i)).toBeInTheDocument();
    first.unmount();

    renderApp();
    await user.click(await screen.findByRole("button", { name: /entreprise/i }));
    expect(await screen.findByText(/nettoyage express/i)).toBeInTheDocument();
    expect(await screen.findByText(/conseil alpha/i)).toBeInTheDocument();
  });
});
