import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { projectMarketView } from "../../../src/engine/intelligence/intelligence.js";
import type { Market } from "../../../src/types/market.js";

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

describe("projectMarketView", () => {
  it("est déterministe : même seed + mêmes compétences -> même estimation", () => {
    const a = projectMarketView(MARKET, { finance: 50, strategie: 50 }, createRng(1));
    const b = projectMarketView(MARKET, { finance: 50, strategie: 50 }, createRng(1));
    expect(a).toEqual(b);
  });

  it("l'incertitude diminue quand les compétences augmentent, sans jamais atteindre 0", () => {
    const noviceRng = createRng(1);
    const expertRng = createRng(1);
    const novice = projectMarketView(MARKET, { finance: 1, strategie: 1 }, noviceRng);
    const expert = projectMarketView(MARKET, { finance: 100, strategie: 100 }, expertRng);

    expect(expert.sizeMonthlyRevenuePotential.uncertainty).toBeLessThan(
      novice.sizeMonthlyRevenuePotential.uncertainty,
    );
    expect(expert.sizeMonthlyRevenuePotential.uncertainty).toBeGreaterThan(0);
  });

  it("la valeur estimée reste dans un ordre de grandeur raisonnable de la vérité", () => {
    const rng = createRng(3);
    const view = projectMarketView(MARKET, { finance: 60, strategie: 60 }, rng);
    expect(view.sizeMonthlyRevenuePotential.value).toBeGreaterThan(0);
    expect(Math.abs(view.sizeMonthlyRevenuePotential.value - MARKET.sizeMonthlyRevenuePotential)).toBeLessThan(
      MARKET.sizeMonthlyRevenuePotential,
    );
  });

  it("deux marchés différents ne produisent pas la même estimation bruitée", () => {
    const rng = createRng(4);
    const viewA = projectMarketView(MARKET, { finance: 50, strategie: 50 }, rng);
    const viewB = projectMarketView({ ...MARKET, id: "autre-marche" }, { finance: 50, strategie: 50 }, rng);
    expect(viewA.sizeMonthlyRevenuePotential.value).not.toBe(viewB.sizeMonthlyRevenuePotential.value);
  });
});
