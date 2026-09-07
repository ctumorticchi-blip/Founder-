import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";
import type { SaveGameV1 } from "../src/state/types";

const STORAGE_KEY = "founder.save.v1";

describe("Identité d'entreprise (spec M11.1)", () => {
  it("un nom commercial choisi par le joueur s'affiche partout, l'id technique jamais", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));

    await user.click(screen.getByRole("button", { name: /entreprise/i }));
    await user.click(await screen.findByText(/société de nettoyage/i));

    const nameInput = await screen.findByLabelText(/nom commercial/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Nettoyage Étincelant");

    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));

    expect(await screen.findByRole("heading", { name: /nettoyage étincelant/i })).toBeInTheDocument();

    const save = loadSave()!;
    const businessId = save.draft.businesses[0]!.businessId;
    expect(save.businessIdentities[businessId]!.displayName).toBe("Nettoyage Étincelant");

    // Invariant I1 : l'id technique généré ne doit jamais apparaître dans le DOM rendu.
    expect(screen.queryByText(businessId)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(businessId);

    await user.click(screen.getByRole("button", { name: /terminer le mois/i }));
    await user.click(await screen.findByRole("button", { name: /continuer/i }));

    // Le récap de fin de mois affiche aussi le nom, jamais l'id.
    expect(document.body.textContent).not.toContain(businessId);

    await user.click(screen.getByRole("button", { name: /finances/i }));
    expect(await screen.findByText(/nettoyage étincelant/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(businessId);
  });

  it("choisir une infrastructure différente change le loyer affiché dans Finances", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await user.click(screen.getByRole("button", { name: /entreprise/i }));
    await user.click(await screen.findByText(/société de nettoyage/i));

    await user.click(await screen.findByText(/^coworking$/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await user.click(screen.getByRole("button", { name: /terminer le mois/i }));
    await user.click(await screen.findByRole("button", { name: /continuer/i }));

    await user.click(screen.getByRole("button", { name: /finances/i }));
    await user.click(await screen.findByRole("button", { name: /voir le détail comptable/i }));
    expect(await screen.findByText(/loyer — coworking/i)).toBeInTheDocument();
  });

  it("une sauvegarde M10 (sans businessIdentities, ancien BusinessDraft) se charge sans crash", async () => {
    const legacySave = {
      version: 1,
      seed: 42,
      birthDate: { year: 2007, month: 1 },
      startDate: { year: 2025, month: 1 },
      gameState: {
        date: { year: 2025, month: 3 },
        macro: { cyclePhase: "expansion", growthRateAnnual: 0.02 },
        markets: {},
        competitions: {},
        character: {
          cash: 500,
          age: 18,
          skills: { finance: 10, strategie: 10, technologie: 10, vente: 10, reseau: 10, operations: 10, leadership: 10 },
          timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
        },
        job: null,
        businesses: [
          {
            id: "service-legacy01",
            business: { name: "service-legacy01", families: ["service"], treasury: { cash: 0, creditLine: { limit: 0, drawn: 0, interestRateAnnual: 0 }, unpaidObligations: 0, consecutiveUnpaidMonths: 0, isInsolvent: false } },
            workforce: { headcount: 0, averageMonthlySalary: 2000 },
            marketId: "market-1",
            familyState: { family: "service", reputationScore: 0.1, costPerLaborHour: 8 },
          },
        ],
        events: [],
        memory: [],
      },
      draft: {
        timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
        job: null,
        business: {
          businessId: "service-legacy01",
          family: "service",
          isNew: false,
          createSpec: null,
          decisions: { family: "service", price: 40, targetHours: 100 },
          marketingBudget: 100,
          rentBudget: 400,
          adminBudget: 150,
          capex: 0,
          targetHeadcount: null,
          capitalInjection: 0,
        },
      },
      lastRecap: null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(legacySave));

    expect(() => renderApp()).not.toThrow();
    // Une identité par défaut lisible doit apparaître, jamais l'id technique brut.
    expect(await screen.findByText(/votre situation/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("service-legacy01");

    const migrated = loadSave() as SaveGameV1;
    expect(migrated.businessIdentities["service-legacy01"]).toBeDefined();
    expect(migrated.draft.businesses[0]!.infrastructureId).toBeDefined();
  });
});
