import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { RetailEngine, type RetailEngineState } from "../../../src/engine/economic-models/retail.js";

const STATE: RetailEngineState = {
  unitPrice: 15,
  unitCostOfGoods: 6,
  reputationScore: 0.5,
};

describe("RetailEngine", () => {
  it("expose la famille 'retail'", () => {
    expect(RetailEngine.family).toBe("retail");
  });

  it("ANTI-RÉGRESSION M11.2.3.2 : demande == capacité(stock) -> ventes == demande exactement (aucune seconde loterie commerciale)", () => {
    const rng = createRng(123);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 100, expectedFootTraffic: 100 }, { rng });
    expect(result.unitsSold).toBe(100);
  });

  it("demande < capacité(stock) -> unitsSold == demande (aucune perte)", () => {
    const rng = createRng(1);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 200, expectedFootTraffic: 50 }, { rng });
    expect(result.unitsSold).toBe(50);
  });

  it("ne vend jamais plus d'unités que le stock disponible", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const result = RetailEngine.computeMonth(
        STATE,
        { stockUnits: 50, expectedFootTraffic: 1000 },
        { rng },
      );
      expect(result.unitsSold).toBeLessThanOrEqual(50);
    }
  });

  it("demande > capacité(stock) -> unitsSold == stock exactement", () => {
    const rng = createRng(1);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 50, expectedFootTraffic: 1000 }, { rng });
    expect(result.unitsSold).toBe(50);
  });

  it("revenue et variableCosts sont cohérents avec unitsSold", () => {
    const rng = createRng(2);
    const result = RetailEngine.computeMonth(
      STATE,
      { stockUnits: 200, expectedFootTraffic: 300 },
      { rng },
    );
    expect(result.revenue).toBeCloseTo(result.unitsSold * STATE.unitPrice);
    expect(result.variableCosts).toBeCloseTo(result.unitsSold * STATE.unitCostOfGoods);
  });

  it("sans trafic, aucune vente n'est possible", () => {
    const rng = createRng(3);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 100, expectedFootTraffic: 0 }, { rng });
    expect(result.unitsSold).toBe(0);
  });

  it("stock nul -> aucune vente même si la demande est positive", () => {
    const rng = createRng(3);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 0, expectedFootTraffic: 100 }, { rng });
    expect(result.unitsSold).toBe(0);
  });

  it("déterminisme fort : deux seeds RNG différentes produisent exactement le même volume vendu (spec M11.2.3.2 §10)", () => {
    const resultA = RetailEngine.computeMonth(STATE, { stockUnits: 50, expectedFootTraffic: 1000 }, { rng: createRng(1) });
    const resultB = RetailEngine.computeMonth(STATE, { stockUnits: 50, expectedFootTraffic: 1000 }, { rng: createRng(999) });
    expect(resultA.unitsSold).toBe(resultB.unitsSold);
    expect(resultA.revenue).toBe(resultB.revenue);
  });

  it("non-double-comptage de la réputation : mêmes demande/capacité, réputation différente -> mêmes ventes exécutées (spec §9)", () => {
    const rng = createRng(1);
    const low = RetailEngine.computeMonth({ ...STATE, reputationScore: 0.1 }, { stockUnits: 50, expectedFootTraffic: 1000 }, { rng });
    const high = RetailEngine.computeMonth({ ...STATE, reputationScore: 0.9 }, { stockUnits: 50, expectedFootTraffic: 1000 }, { rng });
    expect(high.unitsSold).toBe(low.unitsSold);
    expect(high.revenue).toBe(low.revenue);
  });

  it("conversionRate est une métrique purement descriptive : conversionRate === unitsSold / stockUnits", () => {
    const rng = createRng(2);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 50, expectedFootTraffic: 1000 }, { rng });
    expect(result.unitsSold).toBe(50);
    expect(result.conversionRate).toBeCloseTo(result.unitsSold / 50, 10);
  });

  it("conversionRate vaut 0 quand stockUnits est nul (division évitée, jamais NaN)", () => {
    const rng = createRng(2);
    const result = RetailEngine.computeMonth(STATE, { stockUnits: 0, expectedFootTraffic: 100 }, { rng });
    expect(result.conversionRate).toBe(0);
  });

  it("rejette un stock ou un trafic négatif", () => {
    const rng = createRng(1);
    expect(() =>
      RetailEngine.computeMonth(STATE, { stockUnits: -1, expectedFootTraffic: 10 }, { rng }),
    ).toThrow(RangeError);
    expect(() =>
      RetailEngine.computeMonth(STATE, { stockUnits: 10, expectedFootTraffic: -1 }, { rng }),
    ).toThrow(RangeError);
  });
});
