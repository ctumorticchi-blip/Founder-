import { describe, expect, it } from "vitest";
import { computeSatisfaction } from "../../../src/engine/customer/satisfaction.js";

describe("computeSatisfaction (spec M11.2.3 §5)", () => {
  it("expérience == attentes -> score neutre, niveau mitigé", () => {
    const result = computeSatisfaction(60, 60, 1, 0);
    expect(result.score).toBeCloseTo(50, 5);
    expect(result.level).toBe("mixed");
  });

  it("expérience très supérieure aux attentes -> score haut, niveau très positif, qualité supérieure aux attentes", () => {
    const result = computeSatisfaction(50, 90, 1, 0);
    expect(result.score).toBeGreaterThan(80);
    expect(result.level).toBe("very-positive");
    expect(result.diagnosis.qualityAboveExpectations).toBe(true);
  });

  it("expérience très inférieure aux attentes -> score bas, niveau très négatif, expérience sous la promesse", () => {
    const result = computeSatisfaction(90, 50, 1, 0);
    expect(result.score).toBeLessThan(20);
    expect(result.level).toBe("very-negative");
    expect(result.diagnosis.experienceBelowPromise).toBe(true);
  });

  it("un prix avantageux (priceRatio <= 1) avec un bon score déclenche 'bon rapport qualité/prix'", () => {
    const result = computeSatisfaction(50, 80, 0.8, 0);
    expect(result.diagnosis.greatValueForMoney).toBe(true);
  });

  it("un prix élevé (priceRatio > 1) ne déclenche jamais 'bon rapport qualité/prix', même à bon score", () => {
    const result = computeSatisfaction(50, 80, 1.5, 0);
    expect(result.diagnosis.greatValueForMoney).toBe(false);
  });

  it("des attentes élevées déclenchent le diagnostic, indépendamment du score obtenu", () => {
    const highExpectationsGoodOutcome = computeSatisfaction(80, 90, 1, 0);
    const highExpectationsBadOutcome = computeSatisfaction(80, 40, 1, 0);
    expect(highExpectationsGoodOutcome.diagnosis.highExpectations).toBe(true);
    expect(highExpectationsBadOutcome.diagnosis.highExpectations).toBe(true);
  });

  it("une pénalité opérationnelle élevée déclenche 'opérations sous tension'", () => {
    const strained = computeSatisfaction(60, 50, 1, 30);
    const relaxed = computeSatisfaction(60, 50, 1, 0);
    expect(strained.diagnosis.operationsUnderStrain).toBe(true);
    expect(relaxed.diagnosis.operationsUnderStrain).toBe(false);
  });

  it("deux segments avec des attentes différentes pour la même expérience délivrée ont des résultats différents (I5)", () => {
    const demanding = computeSatisfaction(85, 70, 1, 0); // segment exigeant, même expérience
    const relaxed = computeSatisfaction(40, 70, 1, 0); // segment peu exigeant, même expérience
    expect(demanding.score).not.toBe(relaxed.score);
    expect(demanding.level).not.toBe(relaxed.level);
  });

  it("le score reste toujours borné [0,100]", () => {
    expect(computeSatisfaction(0, 100, 1, 0).score).toBeLessThanOrEqual(100);
    expect(computeSatisfaction(100, 0, 1, 0).score).toBeGreaterThanOrEqual(0);
  });

  it("est déterministe", () => {
    const a = computeSatisfaction(60, 70, 1.1, 5);
    const b = computeSatisfaction(60, 70, 1.1, 5);
    expect(a).toEqual(b);
  });
});
