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
