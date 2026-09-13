import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import { simulateMonth } from "../../../src/engine/simulation/simulateMonth.js";
import { deriveTrueOpportunityBudget } from "../../../src/engine/business/strategicAccounts.js";
import type { BusinessAction, GameState, MonthActions } from "../../../src/engine/simulation/types.js";
import type { AccountProposal, StrategicAccountAction } from "../../../src/types/strategicAccount.js";
import { AGENCY_MARKET } from "../../../src/scenarios/markets.js";

const AGENCY_GRANDS_COMPTES_REFERENCE_PRICE = 12_000;

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };

function agencyCreateAction(): BusinessAction {
  return {
    businessId: "conseil-1",
    founderHoursAllocated: 150,
    founderProspectionHoursAllocated: 0,
    create: {
      family: "agency",
      name: "Conseil Plus",
      marketId: AGENCY_MARKET.id,
      averageMonthlyFeePerMandate: 6_000,
      deliveryCostRatio: 0.4,
      averageMonthlySalary: 3_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    },
    decisions: { family: "agency" },
    offerActions: [
      {
        kind: "create",
        spec: {
          // "service-hours" a un seuil de lancement de 0% (offer.ts) : lancement
          // immédiat sans développement préalable, pour isoler l'effet testé ici
          // (apparition d'opportunités) de la mécanique de développement d'offre.
          id: "offer-1",
          name: "Mandat conseil",
          businessModel: "service-hours",
          positioning: "premium",
          targetSegment: "agency-grands-comptes",
          price: 8_000,
        },
      },
      { kind: "launch", offerId: "offer-1" },
    ],
    marketingBudget: 0,
    rentBudget: 0,
    adminBudget: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
  };
}

function monthActions(
  businessId: string,
  existing: boolean,
  strategicAccountActions: readonly StrategicAccountAction[] = [],
): MonthActions {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
    jobHourlyWage: null,
    businessActions: [
      existing
        ? {
            businessId,
            founderHoursAllocated: 150,
            founderProspectionHoursAllocated: 0,
            decisions: { family: "agency" },
            offerActions: [],
            strategicAccountActions,
            marketingBudget: 0,
            rentBudget: 0,
            adminBudget: 0,
            headcountCapacity: Number.POSITIVE_INFINITY,
            storageCapacity: Number.POSITIVE_INFINITY,
          }
        : agencyCreateAction(),
    ],
  };
}

/** Avance jusqu'à ce qu'au moins une opportunité existe, renvoie l'état ET son id (horizon généreux, seed fixe pour rester déterministe). */
function advanceUntilFirstOpportunity(seed: number): { state: GameState; opportunityId: string } {
  let state: GameState = createInitialGameState(seed, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
  state = simulateMonth(state, monthActions("conseil-1", false), seed);
  for (let month = 0; month < 60; month++) {
    const opportunities = state.businesses[0]!.strategicAccountOpportunities;
    if (opportunities.length > 0) {
      return { state, opportunityId: opportunities[0]!.id };
    }
    state = simulateMonth(state, monthActions("conseil-1", true), seed);
  }
  throw new Error("advanceUntilFirstOpportunity: aucune opportunité apparue dans l'horizon de test — seed à recalibrer.");
}

describe("Strategic Account Opportunities — intégration mensuelle (spec M11.2.4.1 §15)", () => {
  it("une entreprise fraîchement créée porte strategicAccounts:[] et strategicAccountOpportunities toujours un tableau (jamais undefined)", () => {
    const state = createInitialGameState(1, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    const next = simulateMonth(state, monthActions("conseil-1", false), 1);
    const business = next.businesses[0]!;
    expect(business.strategicAccounts).toEqual([]);
    expect(Array.isArray(business.strategicAccountOpportunities)).toBe(true);
    expect(business.strategicAccountOpportunities.length).toBeLessThanOrEqual(1);
  });

  it("des opportunités finissent par apparaître sur un horizon suffisant, jamais de doublon d'id, jamais de conversion en compte confirmé", () => {
    let state: GameState = createInitialGameState(2, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
    state = simulateMonth(state, monthActions("conseil-1", false), 2);
    for (let month = 0; month < 48; month++) {
      state = simulateMonth(state, monthActions("conseil-1", true), 2);
    }
    const business = state.businesses[0]!;
    expect(business.strategicAccountOpportunities.length).toBeGreaterThan(0);
    expect(business.strategicAccounts).toEqual([]); // Core ne convertit jamais
    const ids = new Set(business.strategicAccountOpportunities.map((o) => o.id));
    expect(ids.size).toBe(business.strategicAccountOpportunities.length);
    for (const o of business.strategicAccountOpportunities) expect(o.status).toBe("researching");
  });

  it("est déterministe : même seed, même déroulé -> mêmes opportunités", () => {
    function run(seed: number) {
      let state: GameState = createInitialGameState(seed, BIRTH_DATE, START_DATE, [AGENCY_MARKET]);
      state = simulateMonth(state, monthActions("conseil-1", false), seed);
      for (let month = 0; month < 12; month++) state = simulateMonth(state, monthActions("conseil-1", true), seed);
      return state.businesses[0]!.strategicAccountOpportunities;
    }
    expect(run(5)).toEqual(run(5));
  });
});

describe("Prospecting & Negotiation — intégration mensuelle (spec M11.2.4.2 §6, §8)", () => {
  it("invest-time accumule researchHoursInvested sur plusieurs mois, validé contre le budget de temps partagé", () => {
    const { state: initial, opportunityId } = advanceUntilFirstOpportunity(2);
    // founderHoursAllocated réduit à 140h (au lieu de 150) pour laisser 10h de marge
    // dans le budget "business" (150h) — invest-time n'est jamais un levier de temps
    // gratuit, il doit se loger dans le MÊME budget partagé (spec §6).
    const monthWithInvestment = (): MonthActions => ({
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          businessId: "conseil-1",
          founderHoursAllocated: 140,
          founderProspectionHoursAllocated: 0,
          decisions: { family: "agency" },
          offerActions: [],
          strategicAccountActions: [{ kind: "invest-time", opportunityId, hours: 10 }],
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
        },
      ],
    });
    let state = simulateMonth(initial, monthWithInvestment(), 2);
    state = simulateMonth(state, monthWithInvestment(), 2);
    const opportunity = state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(opportunity.researchHoursInvested).toBe(20);
  });

  it("dépasser le budget de temps fondateur partagé avec invest-time est rejeté (même contrainte que founderHoursAllocated/develop)", () => {
    const { state: initial, opportunityId } = advanceUntilFirstOpportunity(2);
    const overBudgetActions: MonthActions = {
      timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
      jobHourlyWage: null,
      businessActions: [
        {
          businessId: "conseil-1",
          founderHoursAllocated: 150,
          founderProspectionHoursAllocated: 0,
          decisions: { family: "agency" },
          offerActions: [],
          strategicAccountActions: [{ kind: "invest-time", opportunityId, hours: 50 }],
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
        },
      ],
    };
    expect(() => simulateMonth(initial, overBudgetActions, 2)).toThrow();
  });

  it("négociation complète de bout en bout via simulateMonth -> contrat signé", () => {
    const { state: initial, opportunityId } = advanceUntilFirstOpportunity(2);
    const budget = deriveTrueOpportunityBudget(opportunityId, AGENCY_GRANDS_COMPTES_REFERENCE_PRICE);

    const tooHigh: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    let state = simulateMonth(
      initial,
      monthActions("conseil-1", true, [{ kind: "propose", opportunityId, proposal: tooHigh }]),
      2,
    );
    let opportunity = state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(opportunity.status).toBe("negotiating");
    expect(opportunity.lastAccountProposal).not.toBeNull();

    state = simulateMonth(state, monthActions("conseil-1", true, [{ kind: "accept", opportunityId }]), 2);
    opportunity = state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(opportunity.status).toBe("won");
    expect(opportunity.contract).not.toBeNull();
    expect(state.businesses[0]!.strategicAccounts).toEqual([]); // toujours aucune conversion en compte confirmé
  });

  it("signer un contrat CE mois-ci consomme réellement de la capacité et génère du CA CE MÊME mois (spec M11.2.4.3 décision 6 : négociation résolue avant le calcul économique)", () => {
    const { state: initial, opportunityId } = advanceUntilFirstOpportunity(2);
    const budget = deriveTrueOpportunityBudget(opportunityId, AGENCY_GRANDS_COMPTES_REFERENCE_PRICE);
    const tooHigh: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    const negotiating = simulateMonth(initial, monthActions("conseil-1", true, [{ kind: "propose", opportunityId, proposal: tooHigh }]), 2);

    // Deux branches DEPUIS LE MÊME ÉTAT PRÉALABLE (negotiating), pour le même mois :
    // l'une accepte le contrat, l'autre ne fait rien. La différence de revenu entre
    // les deux PROUVE l'effet économique immédiat du contrat (spec M11.2.4.3, contrairement
    // à M11.2.4.2 où un contrat signé restait "papier" jusqu'au mois suivant).
    const withAccept = simulateMonth(negotiating, monthActions("conseil-1", true, [{ kind: "accept", opportunityId }]), 2);
    const withoutAccept = simulateMonth(negotiating, monthActions("conseil-1", true, []), 2);

    const wonOpportunity = withAccept.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(wonOpportunity.status).toBe("won");
    expect(wonOpportunity.contract!.lastMonthServedVolume).toBeGreaterThan(0);
    expect(wonOpportunity.contract!.monthsRemaining).toBe(wonOpportunity.contract!.durationMonths - 1);
    expect(withAccept.businesses[0]!.lastStatement!.revenue).not.toBe(withoutAccept.businesses[0]!.lastStatement!.revenue);
  });

  it("conservation de bout en bout via simulateMonth (spec M11.2.4.3 §2-§3) : ventes + non-servi (tous flux) = demande totale, aucune destruction/duplication", () => {
    const { state: initial, opportunityId } = advanceUntilFirstOpportunity(2);
    const budget = deriveTrueOpportunityBudget(opportunityId, AGENCY_GRANDS_COMPTES_REFERENCE_PRICE);
    const tooHigh: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    const negotiating = simulateMonth(initial, monthActions("conseil-1", true, [{ kind: "propose", opportunityId, proposal: tooHigh }]), 2);
    const withAccept = simulateMonth(negotiating, monthActions("conseil-1", true, [{ kind: "accept", opportunityId }]), 2);

    const business = withAccept.businesses[0]!;
    const offer = business.business.offers.find((o) => o.id === business.strategicAccountOpportunities.find((op) => op.id === opportunityId)!.offerId)!;
    const demand = offer.lastDemand!;
    const contract = business.strategicAccountOpportunities.find((o) => o.id === opportunityId)!.contract!;

    // Identité de conservation (spec §2-§3) : ventes totales + pertes totales = demande totale,
    // qu'il y ait surcharge ou non — jamais de volume détruit ni dupliqué entre les 3 flux.
    expect(demand.sales + demand.lostToCapacity).toBeCloseTo(demand.demand, 3);
    // Le volume contractuel réellement servi/perdu somme exactement au volume du contrat.
    expect(contract.lastMonthServedVolume + contract.lastMonthUnservedVolume).toBeCloseTo(contract.volume, 3);
  });
});

describe("Renewal & Loss — intégration mensuelle (spec M11.2.4.5 §11-§12)", () => {
  function signInitialContract(seed: number): { state: GameState; opportunityId: string } {
    const { state: initial, opportunityId } = advanceUntilFirstOpportunity(seed);
    const budget = deriveTrueOpportunityBudget(opportunityId, AGENCY_GRANDS_COMPTES_REFERENCE_PRICE);
    const tooHigh: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    let state = simulateMonth(initial, monthActions("conseil-1", true, [{ kind: "propose", opportunityId, proposal: tooHigh }]), seed);
    state = simulateMonth(state, monthActions("conseil-1", true, [{ kind: "accept", opportunityId }]), seed);
    return { state, opportunityId };
  }

  it("scénario complet : signature -> exécution -> renouvellement proposé par le client -> accepté -> contrat renouvelé, événement causal émis", () => {
    const seed = 2;
    const { state: signed, opportunityId } = signInitialContract(seed);
    const durationMonths = signed.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!.contract!.durationMonths;

    // Avance jusqu'à épuisement du terme, sans aucune action (le contrat s'exécute normalement).
    let state = signed;
    for (let i = 0; i < durationMonths; i++) {
      state = simulateMonth(state, monthActions("conseil-1", true, []), seed);
    }
    let opportunity = state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(opportunity.status).toBe("won"); // le compte reste actif pendant toute la négociation de renouvellement
    expect(opportunity.contract!.renewalProposal).not.toBeNull();

    state = simulateMonth(state, monthActions("conseil-1", true, [{ kind: "accept", opportunityId }]), seed);
    opportunity = state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(opportunity.status).toBe("won");
    expect(opportunity.contract!.renewalProposal).toBeNull();
    expect(opportunity.contract!.monthsRemaining).toBeGreaterThan(0);
    expect(state.events.some((e) => e.kind === "strategic-account-renewed")).toBe(true);
  });

  it("un renouvellement jamais résolu finit en départ réel après le délai de grâce, événement causal émis, capacité réabsorbée par new/repeat ensuite", () => {
    const seed = 2;
    const { state: signed, opportunityId } = signInitialContract(seed);
    const durationMonths = signed.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!.contract!.durationMonths;

    let state = signed;
    for (let i = 0; i < durationMonths; i++) {
      state = simulateMonth(state, monthActions("conseil-1", true, []), seed);
    }
    expect(state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!.contract!.renewalProposal).not.toBeNull();

    let lostEventSeen = false;
    for (let i = 0; i < 5 && !lostEventSeen; i++) {
      state = simulateMonth(state, monthActions("conseil-1", true, []), seed);
      lostEventSeen = state.events.some((e) => e.kind === "strategic-account-lost");
    }
    expect(lostEventSeen).toBe(true);
    const opportunity = state.businesses[0]!.strategicAccountOpportunities.find((o) => o.id === opportunityId)!;
    expect(opportunity.status).toBe("lost");
    expect(opportunity.contract).toBeNull();

    // Le mois suivant le départ, l'entreprise continue de fonctionner normalement
    // (capacité réellement libérée, réabsorbable par new/repeat — aucune exception).
    const next = simulateMonth(state, monthActions("conseil-1", true, []), seed);
    expect(next.businesses[0]).toBeDefined();
  });
});
