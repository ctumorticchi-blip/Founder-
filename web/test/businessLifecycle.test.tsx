import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";

describe("Cycle de vie d'une entreprise", () => {
  it("crée une entreprise depuis les opportunités puis la retrouve après la fin du mois", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));

    await user.click(screen.getByRole("button", { name: /entreprise/i }));

    await user.click(await screen.findByText(/société de nettoyage/i));
    expect(await screen.findByRole("heading", { name: /société de nettoyage/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));

    // Retour automatique sur l'écran entreprise : l'activité est en attente
    // du prochain "fin de mois" (elle n'existe pas encore côté moteur).
    expect(await screen.findByText(/sera officiellement lancée/i)).toBeInTheDocument();

    // Régression : créer une entreprise doit allouer automatiquement du
    // temps fondateur, sinon elle ne produit jamais rien (bug détecté en
    // playtest manuel avant la clôture de M10).
    const saveBeforeEndMonth = loadSave()!;
    expect(saveBeforeEndMonth.draft.timeAllocation.business).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /terminer le mois/i }));
    await user.click(await screen.findByRole("button", { name: /continuer/i }));

    const save = loadSave()!;
    expect(save.gameState.businesses).toHaveLength(1);
    expect(save.gameState.businesses[0]!.familyState.family).toBe("service");
    expect(save.gameState.businesses[0]!.lastStatement!.revenue).toBeGreaterThan(0);
  });
});
