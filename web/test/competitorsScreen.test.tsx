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

describe("Concurrents identifiés (spec M11.2.5 §6)", () => {
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
