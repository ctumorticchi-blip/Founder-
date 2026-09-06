import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { createInitialMacroState } from "../../../src/engine/world/world.js";
import { advanceMarket, detectMarketInefficiency } from "../../../src/engine/market/market.js";
import type { Market } from "../../../src/types/market.js";
import type { AggregateCompetition } from "../../../src/types/competition.js";

const MARKET: Market = {
  id: "nettoyage-local",
  family: "service",
  sizeMonthlyRevenuePotential: 1_000_000,
  growthRateMonthly: 0.01,
  averageMargin: 0.4,
  fragmentation: 0.8,
  competitiveIntensity: 0.3,
  capitalIntensity: 0.1,
  regulation: 0.2,
  innovationRate: 0.1,
  priceSensitivity: 0.5,
  entryBarriers: 0.1,
  cyclicality: 0.3,
};

describe("advanceMarket", () => {
  it("est déterministe pour un même seed", () => {
    const macro = createInitialMacroState({ year: 2026, month: 1 });
    const a = advanceMarket(MARKET, macro, createRng(1));
    const b = advanceMarket(MARKET, macro, createRng(1));
    expect(a).toEqual(b);
  });

  it("fait croître la taille du marché en moyenne (croissance structurelle positive)", () => {
    const macro = createInitialMacroState({ year: 2026, month: 1 });
    const rng = createRng(42);
    let total = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const next = advanceMarket(MARKET, macro, rng.fork(`t${i}`));
      total += next.sizeMonthlyRevenuePotential;
    }
    const average = total / trials;
    expect(average).toBeGreaterThan(MARKET.sizeMonthlyRevenuePotential);
  });

  it("ne descend jamais sous 0", () => {
    const macro = createInitialMacroState({ year: 2026, month: 1 });
    const shrinkingMarket: Market = { ...MARKET, sizeMonthlyRevenuePotential: 1, growthRateMonthly: -0.9 };
    const next = advanceMarket(shrinkingMarket, macro, createRng(1));
    expect(next.sizeMonthlyRevenuePotential).toBeGreaterThanOrEqual(0);
  });
});

describe("detectMarketInefficiency", () => {
  it("détecte une opportunité sur un marché attractif et peu capté", () => {
    const lowCompetition: AggregateCompetition = {
      marketId: MARKET.id,
      totalCapturedRevenueShare: 0.2,
      averageQuality: 0.3,
    };
    const attractiveMarket: Market = { ...MARKET, averageMargin: 0.6, competitiveIntensity: 0.1, entryBarriers: 0.1 };
    const inefficiency = detectMarketInefficiency(attractiveMarket, lowCompetition);
    expect(inefficiency).not.toBeNull();
    expect(inefficiency!.opportunityScore).toBeGreaterThan(0);
  });

  it("ne détecte rien sur un marché déjà saturé par la concurrence", () => {
    const highCompetition: AggregateCompetition = {
      marketId: MARKET.id,
      totalCapturedRevenueShare: 0.9,
      averageQuality: 0.8,
    };
    const toughMarket: Market = { ...MARKET, averageMargin: 0.1, competitiveIntensity: 0.9, entryBarriers: 0.8 };
    expect(detectMarketInefficiency(toughMarket, highCompetition)).toBeNull();
  });
});
