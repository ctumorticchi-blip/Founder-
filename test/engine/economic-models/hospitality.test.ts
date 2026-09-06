import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  HospitalityEngine,
  type HospitalityEngineState,
} from "../../../src/engine/economic-models/hospitality.js";

const STATE: HospitalityEngineState = {
  averageTicketPrice: 22,
  foodCostPerCover: 7,
  reputationScore: 0.6,
};

describe("HospitalityEngine", () => {
  it("expose la famille 'hospitality'", () => {
    expect(HospitalityEngine.family).toBe("hospitality");
  });

  it("ne sert jamais plus de couverts que la capacité (places * rotations * jours)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const result = HospitalityEngine.computeMonth(
        STATE,
        { coversCapacity: 600, expectedDemandCovers: 2000 },
        { rng },
      );
      expect(result.coversServed).toBeLessThanOrEqual(600);
    }
  });

  it("revenue et variableCosts sont cohérents avec coversServed", () => {
    const rng = createRng(2);
    const result = HospitalityEngine.computeMonth(
      STATE,
      { coversCapacity: 600, expectedDemandCovers: 500 },
      { rng },
    );
    expect(result.revenue).toBeCloseTo(result.coversServed * STATE.averageTicketPrice);
    expect(result.variableCosts).toBeCloseTo(result.coversServed * STATE.foodCostPerCover);
  });

  it("rejette une capacité ou une demande négative", () => {
    const rng = createRng(1);
    expect(() =>
      HospitalityEngine.computeMonth(STATE, { coversCapacity: -1, expectedDemandCovers: 10 }, { rng }),
    ).toThrow(RangeError);
    expect(() =>
      HospitalityEngine.computeMonth(STATE, { coversCapacity: 10, expectedDemandCovers: -1 }, { rng }),
    ).toThrow(RangeError);
  });
});
