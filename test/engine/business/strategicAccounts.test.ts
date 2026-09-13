import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS,
  advanceStrategicAccountOpportunities,
  applyResearchHours,
  applyStrategicAccountActions,
  computeBudgetEstimate,
  deriveTrueOpportunityBudget,
  findEligibleStrategicAccountSlots,
  resolveAccountNegotiationDecision,
} from "../../../src/engine/business/strategicAccounts.js";
import type { Offer } from "../../../src/types/offer.js";
import type { AccountProposal, StrategicAccountOpportunity } from "../../../src/types/strategicAccount.js";

function agencyOffer(id: string, overrides: Partial<Offer> = {}): Offer {
  return {
    id,
    name: "Mandat conseil",
    businessModel: "project",
    positioning: "premium",
    targetSegment: "agency-grands-comptes",
    price: 8_000,
    status: "launched",
    maturity: 100,
    qualityLevel: 70,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: { year: 2026, month: 1 },
    launchedAt: { year: 2026, month: 1 },
    lastDemand: null,
    customerMemory: [],
    ...overrides,
  };
}

// "agency-grands-comptes" est l'UNIQUE segment agency marqué strategicAccountsEligible (Tâche 1).
// "agency-pme-croissance" sert ici de segment agency NON éligible (catalogue réel, engine/market/segments.ts).
const NON_ELIGIBLE_AGENCY_SEGMENT = "agency-pme-croissance";

describe("findEligibleStrategicAccountSlots (spec M11.2.4.1 §4 — règle corrigée, revue produit 2026-09-13)", () => {
  it("offre lancée + targetSegment éligible -> exactement 1 slot, dont le segmentId est CE targetSegment (jamais un autre segment éligible de la famille)", () => {
    const slots = findEligibleStrategicAccountSlots([agencyOffer("o1", { targetSegment: "agency-grands-comptes" })], "agency");
    expect(slots).toEqual([{ offerId: "o1", segmentId: "agency-grands-comptes" }]);
  });

  it("offre lancée + targetSegment NON éligible -> 0 slot, même si un autre segment de la famille est éligible", () => {
    const slots = findEligibleStrategicAccountSlots([agencyOffer("o1", { targetSegment: NON_ELIGIBLE_AGENCY_SEGMENT })], "agency");
    expect(slots).toEqual([]);
  });

  it("offre NON lancée + targetSegment éligible -> 0 slot", () => {
    const slots = findEligibleStrategicAccountSlots(
      [agencyOffer("o1", { targetSegment: "agency-grands-comptes", status: "in-development" })],
      "agency",
    );
    expect(slots).toEqual([]);
  });

  it("plusieurs offres : un slot exactement par offre lancée dont le targetSegment est éligible, aucun produit cartésien avec les segments non ciblés", () => {
    const offers = [
      agencyOffer("o1", { targetSegment: "agency-grands-comptes" }), // lancée, éligible -> 1 slot
      agencyOffer("o2", { targetSegment: NON_ELIGIBLE_AGENCY_SEGMENT }), // lancée, non éligible -> 0 slot
      agencyOffer("o3", { targetSegment: "agency-grands-comptes", status: "in-development" }), // non lancée -> 0 slot
      agencyOffer("o4", { targetSegment: "agency-grands-comptes" }), // lancée, éligible -> 1 slot
    ];
    const slots = findEligibleStrategicAccountSlots(offers, "agency");
    expect(slots).toEqual([
      { offerId: "o1", segmentId: "agency-grands-comptes" },
      { offerId: "o4", segmentId: "agency-grands-comptes" },
    ]);
  });

  it("aucun slot sans offre lancée", () => {
    expect(findEligibleStrategicAccountSlots([agencyOffer("o1", { status: "in-development" })], "agency")).toEqual([]);
  });

  it("targetSegment inconnu du catalogue de la famille (aucune correspondance) -> 0 slot, jamais une exception", () => {
    expect(findEligibleStrategicAccountSlots([agencyOffer("o1", { targetSegment: "segment-inexistant" })], "agency")).toEqual([]);
  });
});

describe("advanceStrategicAccountOpportunities (spec M11.2.4.1 §15)", () => {
  const DATE = { year: 2026, month: 6 };

  it("est déterministe : mêmes arguments -> même résultat", () => {
    const run = () =>
      advanceStrategicAccountOpportunities({
        businessId: "biz-1",
        offers: [agencyOffer("o1")],
        family: "agency",
        existingOpportunities: [],
        rng: createRng(7),
        date: DATE,
      });
    expect(run()).toEqual(run());
  });

  it("respecte le plafond d'opportunités actives sur un horizon long", () => {
    let opportunities: readonly StrategicAccountOpportunity[] = [];
    for (let month = 0; month < 60; month++) {
      opportunities = advanceStrategicAccountOpportunities({
        businessId: "biz-1",
        offers: [agencyOffer("o1")],
        family: "agency",
        existingOpportunities: opportunities,
        rng: createRng(1).fork(`m:${month}`),
        date: { year: 2026, month: (month % 12) + 1 },
      });
      expect(opportunities.filter((o) => o.status === "researching").length).toBeLessThanOrEqual(
        MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS,
      );
    }
  });

  it("chaque opportunité créée est 'researching', a un id unique, jamais d'écrasement des existantes", () => {
    let opportunities: readonly StrategicAccountOpportunity[] = [];
    for (let month = 0; month < 24; month++) {
      const before = opportunities;
      opportunities = advanceStrategicAccountOpportunities({
        businessId: "biz-1",
        offers: [agencyOffer("o1")],
        family: "agency",
        existingOpportunities: opportunities,
        rng: createRng(99).fork(`m:${month}`),
        date: { year: 2026, month: (month % 12) + 1 },
      });
      expect(opportunities.slice(0, before.length)).toEqual(before);
    }
    for (const o of opportunities) expect(o.status).toBe("researching");
    expect(new Set(opportunities.map((o) => o.id)).size).toBe(opportunities.length);
  });

  // Seed vérifiée déterministiquement (pas une espérance statistique) : rejouer
  // l'algorithme réel du RNG du repo (fnv1a + mulberry32, src/engine/rng/rng.ts)
  // hors-ligne pour la chaîne EXACTE de forks utilisée ici
  // (createRng(2).fork("m:0").fork("o1:agency-grands-comptes").nextBool(0.06))
  // montre que seed=2 déclenche une opportunité DÈS le mois 0 pour ce slot
  // précis. La constante produit STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY
  // (0.06) n'est PAS changée pour faire passer ce test — seule la seed est
  // choisie pour rendre le test déterministe.
  it("crée réellement une opportunité (seed vérifiée déterministiquement, pas une espérance statistique)", () => {
    let opportunities: readonly StrategicAccountOpportunity[] = [];
    for (let month = 0; month < 6 && opportunities.length === 0; month++) {
      opportunities = advanceStrategicAccountOpportunities({
        businessId: "biz-1",
        offers: [agencyOffer("o1")],
        family: "agency",
        existingOpportunities: opportunities,
        rng: createRng(2).fork(`m:${month}`),
        date: { year: 2026, month: (month % 12) + 1 },
      });
    }
    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0]!.segmentId).toBe("agency-grands-comptes");
  });

  it("aucune opportunité pour une famille/offre sans slot éligible (aucune offre lancée)", () => {
    const result = advanceStrategicAccountOpportunities({
      businessId: "biz-1",
      offers: [],
      family: "agency",
      existingOpportunities: [],
      rng: createRng(1),
      date: DATE,
    });
    expect(result).toEqual([]);
  });
});

// Doit correspondre EXACTEMENT au referencePrice réel du segment
// "agency-grands-comptes" (src/engine/market/segments.ts) : les fonctions
// testées ici résolvent elles-mêmes ce prix via referencePriceFor(segmentId,
// family), donc tout écart entre cette constante et le catalogue réel
// produirait un budget "vrai" différent côté test et côté implémentation
// (bug réel découvert pendant l'écriture de ces tests, voir commit).
const REFERENCE_PRICE = 12_000;

describe("deriveTrueOpportunityBudget (spec M11.2.4.2 §8)", () => {
  it("est déterministe : même id + même referencePrice -> même budget", () => {
    expect(deriveTrueOpportunityBudget("opp-1", REFERENCE_PRICE)).toEqual(deriveTrueOpportunityBudget("opp-1", REFERENCE_PRICE));
  });

  it("des ids différents produisent des budgets différents", () => {
    expect(deriveTrueOpportunityBudget("opp-1", REFERENCE_PRICE)).not.toEqual(deriveTrueOpportunityBudget("opp-2", REFERENCE_PRICE));
  });

  it("maxAcceptablePrice reste dans une fourchette raisonnable autour de referencePrice", () => {
    const budget = deriveTrueOpportunityBudget("opp-1", REFERENCE_PRICE);
    expect(budget.maxAcceptablePrice).toBeGreaterThan(REFERENCE_PRICE * 0.8);
    expect(budget.maxAcceptablePrice).toBeLessThan(REFERENCE_PRICE * 1.6);
  });

  it("expectedVolume et minAcceptableQuality restent dans des bornes plausibles", () => {
    const budget = deriveTrueOpportunityBudget("opp-1", REFERENCE_PRICE);
    expect(budget.expectedVolume).toBeGreaterThan(0);
    expect(budget.minAcceptableQuality).toBeGreaterThanOrEqual(0);
    expect(budget.minAcceptableQuality).toBeLessThanOrEqual(100);
  });
});

describe("computeBudgetEstimate (spec M11.2.4.2 §7)", () => {
  it("l'incertitude diminue strictement quand researchHoursInvested augmente", () => {
    const low = computeBudgetEstimate("opp-1", REFERENCE_PRICE, 0);
    const high = computeBudgetEstimate("opp-1", REFERENCE_PRICE, 40);
    expect(high.price.uncertainty).toBeLessThan(low.price.uncertainty);
    expect(high.volume.uncertainty).toBeLessThan(low.volume.uncertainty);
    expect(high.qualityCommitment.uncertainty).toBeLessThan(low.qualityCommitment.uncertainty);
  });

  it("est déterministe pour un nombre d'heures donné", () => {
    expect(computeBudgetEstimate("opp-1", REFERENCE_PRICE, 10)).toEqual(computeBudgetEstimate("opp-1", REFERENCE_PRICE, 10));
  });

  it("l'incertitude ne descend jamais à 0, même très au-delà du seuil de confiance maximale", () => {
    const high = computeBudgetEstimate("opp-1", REFERENCE_PRICE, 1_000);
    expect(high.price.uncertainty).toBeGreaterThan(0);
  });

  it("davantage d'heures ne change plus l'incertitude au-delà du plafond de confiance", () => {
    const atCap = computeBudgetEstimate("opp-1", REFERENCE_PRICE, 40);
    const beyondCap = computeBudgetEstimate("opp-1", REFERENCE_PRICE, 400);
    expect(beyondCap.price.uncertainty).toBeCloseTo(atCap.price.uncertainty);
  });
});

function makeOpportunity(overrides: Partial<StrategicAccountOpportunity> = {}): StrategicAccountOpportunity {
  const id = overrides.id ?? "opp-1";
  return {
    id,
    businessId: "biz-1",
    offerId: "o1",
    segmentId: "agency-grands-comptes",
    companyName: "Cabinet Vasseur",
    contactName: "Camille Marchand",
    contactRole: "Directrice générale",
    source: "network",
    discoveredAt: DATE,
    status: "researching",
    researchHoursInvested: 0,
    budgetEstimate: computeBudgetEstimate(id, REFERENCE_PRICE, 0),
    lastAccountProposal: null,
    contract: null,
    ...overrides,
  };
}

const DATE = { year: 2026, month: 6 };

describe("resolveAccountNegotiationDecision (spec M11.2.4.2 §8)", () => {
  it("une proposition qui respecte le budget réel est acceptée immédiatement -> status won + contract rempli", () => {
    const opp = makeOpportunity();
    const budget = deriveTrueOpportunityBudget(opp.id, REFERENCE_PRICE);
    const proposal: AccountProposal = {
      price: budget.maxAcceptablePrice,
      volume: budget.expectedVolume,
      qualityCommitment: budget.minAcceptableQuality,
      durationMonths: 6,
    };
    const result = resolveAccountNegotiationDecision(opp, "agency", { action: "propose", proposal }, DATE);
    expect(result.status).toBe("won");
    expect(result.contract).toEqual({ ...proposal, monthsRemaining: 6, signedAt: DATE });
    expect(result.lastAccountProposal).toBeNull();
  });

  it("une proposition trop chère est rejetée -> status negotiating + contre-proposition ancrée sur le budget réel", () => {
    const opp = makeOpportunity();
    const budget = deriveTrueOpportunityBudget(opp.id, REFERENCE_PRICE);
    const proposal: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    const result = resolveAccountNegotiationDecision(opp, "agency", { action: "propose", proposal }, DATE);
    expect(result.status).toBe("negotiating");
    expect(result.lastAccountProposal).not.toBeNull();
    expect(result.lastAccountProposal!.price).toBeCloseTo(budget.maxAcceptablePrice);
    expect(result.contract).toBeNull();
  });

  it("une proposition de qualité insuffisante est rejetée même à prix acceptable", () => {
    const opp = makeOpportunity();
    const budget = deriveTrueOpportunityBudget(opp.id, REFERENCE_PRICE);
    const proposal: AccountProposal = { price: budget.maxAcceptablePrice, volume: budget.expectedVolume, qualityCommitment: 0, durationMonths: 6 };
    const result = resolveAccountNegotiationDecision(opp, "agency", { action: "propose", proposal }, DATE);
    expect(result.status).toBe("negotiating");
  });

  it("accepter la contre-proposition du compte signe le contrat avec EXACTEMENT ces valeurs", () => {
    const opp = makeOpportunity();
    const budget = deriveTrueOpportunityBudget(opp.id, REFERENCE_PRICE);
    const tooHigh: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    const negotiating = resolveAccountNegotiationDecision(opp, "agency", { action: "propose", proposal: tooHigh }, DATE);
    const result = resolveAccountNegotiationDecision(negotiating, "agency", { action: "accept" }, DATE);
    expect(result.status).toBe("won");
    expect(result.contract!.price).toBe(negotiating.lastAccountProposal!.price);
    expect(result.contract!.volume).toBe(negotiating.lastAccountProposal!.volume);
  });

  it("accepter sans contre-proposition existante lève une erreur explicite", () => {
    const opp = makeOpportunity();
    expect(() => resolveAccountNegotiationDecision(opp, "agency", { action: "accept" }, DATE)).toThrow();
  });

  it("withdraw -> declined-by-player, jamais de contrat", () => {
    const opp = makeOpportunity();
    const result = resolveAccountNegotiationDecision(opp, "agency", { action: "withdraw" }, DATE);
    expect(result.status).toBe("declined-by-player");
    expect(result.contract).toBeNull();
  });

  it("aucune négociation possible sur un statut terminal (won)", () => {
    const won = makeOpportunity({ status: "won" });
    expect(() => resolveAccountNegotiationDecision(won, "agency", { action: "withdraw" }, DATE)).toThrow();
  });

  it("aucune négociation possible sur un statut terminal (declined-by-player)", () => {
    const declined = makeOpportunity({ status: "declined-by-player" });
    expect(() => resolveAccountNegotiationDecision(declined, "agency", { action: "withdraw" }, DATE)).toThrow();
  });

  it("est déterministe : même opportunité + même décision -> même résultat", () => {
    const opp = makeOpportunity();
    const proposal: AccountProposal = { price: 1, volume: 1, qualityCommitment: 1, durationMonths: 6 };
    expect(resolveAccountNegotiationDecision(opp, "agency", { action: "propose", proposal }, DATE)).toEqual(
      resolveAccountNegotiationDecision(opp, "agency", { action: "propose", proposal }, DATE),
    );
  });
});

describe("applyResearchHours (spec M11.2.4.2 §6, §7)", () => {
  it("accumule researchHoursInvested et raffraîchit budgetEstimate (incertitude réduite)", () => {
    const opp = makeOpportunity();
    const result = applyResearchHours(opp, 10, "agency");
    expect(result.researchHoursInvested).toBe(10);
    expect(result.budgetEstimate.price.uncertainty).toBeLessThan(opp.budgetEstimate.price.uncertainty);
  });

  it("rejette des heures négatives", () => {
    const opp = makeOpportunity();
    expect(() => applyResearchHours(opp, -1, "agency")).toThrow();
  });

  it("n'a aucun effet sur une opportunité déjà à un statut terminal", () => {
    const won = makeOpportunity({ status: "won" });
    const result = applyResearchHours(won, 10, "agency");
    expect(result).toEqual(won);
  });
});

describe("applyStrategicAccountActions (spec M11.2.4.2 §6, §8)", () => {
  it("applique invest-time sur la bonne opportunité, laisse les autres inchangées", () => {
    const a = makeOpportunity({ id: "a" });
    const b = makeOpportunity({ id: "b" });
    const [resultA, resultB] = applyStrategicAccountActions([a, b], [{ kind: "invest-time", opportunityId: "a", hours: 10 }], "agency", DATE);
    expect(resultA!.researchHoursInvested).toBe(10);
    expect(resultB).toEqual(b);
  });

  it("une opportunityId inconnue lève une erreur explicite", () => {
    expect(() => applyStrategicAccountActions([], [{ kind: "invest-time", opportunityId: "x", hours: 1 }], "agency", DATE)).toThrow();
  });

  it("applique propose/accept en séquence sur la même liste", () => {
    const opp = makeOpportunity();
    const budget = deriveTrueOpportunityBudget(opp.id, REFERENCE_PRICE);
    const tooHigh: AccountProposal = { price: budget.maxAcceptablePrice * 2, volume: 10, qualityCommitment: 60, durationMonths: 6 };
    const [afterPropose] = applyStrategicAccountActions([opp], [{ kind: "propose", opportunityId: opp.id, proposal: tooHigh }], "agency", DATE);
    expect(afterPropose!.status).toBe("negotiating");
    const [afterAccept] = applyStrategicAccountActions([afterPropose!], [{ kind: "accept", opportunityId: opp.id }], "agency", DATE);
    expect(afterAccept!.status).toBe("won");
  });
});
