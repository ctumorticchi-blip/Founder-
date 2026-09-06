import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";

describe("Carrière puis fin de mois", () => {
  it("prendre un emploi puis terminer le mois augmente le cash personnel", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));

    await user.click(screen.getByRole("button", { name: /carrière/i }));
    await user.click(await screen.findByText(/vendeur en supermarché/i));

    expect(await screen.findByText(/quitter/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /terminer le mois/i }));

    const recap = await screen.findByText(/mois terminé/i);
    expect(recap).toBeInTheDocument();
    const cashRow = screen.getByText(/cash personnel/i).closest(".card");
    expect(within(cashRow as HTMLElement).getAllByText(/1 320/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /continuer/i }));

    const save = loadSave()!;
    expect(save.gameState.character.cash).toBeCloseTo(1_320);
    expect(save.gameState.date).toEqual({ year: save.startDate.year, month: 2 });
  });
});
