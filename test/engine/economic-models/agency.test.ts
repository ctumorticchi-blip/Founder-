import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { AgencyEngine, type AgencyEngineState } from "../../../src/engine/economic-models/agency.js";

const STATE: AgencyEngineState = {
  averageMonthlyFeePerMandate: 4_000,
  deliveryCostRatio: 0.3,
  reputationScore: 0.4,
  skillFactor: 0.4,
};

describe("AgencyEngine", () => {
  it("expose la famille 'agency'", () => {
    expect(AgencyEngine.family).toBe("agency");
  });

  it("ne gagne jamais plus de mandats que min(targetMandates, capacityMandates)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const result = AgencyEngine.computeMonth(
        STATE,
        { capacityMandates: 5, targetMandates: 20 },
        { rng },
      );
      expect(result.wonMandates).toBeLessThanOrEqual(5);
    }
  });

  it("un skillFactor et une réputation plus élevés augmentent statistiquement le winRate", () => {
    const lowRng = createRng(11);
    const highRng = createRng(11);
    let lowTotal = 0;
    let highTotal = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      lowTotal += AgencyEngine.computeMonth(
        { ...STATE, reputationScore: 0.1, skillFactor: 0.1 },
        { capacityMandates: 10, targetMandates: 10 },
        { rng: lowRng },
      ).winRate;
      highTotal += AgencyEngine.computeMonth(
        { ...STATE, reputationScore: 0.9, skillFactor: 0.9 },
        { capacityMandates: 10, targetMandates: 10 },
        { rng: highRng },
      ).winRate;
    }
    expect(highTotal / trials).toBeGreaterThan(lowTotal / trials);
  });

  it("variableCosts = revenue * deliveryCostRatio", () => {
    const rng = createRng(3);
    const result = AgencyEngine.computeMonth(
      STATE,
      { capacityMandates: 10, targetMandates: 10 },
      { rng },
    );
    expect(result.variableCosts).toBeCloseTo(result.revenue * STATE.deliveryCostRatio);
  });

  it("rejette des paramètres hors bornes", () => {
    const rng = createRng(1);
    expect(() =>
      AgencyEngine.computeMonth(
        { ...STATE, reputationScore: 1.5 },
        { capacityMandates: 1, targetMandates: 1 },
        { rng },
      ),
    ).toThrow(RangeError);
    expect(() =>
      AgencyEngine.computeMonth(STATE, { capacityMandates: -1, targetMandates: 1 }, { rng }),
    ).toThrow(RangeError);
  });
});
