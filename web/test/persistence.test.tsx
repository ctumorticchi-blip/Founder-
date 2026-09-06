import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";

describe("Sauvegarde locale", () => {
  it("persiste la partie dans localStorage dès sa création (le seed est conservé)", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await screen.findByText(/sans emploi/i);

    const save = loadSave();
    expect(save).not.toBeNull();
    expect(typeof save!.seed).toBe("number");
    expect(save!.gameState.character.cash).toBe(0);
  });

  it("recharge la même partie (même seed) après un remontage du composant (simulateur de refresh)", async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await screen.findByText(/sans emploi/i);
    const seedAfterCreation = loadSave()!.seed;
    first.unmount();

    renderApp();
    // Pas d'écran d'onboarding : la partie existante doit être rechargée directement.
    expect(await screen.findByText(/sans emploi/i)).toBeInTheDocument();
    expect(loadSave()!.seed).toBe(seedAfterCreation);
  });
});
