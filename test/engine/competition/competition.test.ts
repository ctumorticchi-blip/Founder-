import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  advanceAggregateCompetition,
  availableDemandShare,
  createAggregateCompetition,
} from "../../../src/engine/competition/competition.js";
import type { Market } from "../../../src/types/market.js";

const MARKET: Market = {
  id: "nettoyage-local",
  family: "service",
  sizeMonthlyRevenuePotential: 1_000_000,
  growthRateMonthly: 0.01,
  averageMargin: 0.4,
  fragmentation: 0.8,
  competitiveIntensity: 0.7,
  capitalIntensity: 0.1,
  regulation: 0.2,
  innovationRate: 0.1,
  priceSensitivity: 0.5,
  entryBarriers: 0.1,
  cyclicality: 0.3,
};

describe("createAggregateCompetition", () => {
  it("est déterministe pour une même seed", () => {
    const a = createAggregateCompetition(MARKET.id, createRng(1));
    const b = createAggregateCompetition(MARKET.id, createRng(1));
    expect(a).toEqual(b);
  });

  it("produit une part captée et une qualité dans [0, 1]", () => {
    const competition = createAggregateCompetition(MARKET.id, createRng(1));
    expect(competition.totalCapturedRevenueShare).toBeGreaterThanOrEqual(0);
    expect(competition.totalCapturedRevenueShare).toBeLessThanOrEqual(1);
    expect(competition.averageQuality).toBeGreaterThanOrEqual(0);
    expect(competition.averageQuality).toBeLessThanOrEqual(1);
  });
});

describe("advanceAggregateCompetition", () => {
  it("reste borné dans [0, 0.95] même sur un horizon long", () => {
    let competition = createAggregateCompetition(MARKET.id, createRng(1));
    const rng = createRng(5);
    for (let i = 0; i < 200; i++) {
      competition = advanceAggregateCompetition(competition, MARKET, rng.fork(`m${i}`));
      expect(competition.totalCapturedRevenueShare).toBeGreaterThanOrEqual(0);
      expect(competition.totalCapturedRevenueShare).toBeLessThanOrEqual(0.95);
    }
  });

  it("une forte intensité concurrentielle pousse statistiquement la part captée vers le haut", () => {
    const lowIntensityMarket: Market = { ...MARKET, competitiveIntensity: 0.05 };
    const highIntensityMarket: Market = { ...MARKET, competitiveIntensity: 0.95 };
    const start = { marketId: MARKET.id, totalCapturedRevenueShare: 0.5, averageQuality: 0.5 };
    const rng = createRng(9);
    let lowTotal = 0;
    let highTotal = 0;
    const trials = 300;
    for (let i = 0; i < trials; i++) {
      lowTotal += advanceAggregateCompetition(start, lowIntensityMarket, rng.fork(`low${i}`)).totalCapturedRevenueShare;
      highTotal += advanceAggregateCompetition(start, highIntensityMarket, rng.fork(`high${i}`)).totalCapturedRevenueShare;
    }
    expect(highTotal / trials).toBeGreaterThan(lowTotal / trials);
  });
});

describe("availableDemandShare", () => {
  it("est le complément de la part captée", () => {
    expect(availableDemandShare({ marketId: "x", totalCapturedRevenueShare: 0.3, averageQuality: 0.5 })).toBeCloseTo(0.7);
  });
});
