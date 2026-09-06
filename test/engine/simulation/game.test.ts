import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../../../src/engine/simulation/game.js";
import type { Market } from "../../../src/types/market.js";

const MARKET: Market = {
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

const BIRTH_DATE = { year: 2008, month: 1 };
const START_DATE = { year: 2026, month: 1 };

describe("createInitialGameState", () => {
  it("démarre conforme à la spec §4.1 : 0 €, aucune entreprise, aucun emploi", () => {
    const state = createInitialGameState(1, BIRTH_DATE, START_DATE, MARKET);
    expect(state.character.cash).toBe(0);
    expect(state.playerBusiness).toBeNull();
    expect(state.job).toBeNull();
    expect(state.events).toEqual([]);
    expect(state.memory).toEqual([]);
  });

  it("est déterministe pour une même seed", () => {
    const a = createInitialGameState(42, BIRTH_DATE, START_DATE, MARKET);
    const b = createInitialGameState(42, BIRTH_DATE, START_DATE, MARKET);
    expect(a).toEqual(b);
  });
});
