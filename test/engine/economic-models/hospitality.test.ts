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

  it("ANTI-RÉGRESSION M11.2.3.2 : demande == capacité -> ventes == demande exactement (aucune seconde loterie commerciale)", () => {
    const rng = createRng(123);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 100, expectedDemandCovers: 100 }, { rng });
    expect(result.coversServed).toBe(100);
  });

  it("demande < capacité -> coversServed == demande (aucune perte)", () => {
    const rng = createRng(1);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 600, expectedDemandCovers: 400 }, { rng });
    expect(result.coversServed).toBe(400);
  });

  it("demande > capacité -> coversServed == capacité", () => {
    const rng = createRng(1);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 600, expectedDemandCovers: 2000 }, { rng });
    expect(result.coversServed).toBe(600);
  });

  it("demande nulle -> aucune vente", () => {
    const rng = createRng(1);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 600, expectedDemandCovers: 0 }, { rng });
    expect(result.coversServed).toBe(0);
  });

  it("capacité nulle -> aucune vente même si la demande est positive", () => {
    const rng = createRng(1);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 0, expectedDemandCovers: 500 }, { rng });
    expect(result.coversServed).toBe(0);
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

  it("déterminisme fort : deux seeds RNG différentes produisent exactement le même volume vendu (spec M11.2.3.2 §10)", () => {
    const resultA = HospitalityEngine.computeMonth(STATE, { coversCapacity: 600, expectedDemandCovers: 2000 }, { rng: createRng(1) });
    const resultB = HospitalityEngine.computeMonth(STATE, { coversCapacity: 600, expectedDemandCovers: 2000 }, { rng: createRng(999) });
    expect(resultA.coversServed).toBe(resultB.coversServed);
    expect(resultA.revenue).toBe(resultB.revenue);
  });

  it("non-double-comptage de la réputation : mêmes demande/capacité, réputation différente -> mêmes ventes exécutées (spec §9)", () => {
    const rng = createRng(7);
    const low = HospitalityEngine.computeMonth({ ...STATE, reputationScore: 0.1 }, { coversCapacity: 600, expectedDemandCovers: 2000 }, { rng });
    const high = HospitalityEngine.computeMonth({ ...STATE, reputationScore: 0.9 }, { coversCapacity: 600, expectedDemandCovers: 2000 }, { rng });
    expect(high.coversServed).toBe(low.coversServed);
    expect(high.revenue).toBe(low.revenue);
  });

  it("fillRate est une métrique purement descriptive : fillRate === coversServed / coversCapacity", () => {
    const rng = createRng(99);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 600, expectedDemandCovers: 2000 }, { rng });
    expect(result.coversServed).toBe(600);
    expect(result.fillRate).toBeCloseTo(result.coversServed / 600, 10);
  });

  it("fillRate vaut 0 quand coversCapacity est nul (division évitée, jamais NaN)", () => {
    const rng = createRng(99);
    const result = HospitalityEngine.computeMonth(STATE, { coversCapacity: 0, expectedDemandCovers: 50 }, { rng });
    expect(result.fillRate).toBe(0);
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
