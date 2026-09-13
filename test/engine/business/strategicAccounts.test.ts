import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS,
  advanceStrategicAccountOpportunities,
  findEligibleStrategicAccountSlots,
} from "../../../src/engine/business/strategicAccounts.js";
import type { Offer } from "../../../src/types/offer.js";
import type { StrategicAccountOpportunity } from "../../../src/types/strategicAccount.js";

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
