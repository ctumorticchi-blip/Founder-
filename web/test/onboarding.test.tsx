import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";

describe("Onboarding", () => {
  it("affiche l'écran d'accueil quand aucune partie n'est sauvegardée", () => {
    renderApp();
    expect(screen.getByText(/18 ans\. 0 €\. Aucun diplôme\./i)).toBeInTheDocument();
  });

  it("démarre une partie et affiche le tableau de bord après avoir cliqué sur Commencer", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));

    expect(await screen.findByText(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i)).toBeInTheDocument();
    expect(screen.getByText(/18 ans/i)).toBeInTheDocument();
    expect(screen.getByText(/sans emploi/i)).toBeInTheDocument();
  });
});
