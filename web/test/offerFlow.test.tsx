import { describe, expect, it } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave } from "../src/lib/storage";

async function endMonth(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /terminer le mois/i }));
  await user.click(await screen.findByRole("button", { name: /continuer/i }));
}

function clickBottomNavEntreprise(user: ReturnType<typeof userEvent.setup>) {
  const nav = document.querySelector<HTMLElement>(".bottom-nav")!;
  return user.click(within(nav).getByRole("button", { name: /entreprise/i }));
}

describe("Offer Engine — parcours complet (spec M11.2.1)", () => {
  it("construire une offre, investir sur plusieurs mois, lancer, modifier prix/positionnement, améliorer — sans jamais fuiter d'id technique", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/société de nettoyage/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user); // mois 1 : l'entreprise existe réellement

    const businessId = loadSave()!.draft.businesses[0]!.businessId;

    // Sans offre lancée, l'entreprise ne vend rien.
    expect(loadSave()!.gameState.businesses[0]!.lastStatement!.revenue).toBe(0);
    expect(screen.getByText(/construisez et lancez une offre/i)).toBeInTheDocument();

    // Libère 30h de temps "Production" pour pouvoir investir dans le
    // développement de l'offre (le temps professionnel est intégralement
    // engagé par défaut — spec M11.1.5 §5.3 : jamais un levier gratuit).
    fireEvent.change(screen.getByLabelText(/^production$/i), { target: { value: "90" } });

    // --- Construire une première offre (modèle gated : "project", seuil 40%). ---
    await user.click(screen.getByRole("button", { name: /nouvelle offre/i }));
    await user.type(screen.getByLabelText(/nom de l'offre/i), "Prestation Signature");
    await user.click(screen.getByRole("button", { name: /mission forfaitaire/i }));
    await user.clear(screen.getByLabelText(/^prix/i));
    await user.type(screen.getByLabelText(/^prix/i), "200");
    await user.clear(screen.getByLabelText(/heures de développement/i));
    await user.type(screen.getByLabelText(/heures de développement/i), "10");
    await user.clear(screen.getByLabelText(/budget de développement/i));
    await user.type(screen.getByLabelText(/budget de développement/i), "100");
    await user.click(screen.getByRole("button", { name: /créer l'offre/i }));

    // Retour sur la fiche entreprise : l'offre est en attente.
    expect(await screen.findByText(/sera officiellement créée/i)).toBeInTheDocument();
    await endMonth(user); // mois 2 : l'offre existe, maturité ~17% (10h*1.5 + 100€*0.02)

    let save = loadSave()!;
    let offer = save.gameState.businesses[0]!.business.offers[0]!;
    expect(offer.status).toBe("in-development");
    expect(offer.maturity).toBeCloseTo(17, 5);

    // Aucune fuite d'id technique à ce stade.
    expect(document.body.textContent).not.toContain(offer.id);
    expect(document.body.textContent).not.toContain(businessId);

    await user.click(screen.getByText(/prestation signature/i));
    expect(await screen.findByRole("heading", { name: /prestation signature/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lancer l'offre/i })).toBeDisabled();
    expect(screen.getByText(/développement insuffisant/i)).toBeInTheDocument();

    // --- Investir sur deux mois supplémentaires (progression multi-mois). ---
    for (let i = 0; i < 2; i += 1) {
      await user.clear(screen.getByLabelText(/heures ce mois-ci/i));
      await user.type(screen.getByLabelText(/heures ce mois-ci/i), "10");
      await user.clear(screen.getByLabelText(/budget ce mois-ci/i));
      await user.type(screen.getByLabelText(/budget ce mois-ci/i), "100");
      await user.click(screen.getByRole("button", { name: /^investir ce mois-ci$/i }));
      await endMonth(user);
      await clickBottomNavEntreprise(user);
      await user.click(screen.getByText(/prestation signature/i));
    }

    save = loadSave()!;
    offer = save.gameState.businesses[0]!.business.offers[0]!;
    expect(offer.maturity).toBeCloseTo(51, 5); // 3 x 17
    expect(offer.status).toBe("in-development");

    // --- Lancer l'offre, maintenant suffisamment développée. ---
    expect(await screen.findByRole("button", { name: /lancer l'offre/i })).not.toBeDisabled();
    await user.click(screen.getByRole("button", { name: /lancer l'offre/i }));
    expect(await screen.findByText(/lancement prévu/i)).toBeInTheDocument();
    await endMonth(user);

    save = loadSave()!;
    offer = save.gameState.businesses[0]!.business.offers[0]!;
    expect(offer.status).toBe("launched");
    expect(document.body.textContent).not.toContain(offer.id);

    // --- Modifier prix/positionnement, améliorer après lancement. ---
    await clickBottomNavEntreprise(user);
    await user.click(screen.getByText(/prestation signature/i));
    expect(await screen.findByText(/qualité du service/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^prix/i));
    await user.type(screen.getByLabelText(/^prix/i), "250");
    await user.click(screen.getByRole("button", { name: "Premium" }));
    await user.click(screen.getByRole("button", { name: /mettre à jour/i }));

    await user.clear(screen.getByLabelText(/heures ce mois-ci/i));
    await user.type(screen.getByLabelText(/heures ce mois-ci/i), "10");
    await user.clear(screen.getByLabelText(/budget ce mois-ci/i));
    await user.type(screen.getByLabelText(/budget ce mois-ci/i), "100");
    await user.click(screen.getByRole("button", { name: /^investir ce mois-ci$/i }));

    await endMonth(user);

    save = loadSave()!;
    offer = save.gameState.businesses[0]!.business.offers[0]!;
    expect(offer.price).toBe(250);
    expect(offer.positioning).toBe("premium");
    expect(offer.qualityLevel).toBeGreaterThan(30); // amélioration post-lancement (30 = qualité initiale)
    expect(save.gameState.businesses[0]!.lastStatement!.revenue).toBeGreaterThan(0); // le prix de l'offre pilote enfin le revenu

    // --- Coexistence : une deuxième offre sur la même entreprise. ---
    await clickBottomNavEntreprise(user);
    await user.click(screen.getByRole("button", { name: /nouvelle offre/i }));
    await user.type(screen.getByLabelText(/nom de l'offre/i), "Formule Express");
    await user.click(screen.getByRole("button", { name: /créer l'offre/i }));
    await endMonth(user);

    save = loadSave()!;
    expect(save.gameState.businesses[0]!.business.offers).toHaveLength(2);
    expect(save.gameState.businesses[0]!.business.offers.map((o) => o.name).sort()).toEqual(["Formule Express", "Prestation Signature"]);

    // Vérification finale : aucune fuite d'id technique nulle part dans le DOM.
    const finalOffers = save.gameState.businesses[0]!.business.offers;
    const finalBody = document.body.textContent ?? "";
    for (const finalOffer of finalOffers) {
      expect(finalBody).not.toContain(finalOffer.id);
    }
    expect(finalBody).not.toContain(businessId);
  });
});
