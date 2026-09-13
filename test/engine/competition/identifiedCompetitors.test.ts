import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  IDENTIFIED_COMPETITORS_PER_MARKET,
  advanceIdentifiedCompetitors,
  computeCompetitorMarketShare,
  createIdentifiedCompetitors,
} from "../../../src/engine/competition/identifiedCompetitors.js";
import type { AggregateCompetition, Competitor } from "../../../src/types/competition.js";

const AGGREGATE: AggregateCompetition = {
  marketId: "nettoyage-local",
  totalCapturedRevenueShare: 0.6,
  averageQuality: 0.5,
};

describe("createIdentifiedCompetitors", () => {
  it("est déterministe pour une même seed", () => {
    const a = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const b = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    expect(a).toEqual(b);
  });

  it("produit exactement IDENTIFIED_COMPETITORS_PER_MARKET concurrents, tous du bon marché et tier", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    expect(competitors).toHaveLength(IDENTIFIED_COMPETITORS_PER_MARKET);
    for (const competitor of competitors) {
      expect(competitor.marketId).toBe(AGGREGATE.marketId);
      expect(competitor.tier).toBe("identified");
      expect(competitor.strength).toBeGreaterThanOrEqual(0);
      expect(competitor.strength).toBeLessThanOrEqual(1);
      expect(competitor.qualityLevel).toBeGreaterThanOrEqual(0);
      expect(competitor.qualityLevel).toBeLessThanOrEqual(1);
      expect(competitor.name.length).toBeGreaterThan(0);
    }
  });

  it("produit des noms distincts entre eux", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const names = new Set(competitors.map((c) => c.name));
    expect(names.size).toBe(competitors.length);
  });

  it("produit des identifiants distincts entre eux", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const ids = new Set(competitors.map((c) => c.id));
    expect(ids.size).toBe(competitors.length);
  });

  it("deux marchés différents produisent des concurrents différents (rng dérivée par marché)", () => {
    const a = createIdentifiedCompetitors("marche-a", AGGREGATE, createRng(1));
    const b = createIdentifiedCompetitors("marche-b", AGGREGATE, createRng(1));
    expect(a).not.toEqual(b);
  });
});

describe("computeCompetitorMarketShare", () => {
  it("la somme des parts de tous les concurrents d'un marché égale la part captée de l'agrégat", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const totalShare = competitors.reduce(
      (sum, competitor) => sum + computeCompetitorMarketShare(competitor, competitors, AGGREGATE),
      0,
    );
    expect(totalShare).toBeCloseTo(AGGREGATE.totalCapturedRevenueShare, 10);
  });

  it("un concurrent à force double d'un autre (mêmes autres concurrents) capte une part double", () => {
    const base = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const [first, second, ...rest] = base;
    const doubledFirst = { ...first!, strength: second!.strength * 2 };
    const doubledSecond = { ...second!, strength: second!.strength };
    const competitors = [doubledFirst, doubledSecond, ...rest];
    const shareFirst = computeCompetitorMarketShare(doubledFirst, competitors, AGGREGATE);
    const shareSecond = computeCompetitorMarketShare(doubledSecond, competitors, AGGREGATE);
    expect(shareFirst).toBeCloseTo(shareSecond * 2, 10);
  });

  it("ne renvoie jamais une part négative", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    for (const competitor of competitors) {
      expect(computeCompetitorMarketShare(competitor, competitors, AGGREGATE)).toBeGreaterThanOrEqual(0);
    }
  });

  it("renvoie 0 pour une liste de concurrents vide sans exception", () => {
    expect(computeCompetitorMarketShare({ id: "x", name: "X", marketId: "m", tier: "identified", strength: 0.5, qualityLevel: 0.5 }, [], AGGREGATE)).toBe(0);
  });
});

describe("advanceIdentifiedCompetitors", () => {
  it("est déterministe pour une même seed", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const a = advanceIdentifiedCompetitors(competitors, AGGREGATE, createRng(9));
    const b = advanceIdentifiedCompetitors(competitors, AGGREGATE, createRng(9));
    expect(a).toEqual(b);
  });

  it("préserve identité/nombre/marché des concurrents (seuls strength/qualityLevel dérivent)", () => {
    const competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const advanced = advanceIdentifiedCompetitors(competitors, AGGREGATE, createRng(9));
    expect(advanced).toHaveLength(competitors.length);
    for (let i = 0; i < competitors.length; i++) {
      expect(advanced[i]!.id).toBe(competitors[i]!.id);
      expect(advanced[i]!.name).toBe(competitors[i]!.name);
      expect(advanced[i]!.marketId).toBe(competitors[i]!.marketId);
    }
  });

  it("reste borné dans [0.05, 1] pour strength et [0, 1] pour qualityLevel même sur un horizon long", () => {
    let competitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1));
    const rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      competitors = advanceIdentifiedCompetitors(competitors, AGGREGATE, rng.fork(`m${i}`));
      for (const competitor of competitors) {
        expect(competitor.strength).toBeGreaterThanOrEqual(0.05);
        expect(competitor.strength).toBeLessThanOrEqual(1);
        expect(competitor.qualityLevel).toBeGreaterThanOrEqual(0);
        expect(competitor.qualityLevel).toBeLessThanOrEqual(1);
      }
    }
  });

  it("qualityLevel dérive statistiquement vers aggregate.averageQuality depuis un point éloigné", () => {
    const farCompetitors = createIdentifiedCompetitors(AGGREGATE.marketId, AGGREGATE, createRng(1)).map((c) => ({
      ...c,
      qualityLevel: 0.95,
    }));
    const lowQualityAggregate: AggregateCompetition = { ...AGGREGATE, averageQuality: 0.1 };
    const rng = createRng(3);
    let current: readonly Competitor[] = farCompetitors;
    for (let i = 0; i < 60; i++) {
      current = advanceIdentifiedCompetitors(current, lowQualityAggregate, rng.fork(`step${i}`));
    }
    const averageFinalQuality = current.reduce((sum, c) => sum + c.qualityLevel, 0) / current.length;
    expect(averageFinalQuality).toBeLessThan(0.95);
  });
});
