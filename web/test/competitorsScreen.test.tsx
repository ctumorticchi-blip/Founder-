import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";

function clickBottomNavEntreprise(user: ReturnType<typeof userEvent.setup>) {
  const nav = document.querySelector<HTMLElement>(".bottom-nav")!;
  return user.click(within(nav).getByRole("button", { name: /entreprise/i }));
}

async function endMonth(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /terminer le mois/i }));
  await user.click(await screen.findByRole("button", { name: /continuer/i }));
}

describe("Étude de marché (spec M11.2.5 §6, M11.2.6.1)", () => {
  it("affiche une estimation bruitée du marché (potentiel/croissance/intensité concurrentielle), sans nombre brut", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user); // mois 1 : l'entreprise existe réellement

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/concurrents identifiés/i));

    expect(await screen.findByText(/étude de marché/i)).toBeInTheDocument();
    expect(screen.getByText(/potentiel mensuel estimé/i)).toBeInTheDocument();
    expect(screen.getByText(/croissance mensuelle estimée/i)).toBeInTheDocument();
    expect(screen.getByText(/intensité concurrentielle/i)).toBeInTheDocument();

    const businessId = loadSave()!.draft.businesses[0]!.businessId;
    const save = loadSave()!;
    const business = save.gameState.businesses.find((b) => b.id === businessId)!;
    const market = save.gameState.markets[business.marketId]!;
    const bodyText = document.body.textContent ?? "";
    expect(bodyText).not.toContain(String(Math.round(market.sizeMonthlyRevenuePotential)));
  });

  it("affiche une estimation bruitée de la taille de chaque segment de clientèle, sans nombre brut ni id technique", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user); // mois 1 : l'entreprise existe réellement

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/concurrents identifiés/i));

    expect(await screen.findByText(/segments de clientèle/i)).toBeInTheDocument();

    const businessId = loadSave()!.draft.businesses[0]!.businessId;
    const save = loadSave()!;
    const business = save.gameState.businesses.find((b) => b.id === businessId)!;
    expect(business.familyState.family).toBe("agency");

    const bodyText = document.body.textContent ?? "";
    // Segments réels du catalogue agency (engine/market/segments.ts) — tous doivent apparaître nommés.
    expect(bodyText).toContain("TPE / indépendants");
    expect(bodyText).toContain("PME en croissance");
    expect(bodyText).toContain("Entreprises établies");
    expect(bodyText).toContain("Grands comptes ponctuels");
  });

  it("affiche les concurrents identifiés du marché avec des libellés qualitatifs, sans id technique ni score brut", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user); // mois 1 : l'entreprise existe réellement

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/concurrents identifiés/i));

    expect((await screen.findAllByText(/positionnement estimé/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/part de marché estimée/i).length).toBeGreaterThan(0);

    const businessId = loadSave()!.draft.businesses[0]!.businessId;
    const save = loadSave()!;
    const business = save.gameState.businesses.find((b) => b.id === businessId)!;
    const competitors = save.gameState.competitors[business.marketId] ?? [];
    expect(competitors.length).toBeGreaterThan(0);

    const bodyText = document.body.textContent ?? "";
    for (const competitor of competitors) {
      expect(bodyText).toContain(competitor.name);
      expect(bodyText).not.toContain(competitor.id);
    }
  });

  it("permet de revenir à l'écran Entreprise", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user); // mois 1 : l'entreprise existe réellement

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/concurrents identifiés/i));
    await screen.findAllByText(/positionnement estimé/i);

    await user.click(screen.getByText(/^← entreprise$/i));
    expect(await screen.findByText(/concurrents identifiés/i)).toBeInTheDocument();
  });
});
