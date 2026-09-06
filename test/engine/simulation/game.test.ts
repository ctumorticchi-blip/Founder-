import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import type { Market } from "../../../src/types/market.js";

const SERVICE_MARKET: Market = {
  id: "nettoyage-local",
  family: "service",
  sizeMonthlyRevenuePotential: 500_000,
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

const SUBSCRIPTION_MARKET: Market = {
  ...SERVICE_MARKET,
  id: "saas-niche",
  family: "subscription",
};

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };

describe("createInitialGameState", () => {
  it("démarre conforme à la spec §4.1 : 0 €, aucune entreprise, aucun emploi", () => {
    const state = createInitialGameState(1, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    expect(state.character.cash).toBe(0);
    expect(state.businesses).toEqual([]);
    expect(state.job).toBeNull();
    expect(state.events).toEqual([]);
    expect(state.memory).toEqual([]);
  });

  it("est déterministe pour une même seed", () => {
    const a = createInitialGameState(42, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    const b = createInitialGameState(42, BIRTH_DATE, START_DATE, [SERVICE_MARKET]);
    expect(a).toEqual(b);
  });

  it("accepte plusieurs marchés (spec de consolidation §3) et crée une concurrence par marché", () => {
    const state = createInitialGameState(7, BIRTH_DATE, START_DATE, [SERVICE_MARKET, SUBSCRIPTION_MARKET]);
    expect(Object.keys(state.markets).sort()).toEqual(["nettoyage-local", "saas-niche"]);
    expect(Object.keys(state.competitions).sort()).toEqual(["nettoyage-local", "saas-niche"]);
  });

  it("rejette une liste de marchés vide", () => {
    expect(() => createInitialGameState(1, BIRTH_DATE, START_DATE, [])).toThrow(RangeError);
  });

  it("rejette des identifiants de marché dupliqués", () => {
    expect(() => createInitialGameState(1, BIRTH_DATE, START_DATE, [SERVICE_MARKET, SERVICE_MARKET])).toThrow(RangeError);
  });
});
