import { describe, expect, it } from "vitest";
import { computeOfferDemand, computeSegmentFit } from "../../../src/engine/market/demand.js";
import { getMarketSegments } from "../../../src/engine/market/segments.js";
import type { CustomerSegment } from "../../../src/types/customerSegment.js";
import type { Market } from "../../../src/types/market.js";
import type { Offer } from "../../../src/types/offer.js";

const DATE = { year: 2026, month: 6 };

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-1",
    name: "Offre Test",
    businessModel: "service-hours",
    positioning: "standard",
    targetSegment: "",
    price: 45,
    status: "launched",
    maturity: 100,
    qualityLevel: 60,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: { year: 2026, month: 1 },
    launchedAt: { year: 2026, month: 1 },
    lastDemand: null,
    customerMemory: [],
    ...overrides,
  };
}

function segment(overrides: Partial<CustomerSegment> = {}): CustomerSegment {
  return {
    id: "seg-1",
    label: "Segment Test",
    relativeSize: 1,
    referencePrice: 45,
    preferredPositioning: "standard",
    priceSensitivity: 0.5,
    qualityExpectation: 55,
    trustImportance: 0.5,
    structuralTrend: 0,
    seasonality: Array(12).fill(1),
    ...overrides,
  };
}

const MARKET: Market = {
  id: "market-1",
  family: "service",
  sizeMonthlyRevenuePotential: 2_000_000,
  growthRateMonthly: 0.01,
  averageMargin: 0.4,
  fragmentation: 0.8,
  competitiveIntensity: 0.3,
  capitalIntensity: 0.1,
  regulation: 0.2,
  innovationRate: 0.1,
  priceSensitivity: 0.5,
  entryBarriers: 0.2,
  cyclicality: 0.3,
};

describe("computeSegmentFit (spec M11.2.2 §3)", () => {
  it("un prix conforme à la référence donne un priceFit élevé", () => {
    const fit = computeSegmentFit(offer({ price: 45 }), segment({ referencePrice: 45 }), 0.5, false);
    expect(fit.priceFit).toBeGreaterThan(0.9);
  });

  it("un prix très supérieur pénalise davantage un segment sensible qu'un segment insensible", () => {
    const expensive = offer({ price: 90 });
    const sensitive = computeSegmentFit(expensive, segment({ referencePrice: 45, priceSensitivity: 0.9 }), 0.5, false);
    const insensitive = computeSegmentFit(expensive, segment({ referencePrice: 45, priceSensitivity: 0.1 }), 0.5, false);
    expect(sensitive.priceFit).toBeLessThan(insensitive.priceFit);
  });

  it("un prix inférieur à la référence n'est jamais pénalisé", () => {
    const cheap = computeSegmentFit(offer({ price: 20 }), segment({ referencePrice: 45, priceSensitivity: 0.9 }), 0.5, false);
    expect(cheap.priceFit).toBeGreaterThanOrEqual(0.9);
  });

  it("une qualité sous l'exigence du segment réduit qualityFit ; au-dessus, qualityFit plafonne", () => {
    const low = computeSegmentFit(offer({ qualityLevel: 20 }), segment({ qualityExpectation: 60 }), 0.5, false);
    const high = computeSegmentFit(offer({ qualityLevel: 90 }), segment({ qualityExpectation: 60 }), 0.5, false);
    expect(low.qualityFit).toBeLessThan(1);
    expect(high.qualityFit).toBe(1);
  });

  it("le positionnement influence le fit : un écart plus grand donne un positioningFit plus faible", () => {
    const exact = computeSegmentFit(offer({ positioning: "premium" }), segment({ preferredPositioning: "premium" }), 0.5, false);
    const near = computeSegmentFit(offer({ positioning: "standard" }), segment({ preferredPositioning: "premium" }), 0.5, false);
    const far = computeSegmentFit(offer({ positioning: "economy" }), segment({ preferredPositioning: "premium" }), 0.5, false);
    expect(exact.positioningFit).toBeGreaterThan(near.positioningFit);
    expect(near.positioningFit).toBeGreaterThan(far.positioningFit);
  });

  it("une meilleure réputation augmente trustFit et l'overallFit d'un segment qui y tient", () => {
    const lowRep = computeSegmentFit(offer(), segment({ trustImportance: 0.9 }), 0.1, false);
    const highRep = computeSegmentFit(offer(), segment({ trustImportance: 0.9 }), 0.9, false);
    expect(highRep.trustFit).toBeGreaterThan(lowRep.trustFit);
    expect(highRep.overallFit).toBeGreaterThan(lowRep.overallFit);
  });

  it("le ciblage principal donne un avantage, jamais une exclusivité", () => {
    const targeted = computeSegmentFit(offer(), segment(), 0.5, true);
    const untargeted = computeSegmentFit(offer(), segment(), 0.5, false);
    expect(targeted.overallFit).toBeGreaterThan(untargeted.overallFit);
    expect(untargeted.overallFit).toBeGreaterThan(0); // jamais nul : pas d'exclusivité
  });

  it("est déterministe (mêmes entrées -> même résultat)", () => {
    const a = computeSegmentFit(offer(), segment(), 0.5, false);
    const b = computeSegmentFit(offer(), segment(), 0.5, false);
    expect(a).toEqual(b);
  });

  it("toutes les composantes restent dans [0,1]", () => {
    const fit = computeSegmentFit(offer({ price: 10_000, qualityLevel: 0 }), segment(), 0, false);
    for (const value of Object.values(fit)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe("computeOfferDemand (spec M11.2.2 §4-§7)", () => {
  const segments = getMarketSegments("service");
  const baseParams = { demandShare: 1, reputationScore: 0.5, prospectionHours: 40, date: DATE };

  it("l'entonnoir est cohérent : availableMarket >= reached >= interested, demand > 0", () => {
    const result = computeOfferDemand(offer(), MARKET, segments, baseParams);
    expect(result.availableMarket).toBeGreaterThanOrEqual(result.reached);
    expect(result.reached).toBeGreaterThanOrEqual(result.interested);
    expect(result.demand).toBeGreaterThan(0);
  });

  it("une faible visibilité (aucune prospection, faible réputation) réduit reached même avec une excellente offre", () => {
    const excellent = offer({ price: 40, qualityLevel: 100, positioning: "standard" });
    const highVisibility = computeOfferDemand(excellent, MARKET, segments, { ...baseParams, prospectionHours: 160, reputationScore: 1 });
    const lowVisibility = computeOfferDemand(excellent, MARKET, segments, { ...baseParams, prospectionHours: 0, reputationScore: 0 });
    expect(lowVisibility.reached).toBeLessThan(highVisibility.reached);
    // Le fit reste bon dans les deux cas : la cause de la faible demande est bien la visibilité.
    expect(lowVisibility.fit.overallFit).toBeCloseTo(highVisibility.fit.overallFit, 1);
  });

  it("une mauvaise offre malgré une forte visibilité génère peu d'intérêt", () => {
    const badOffer = offer({ price: 500, qualityLevel: 5, positioning: "economy" }); // cher, mauvais, mal positionné pour ce marché
    const highVisibility = computeOfferDemand(badOffer, MARKET, segments, { ...baseParams, prospectionHours: 160, reputationScore: 1 });
    const goodOffer = offer({ price: 45, qualityLevel: 80, positioning: "standard" });
    const sameVisibilityGoodOffer = computeOfferDemand(goodOffer, MARKET, segments, { ...baseParams, prospectionHours: 160, reputationScore: 1 });
    expect(highVisibility.interested).toBeLessThan(sameVisibilityGoodOffer.interested);
    expect(highVisibility.reached).toBeCloseTo(sameVisibilityGoodOffer.reached, -1);
  });

  it("le segment principal déclaré n'est pas nécessairement celui qui achète le plus", () => {
    // Offre positionnée/prix pour séduire un segment premium, mais ciblée sur le segment économique.
    const budgetSegment = segments.find((s) => s.preferredPositioning === "economy")!;
    const premiumSegment = segments.find((s) => s.preferredPositioning === "premium")!;
    const result = computeOfferDemand(
      offer({ price: premiumSegment.referencePrice, qualityLevel: 90, positioning: "premium", targetSegment: budgetSegment.id }),
      MARKET,
      segments,
      baseParams,
    );
    expect(result.topSegmentId).toBe(premiumSegment.id);
    expect(result.topSegmentId).not.toBe(budgetSegment.id);
  });

  it("la saisonnalité fait varier la demande d'un mois à l'autre pour un segment saisonnier", () => {
    const seasonalSegment = segments.find((s) => new Set(s.seasonality).size > 1)!;
    const [lowMonthIndex] = seasonalSegment.seasonality
      .map((value, index) => [index, value] as const)
      .sort((a, b) => a[1] - b[1])[0]!;
    const [highMonthIndex] = seasonalSegment.seasonality
      .map((value, index) => [index, value] as const)
      .sort((a, b) => b[1] - a[1])[0]!;
    const low = computeOfferDemand(offer(), MARKET, [seasonalSegment], { ...baseParams, date: { year: 2026, month: lowMonthIndex + 1 } });
    const high = computeOfferDemand(offer(), MARKET, [seasonalSegment], { ...baseParams, date: { year: 2026, month: highMonthIndex + 1 } });
    expect(high.demand).toBeGreaterThan(low.demand);
  });

  it("la tendance structurelle fait évoluer la demande avec l'ancienneté de l'offre", () => {
    const growingSegment = segments.find((s) => s.structuralTrend > 0)!;
    const young = computeOfferDemand(offer({ createdAt: DATE }), MARKET, [growingSegment], baseParams);
    const old = computeOfferDemand(offer({ createdAt: { year: 2020, month: 1 } }), MARKET, [growingSegment], baseParams);
    expect(old.demand).toBeGreaterThan(young.demand);
  });

  it("demandShare réduit la demande proportionnellement (concurrence)", () => {
    const full = computeOfferDemand(offer(), MARKET, segments, { ...baseParams, demandShare: 1 });
    const halved = computeOfferDemand(offer(), MARKET, segments, { ...baseParams, demandShare: 0.5 });
    expect(halved.demand).toBeCloseTo(full.demand / 2, 5);
  });

  it("bucketage : offre chère -> priceSignal 'high' ; offre alignée -> 'fair'", () => {
    const cheap = computeOfferDemand(offer({ price: 45 }), MARKET, segments, baseParams);
    const expensive = computeOfferDemand(offer({ price: 300 }), MARKET, segments, baseParams);
    expect(expensive.priceSignal).toBe("high");
    expect(cheap.priceSignal).not.toBe("high");
  });

  it("bucketage : visibilité nulle -> 'low' ; visibilité maximale -> 'high'", () => {
    const low = computeOfferDemand(offer(), MARKET, segments, { ...baseParams, prospectionHours: 0, reputationScore: 0 });
    const high = computeOfferDemand(offer(), MARKET, segments, { ...baseParams, prospectionHours: 160, reputationScore: 1 });
    expect(low.visibilityLevel).toBe("low");
    expect(high.visibilityLevel).toBe("high");
  });

  it("ne fuite aucun coefficient interne : les clés du résultat sont exactement celles attendues", () => {
    const result = computeOfferDemand(offer(), MARKET, segments, baseParams);
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(
      // "bySegment" ajouté en M11.2.3 (spec §2.2) : extension additive, la boucle par segment
      // existait déjà en interne, seule son exposition est nouvelle (jamais un nouveau coefficient).
      ["availableMarket", "bySegment", "demand", "demandSignal", "fit", "interested", "priceSignal", "reached", "topSegmentId", "topSegmentLabel", "visibilityLevel"].sort(),
    );
    expect(Object.keys(result.fit).sort()).toEqual(["overallFit", "positioningFit", "priceFit", "qualityFit", "trustFit"].sort());
    for (const entry of result.bySegment) {
      expect(Object.keys(entry).sort()).toEqual(["demand", "fit", "segmentId", "segmentLabel"].sort());
    }
  });

  it("est déterministe (mêmes entrées -> même résultat, aucun aléa)", () => {
    const a = computeOfferDemand(offer(), MARKET, segments, baseParams);
    const b = computeOfferDemand(offer(), MARKET, segments, baseParams);
    expect(a).toEqual(b);
  });

  it("bySegment a une entrée par segment fourni, dont la somme des demandes égale la demande totale", () => {
    const result = computeOfferDemand(offer(), MARKET, segments, baseParams);
    expect(result.bySegment).toHaveLength(segments.length);
    const sum = result.bySegment.reduce((acc, entry) => acc + entry.demand, 0);
    expect(sum).toBeCloseTo(result.demand, 6);
  });

  it("organicWordOfMouth omis produit un résultat strictement identique à un appel avec 0 explicite (non-régression M11.2.2)", () => {
    const omitted = computeOfferDemand(offer(), MARKET, segments, baseParams);
    const explicitZero = computeOfferDemand(offer(), MARKET, segments, { ...baseParams, organicWordOfMouth: 0 });
    expect(omitted).toEqual(explicitZero);
  });

  it("un organicWordOfMouth élevé augmente la visibilité, donc la demande, toutes choses égales par ailleurs", () => {
    const withoutWom = computeOfferDemand(offer(), MARKET, segments, { ...baseParams, prospectionHours: 0, reputationScore: 0 });
    const withWom = computeOfferDemand(offer(), MARKET, segments, {
      ...baseParams,
      prospectionHours: 0,
      reputationScore: 0,
      organicWordOfMouth: 0.25,
    });
    expect(withWom.reached).toBeGreaterThan(withoutWom.reached);
    expect(withWom.demand).toBeGreaterThan(withoutWom.demand);
  });
});
