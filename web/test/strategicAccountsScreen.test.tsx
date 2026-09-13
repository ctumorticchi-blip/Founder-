import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "./testUtils";
import { loadSave, writeSave } from "../src/lib/storage";

const STORAGE_KEY = "founder.save.v1";

function clickBottomNavEntreprise(user: ReturnType<typeof userEvent.setup>) {
  const nav = document.querySelector<HTMLElement>(".bottom-nav")!;
  return user.click(within(nav).getByRole("button", { name: /entreprise/i }));
}

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

async function endMonth(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /terminer le mois/i }));
  await user.click(await screen.findByRole("button", { name: /continuer/i }));
}

describe("Strategic Accounts — négociation (spec M11.2.4.2 §8)", () => {
  it("accepter la dernière contre-proposition affiche le contrat signé après la fin du mois, sans id technique ni statut brut", async () => {
    // Joue une vraie partie (onboarding réel) jusqu'à avoir une offre "agency"
    // lancée sur le segment éligible, PUIS injecte directement une
    // opportunité "negotiating" via loadSave/writeSave — bien plus robuste
    // qu'un GameState entièrement reconstitué à la main (character/timeBudget/
    // markets/competitions ont une forme réelle exacte difficile à répliquer
    // fidèlement, découvert en écrivant ce test : deux fixtures à la main ont
    // échoué successivement sur des champs manquants sans rapport avec la
    // négociation elle-même).
    const user = userEvent.setup();
    const firstRender = renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user); // mois 1 : l'entreprise existe réellement

    const businessId = loadSave()!.draft.businesses[0]!.businessId;

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByRole("button", { name: /nouvelle offre/i }));
    await user.type(screen.getByLabelText(/nom de l'offre/i), "Accompagnement grands comptes");
    await user.click(screen.getByRole("button", { name: /grands comptes ponctuels/i }));
    await user.click(screen.getByRole("button", { name: /accompagnement continu/i }));
    await user.click(screen.getByRole("button", { name: /créer l'offre/i }));
    await endMonth(user); // mois 2 : l'offre existe (service-hours, seuil 0%)

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/accompagnement grands comptes/i));
    await user.click(screen.getByRole("button", { name: /lancer l'offre/i }));
    await endMonth(user); // mois 3 : l'offre est lancée

    const save = loadSave()!;
    const business = save.gameState.businesses.find((b) => b.id === businessId)!;
    const offerId = business.business.offers[0]!.id;
    const negotiatingOpportunity = {
      id: `${businessId}:${offerId}:agency-grands-comptes:x`,
      businessId,
      offerId,
      segmentId: "agency-grands-comptes",
      companyName: "Groupe Meridien",
      contactName: "Camille Marchand",
      contactRole: "Directrice générale",
      source: "network" as const,
      discoveredAt: save.gameState.date,
      status: "negotiating" as const,
      researchHoursInvested: 10,
      budgetEstimate: {
        price: { value: 13_000, uncertainty: 2_000 },
        volume: { value: 40, uncertainty: 10 },
        qualityCommitment: { value: 70, uncertainty: 5 },
      },
      lastAccountProposal: { price: 13_500, volume: 42, qualityCommitment: 68, durationMonths: 6 },
      contract: null,
      relationship: null,
    };
    writeSave({
      ...save,
      gameState: {
        ...save.gameState,
        businesses: save.gameState.businesses.map((b) =>
          b.id === businessId ? { ...b, strategicAccountOpportunities: [negotiatingOpportunity] } : b,
        ),
      },
    });

    // Remonte l'app pour qu'elle recharge cet état depuis le stockage (comme un refresh de page).
    firstRender.unmount();
    renderApp();
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/comptes stratégiques/i));
    expect(await screen.findByRole("heading", { name: /comptes stratégiques/i })).toBeInTheDocument();

    expect(screen.getByText(/en négociation/i)).toBeInTheDocument();
    expect(screen.getByText(/13.500/i)).toBeInTheDocument(); // prix de la contre-proposition, formaté fr-FR
    await user.click(screen.getByRole("button", { name: /^accepter$/i }));

    await user.click(screen.getByText(/^← entreprise$/i));
    await endMonth(user);

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/comptes stratégiques/i));
    expect(await screen.findByText(/contrat signé/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("negotiating");
    expect(document.body.textContent).not.toContain(negotiatingOpportunity.id);
  });
});

describe("Strategic Accounts — Relationship & Concentration (spec M11.2.4.4 §13)", () => {
  it("un contrat signé avec relationship peuplé affiche satisfaction/confiance/concentration en vocabulaire qualitatif, jamais un score brut ni un id technique", async () => {
    const user = userEvent.setup();
    const firstRender = renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user);

    const businessId = loadSave()!.draft.businesses[0]!.businessId;

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByRole("button", { name: /nouvelle offre/i }));
    await user.type(screen.getByLabelText(/nom de l'offre/i), "Accompagnement grands comptes");
    await user.click(screen.getByRole("button", { name: /grands comptes ponctuels/i }));
    await user.click(screen.getByRole("button", { name: /accompagnement continu/i }));
    await user.click(screen.getByRole("button", { name: /créer l'offre/i }));
    await endMonth(user);

    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/accompagnement grands comptes/i));
    await user.click(screen.getByRole("button", { name: /lancer l'offre/i }));
    await endMonth(user);

    const save = loadSave()!;
    const business = save.gameState.businesses.find((b) => b.id === businessId)!;
    const offerId = business.business.offers[0]!.id;
    const wonOpportunity = {
      id: `${businessId}:${offerId}:agency-grands-comptes:x`,
      businessId,
      offerId,
      segmentId: "agency-grands-comptes",
      companyName: "Groupe Meridien",
      contactName: "Camille Marchand",
      contactRole: "Directrice générale",
      source: "network" as const,
      discoveredAt: save.gameState.date,
      status: "won" as const,
      researchHoursInvested: 40,
      budgetEstimate: {
        price: { value: 13_000, uncertainty: 0 },
        volume: { value: 40, uncertainty: 0 },
        qualityCommitment: { value: 70, uncertainty: 0 },
      },
      lastAccountProposal: null,
      contract: {
        price: 13_000,
        volume: 40,
        qualityCommitment: 70,
        durationMonths: 6,
        monthsRemaining: 5,
        signedAt: save.gameState.date,
        lastMonthServedVolume: 40,
        lastMonthUnservedVolume: 0,
        renewalProposal: null,
        renewalDeadlineMonthsRemaining: null,
      },
      relationship: {
        satisfaction: { scoreThisMonth: 82, smoothedScore: 82, diagnosisThisMonth: null },
        trust: 0.82,
        breachFrustration: 0,
        history: [],
      },
    };
    writeSave({
      ...save,
      gameState: {
        ...save.gameState,
        businesses: save.gameState.businesses.map((b) =>
          b.id === businessId ? { ...b, strategicAccountOpportunities: [wonOpportunity] } : b,
        ),
      },
    });

    firstRender.unmount();
    renderApp();
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/comptes stratégiques/i));

    expect(await screen.findByText(/contrat signé/i)).toBeInTheDocument();
    expect(screen.getByText(/très satisfait/i)).toBeInTheDocument();
    expect(screen.getByText(/confiance solide/i)).toBeInTheDocument();
    expect(screen.getByText(/% du ca/i)).toBeInTheDocument();
    expect(screen.getByText(/dépendance/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(wonOpportunity.id);
    expect(document.body.textContent).not.toContain("smoothedScore");
    expect(document.body.textContent).not.toContain("breachFrustration");
  });

  it("relationship: null (mois pas encore résolu sous ce contrat) affiche un état neutre explicite, jamais un score inventé", async () => {
    const user = userEvent.setup();
    const firstRender = renderApp();

    await user.click(screen.getByRole("button", { name: /commencer ma vie/i }));
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/agence de conseil/i));
    await user.click(screen.getByRole("button", { name: /lancer l'entreprise/i }));
    await endMonth(user);

    const businessId = loadSave()!.draft.businesses[0]!.businessId;
    const save = loadSave()!;
    const wonOpportunityNoRelationship = {
      id: `${businessId}:offer-x:agency-grands-comptes:x`,
      businessId,
      offerId: "offer-x",
      segmentId: "agency-grands-comptes",
      companyName: "Groupe Meridien",
      contactName: "Camille Marchand",
      contactRole: "Directrice générale",
      source: "network" as const,
      discoveredAt: save.gameState.date,
      status: "won" as const,
      researchHoursInvested: 40,
      budgetEstimate: {
        price: { value: 13_000, uncertainty: 0 },
        volume: { value: 40, uncertainty: 0 },
        qualityCommitment: { value: 70, uncertainty: 0 },
      },
      lastAccountProposal: null,
      contract: {
        price: 13_000,
        volume: 40,
        qualityCommitment: 70,
        durationMonths: 6,
        monthsRemaining: 6,
        signedAt: save.gameState.date,
        lastMonthServedVolume: 0,
        lastMonthUnservedVolume: 0,
        renewalProposal: null,
        renewalDeadlineMonthsRemaining: null,
      },
      relationship: null,
    };
    writeSave({
      ...save,
      gameState: {
        ...save.gameState,
        businesses: save.gameState.businesses.map((b) =>
          b.id === businessId ? { ...b, strategicAccountOpportunities: [wonOpportunityNoRelationship] } : b,
        ),
      },
    });

    firstRender.unmount();
    renderApp();
    await clickBottomNavEntreprise(user);
    await user.click(await screen.findByText(/conseil/i));
    await user.click(screen.getByText(/comptes stratégiques/i));

    expect(await screen.findByText(/contrat signé/i)).toBeInTheDocument();
    expect(screen.getByText(/pas encore d'historique de livraison/i)).toBeInTheDocument();
  });
});
