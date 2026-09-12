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

  it("ANTI-RÉGRESSION M11.2.3.2 : demande == capacité -> ventes == demande exactement (aucune seconde loterie commerciale)", () => {
    const rng = createRng(123);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 10, targetMandates: 10 }, { rng });
    expect(result.wonMandates).toBe(10);
  });

  it("demande < capacité -> wonMandates == demande (aucune perte)", () => {
    const rng = createRng(1);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 10, targetMandates: 4 }, { rng });
    expect(result.wonMandates).toBe(4);
  });

  it("demande > capacité -> wonMandates == capacité", () => {
    const rng = createRng(1);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 5, targetMandates: 20 }, { rng });
    expect(result.wonMandates).toBe(5);
  });

  it("demande nulle -> aucun mandat gagné", () => {
    const rng = createRng(1);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 10, targetMandates: 0 }, { rng });
    expect(result.wonMandates).toBe(0);
  });

  it("capacité nulle -> aucun mandat gagné même si la demande est positive", () => {
    const rng = createRng(1);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 0, targetMandates: 10 }, { rng });
    expect(result.wonMandates).toBe(0);
  });

  it("déterminisme fort : deux seeds RNG différentes produisent exactement le même volume vendu (spec M11.2.3.2 §10)", () => {
    const resultA = AgencyEngine.computeMonth(STATE, { capacityMandates: 5, targetMandates: 20 }, { rng: createRng(1) });
    const resultB = AgencyEngine.computeMonth(STATE, { capacityMandates: 5, targetMandates: 20 }, { rng: createRng(999) });
    expect(resultA.wonMandates).toBe(resultB.wonMandates);
    expect(resultA.revenue).toBe(resultB.revenue);
  });

  it("non-double-comptage de la réputation ET du skillFactor : mêmes demande/capacité, réputation/compétence différentes -> mêmes ventes exécutées (spec §7, §9)", () => {
    const rng = createRng(11);
    const low = AgencyEngine.computeMonth({ ...STATE, reputationScore: 0.1, skillFactor: 0.1 }, { capacityMandates: 10, targetMandates: 10 }, { rng });
    const high = AgencyEngine.computeMonth({ ...STATE, reputationScore: 0.9, skillFactor: 0.9 }, { capacityMandates: 10, targetMandates: 10 }, { rng });
    expect(high.wonMandates).toBe(low.wonMandates);
    expect(high.revenue).toBe(low.revenue);
  });

  it("winRate est une métrique purement descriptive : winRate === wonMandates / capacityMandates", () => {
    const rng = createRng(3);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 5, targetMandates: 20 }, { rng });
    expect(result.wonMandates).toBe(5);
    expect(result.winRate).toBeCloseTo(result.wonMandates / 5, 10);
  });

  it("winRate vaut 0 quand capacityMandates est nul (division évitée, jamais NaN)", () => {
    const rng = createRng(3);
    const result = AgencyEngine.computeMonth(STATE, { capacityMandates: 0, targetMandates: 5 }, { rng });
    expect(result.winRate).toBe(0);
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
