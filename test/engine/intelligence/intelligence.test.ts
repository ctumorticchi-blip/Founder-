import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { projectCompetitorView, projectMarketView } from "../../../src/engine/intelligence/intelligence.js";
import type { Market } from "../../../src/types/market.js";
import type { Competitor } from "../../../src/types/competition.js";

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

const COMPETITOR: Competitor = {
  id: "nettoyage-local:competitor:0",
  name: "Ateliers Berthier",
  marketId: "nettoyage-local",
  tier: "identified",
  strength: 0.5,
  qualityLevel: 0.8,
};

describe("projectCompetitorView", () => {
  it("est déterministe : même seed + mêmes compétences -> même vue", () => {
    const a = projectCompetitorView(COMPETITOR, 0.2, 50, createRng(1));
    const b = projectCompetitorView(COMPETITOR, 0.2, 50, createRng(1));
    expect(a).toEqual(b);
  });

  it("ne bruite jamais le nom du concurrent (une identité n'est pas une grandeur économique)", () => {
    const view = projectCompetitorView(COMPETITOR, 0.2, 20, createRng(1));
    expect(view.name).toBe(COMPETITOR.name);
    expect(view.id).toBe(COMPETITOR.id);
  });

  it("un qualityLevel élevé produit un positionLevel 'premium' sur la majorité des tirages", () => {
    const highQuality: Competitor = { ...COMPETITOR, qualityLevel: 0.95 };
    const rng = createRng(2);
    let premiumCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      if (projectCompetitorView(highQuality, 0.2, 80, rng.fork(`t${i}`)).positionLevel === "premium") {
        premiumCount += 1;
      }
    }
    expect(premiumCount / trials).toBeGreaterThan(0.7);
  });

  it("un qualityLevel faible produit un positionLevel 'economy' sur la majorité des tirages", () => {
    const lowQuality: Competitor = { ...COMPETITOR, qualityLevel: 0.05 };
    const rng = createRng(3);
    let economyCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      if (projectCompetitorView(lowQuality, 0.2, 80, rng.fork(`t${i}`)).positionLevel === "economy") {
        economyCount += 1;
      }
    }
    expect(economyCount / trials).toBeGreaterThan(0.7);
  });

  it("une part de marché élevée produit un shareLevel 'high' sur la majorité des tirages", () => {
    const rng = createRng(4);
    let highCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      if (projectCompetitorView(COMPETITOR, 0.5, 80, rng.fork(`t${i}`)).shareLevel === "high") {
        highCount += 1;
      }
    }
    expect(highCount / trials).toBeGreaterThan(0.7);
  });

  it("une part de marché faible produit un shareLevel 'low' sur la majorité des tirages", () => {
    const rng = createRng(5);
    let lowCount = 0;
    const trials = 100;
    for (let i = 0; i < trials; i++) {
      if (projectCompetitorView(COMPETITOR, 0.02, 80, rng.fork(`t${i}`)).shareLevel === "low") {
        lowCount += 1;
      }
    }
    expect(lowCount / trials).toBeGreaterThan(0.7);
  });

  it("le bruit n'est jamais nul même à compétence maximale (frontière de bucket observable dans les deux paliers)", () => {
    const borderlineCompetitor: Competitor = { ...COMPETITOR, qualityLevel: 0.7 }; // pile la frontière standard/premium
    const rng = createRng(10);
    const levels = new Set<string>();
    for (let i = 0; i < 200; i++) {
      levels.add(projectCompetitorView(borderlineCompetitor, 0.2, 100, rng.fork(`s${i}`)).positionLevel);
    }
    // Même à compétence 100, `estimate()` garde un bruit non nul (spec §9) :
    // pile à la frontière, les deux paliers voisins doivent apparaître.
    expect(levels.has("standard")).toBe(true);
    expect(levels.has("premium")).toBe(true);
  });
});
