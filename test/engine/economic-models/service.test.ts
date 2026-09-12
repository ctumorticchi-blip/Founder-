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

  it("ANTI-RÉGRESSION M11.2.3.2 : demande == capacité -> ventes == demande exactement (aucune seconde loterie commerciale)", () => {
    const rng = createRng(123);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 100, targetHours: 100 }, { rng });
    expect(result.hoursSold).toBe(100);
  });

  it("demande < capacité -> hoursSold == demande (aucune perte)", () => {
    const rng = createRng(1);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 100, targetHours: 60 }, { rng });
    expect(result.hoursSold).toBe(60);
  });

  it("demande > capacité -> hoursSold == capacité", () => {
    const rng = createRng(1);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 100, targetHours: 150 }, { rng });
    expect(result.hoursSold).toBe(100);
  });

  it("demande nulle -> aucune vente", () => {
    const rng = createRng(1);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 100, targetHours: 0 }, { rng });
    expect(result.hoursSold).toBe(0);
  });

  it("capacité nulle -> aucune vente même si la demande est positive", () => {
    const rng = createRng(1);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 0, targetHours: 100 }, { rng });
    expect(result.hoursSold).toBe(0);
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

  it("déterminisme fort : deux seeds RNG différentes produisent exactement le même volume vendu (spec M11.2.3.2 §10)", () => {
    const resultA = ServiceEngine.computeMonth(STATE, { capacityHours: 120, targetHours: 150 }, { rng: createRng(1) });
    const resultB = ServiceEngine.computeMonth(STATE, { capacityHours: 120, targetHours: 150 }, { rng: createRng(999) });
    expect(resultA.hoursSold).toBe(resultB.hoursSold);
    expect(resultA.revenue).toBe(resultB.revenue);
  });

  it("non-double-comptage de la réputation : mêmes demande/capacité, réputation différente -> mêmes ventes exécutées (spec §9)", () => {
    const rng = createRng(7);
    const low = ServiceEngine.computeMonth({ ...STATE, reputationScore: 0.1 }, { capacityHours: 100, targetHours: 150 }, { rng });
    const high = ServiceEngine.computeMonth({ ...STATE, reputationScore: 0.9 }, { capacityHours: 100, targetHours: 150 }, { rng });
    expect(high.hoursSold).toBe(low.hoursSold);
    expect(high.revenue).toBe(low.revenue);
  });

  it("utilizationRate est une métrique purement descriptive : utilizationRate === hoursSold / capacityHours", () => {
    const rng = createRng(99);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 80, targetHours: 150 }, { rng });
    expect(result.hoursSold).toBe(80);
    expect(result.utilizationRate).toBeCloseTo(result.hoursSold / 80, 10);
  });

  it("utilizationRate vaut 0 quand capacityHours est nul (division évitée, jamais NaN)", () => {
    const rng = createRng(99);
    const result = ServiceEngine.computeMonth(STATE, { capacityHours: 0, targetHours: 50 }, { rng });
    expect(result.utilizationRate).toBe(0);
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
