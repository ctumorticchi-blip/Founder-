import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { ServiceEngine, type ServiceEngineState } from "../../../src/engine/economic-models/service.js";

const STATE: ServiceEngineState = {
  hourlyRate: 40,
  costPerLaborHour: 10,
  reputationScore: 0.5,
};

describe("ServiceEngine", () => {
  it("expose la famille 'service'", () => {
    expect(ServiceEngine.family).toBe("service");
  });

  it("ne vend jamais plus d'heures que min(targetHours, capacityHours)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 50; i++) {
      const result = ServiceEngine.computeMonth(
        STATE,
        { capacityHours: 100, targetHours: 150 },
        { rng },
      );
      expect(result.hoursSold).toBeLessThanOrEqual(100);
    }
  });

  it("revenue et variableCosts sont cohérents avec hoursSold", () => {
    const rng = createRng(2);
    const result = ServiceEngine.computeMonth(
      STATE,
      { capacityHours: 100, targetHours: 100 },
      { rng },
    );
    expect(result.revenue).toBeCloseTo(result.hoursSold * STATE.hourlyRate);
    expect(result.variableCosts).toBeCloseTo(result.hoursSold * STATE.costPerLaborHour);
  });

  it("est déterministe pour un même RNG dérivé de la même seed", () => {
    const resultA = ServiceEngine.computeMonth(
      STATE,
      { capacityHours: 120, targetHours: 100 },
      { rng: createRng(42) },
    );
    const resultB = ServiceEngine.computeMonth(
      STATE,
      { capacityHours: 120, targetHours: 100 },
      { rng: createRng(42) },
    );
    expect(resultA).toEqual(resultB);
  });

  it("une meilleure réputation augmente statistiquement le taux de remplissage", () => {
    const lowRepRng = createRng(7);
    const highRepRng = createRng(7);
    let lowTotal = 0;
    let highTotal = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      lowTotal += ServiceEngine.computeMonth(
        { ...STATE, reputationScore: 0.1 },
        { capacityHours: 100, targetHours: 100 },
        { rng: lowRepRng },
      ).utilizationRate;
      highTotal += ServiceEngine.computeMonth(
        { ...STATE, reputationScore: 0.9 },
        { capacityHours: 100, targetHours: 100 },
        { rng: highRepRng },
      ).utilizationRate;
    }
    expect(highTotal / trials).toBeGreaterThan(lowTotal / trials);
  });

  it("utilizationRate reste toujours dans [0, 1]", () => {
    const rng = createRng(99);
    for (let i = 0; i < 200; i++) {
      const result = ServiceEngine.computeMonth(
        STATE,
        { capacityHours: 100, targetHours: 100 },
        { rng },
      );
      expect(result.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(result.utilizationRate).toBeLessThanOrEqual(1);
    }
  });

  it("rejette une capacité ou une cible négative", () => {
    const rng = createRng(1);
    expect(() =>
      ServiceEngine.computeMonth(STATE, { capacityHours: -1, targetHours: 10 }, { rng }),
    ).toThrow(RangeError);
    expect(() =>
      ServiceEngine.computeMonth(STATE, { capacityHours: 10, targetHours: -1 }, { rng }),
    ).toThrow(RangeError);
  });

  it("plusieurs mois simulés produisent un P&L plausible via computeMonthlyFinancials", async () => {
    const { computeMonthlyFinancials } = await import("../../../src/engine/business/accounting.js");
    const rng = createRng(5);
    let cash = 0;
    for (let month = 0; month < 6; month++) {
      const contribution = ServiceEngine.computeMonth(
        STATE,
        { capacityHours: 140, targetHours: 130 },
        { rng: rng.fork(`month-${month}`) },
      );
      const statement = computeMonthlyFinancials({
        revenue: contribution.revenue,
        variableCosts: contribution.variableCosts,
        payroll: 2_000,
        marketing: 200,
        rent: 500,
        admin: 100,
        depreciation: 0,
        interest: 0,
        taxRate: 0.25,
        capex: 0,
        workingCapitalChange: 0,
      });
      cash += statement.cashFlow;
      expect(statement.grossMargin).toBeGreaterThanOrEqual(0);
    }
    expect(Number.isFinite(cash)).toBe(true);
  });
});
