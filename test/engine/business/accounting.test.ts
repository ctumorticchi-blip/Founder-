import { describe, expect, it } from "vitest";
import {
  computeMonthlyFinancials,
  consolidateContributions,
} from "../../../src/engine/business/accounting.js";
import type { MonthlyFinancialStatementInputs } from "../../../src/types/business.js";

const BASE_INPUTS: MonthlyFinancialStatementInputs = {
  revenue: 10_000,
  variableCosts: 3_000,
  payroll: 4_000,
  marketing: 500,
  rent: 800,
  admin: 300,
  depreciation: 200,
  interest: 100,
  taxRate: 0.25,
  capex: 0,
  workingCapitalChange: 0,
};

describe("computeMonthlyFinancials", () => {
  it("calcule la chaîne comptable complète (spec §6)", () => {
    const statement = computeMonthlyFinancials(BASE_INPUTS);
    expect(statement.grossMargin).toBe(7_000); // 10000 - 3000
    expect(statement.ebitda).toBe(1_400); // 7000 - 4000 - 500 - 800 - 300
    expect(statement.ebt).toBe(1_100); // 1400 - 200 - 100
    expect(statement.taxes).toBeCloseTo(275); // 1100 * 0.25
    expect(statement.netIncome).toBeCloseTo(825); // 1100 - 275
    expect(statement.cashFlow).toBeCloseTo(1_025); // 825 + 200 - 0 - 0
  });

  it("ne prélève aucun impôt sur un résultat avant impôt négatif", () => {
    const statement = computeMonthlyFinancials({
      ...BASE_INPUTS,
      revenue: 1_000,
    });
    expect(statement.ebt).toBeLessThan(0);
    expect(statement.taxes).toBe(0);
    expect(statement.netIncome).toBe(statement.ebt);
  });

  it("invariant clé : résultat net positif mais cash-flow négatif (CAPEX/BFR non financés)", () => {
    const statement = computeMonthlyFinancials({
      ...BASE_INPUTS,
      capex: 5_000,
      workingCapitalChange: 2_000,
    });
    expect(statement.netIncome).toBeGreaterThan(0);
    expect(statement.cashFlow).toBeLessThan(0);
  });

  it("une baisse de BFR (workingCapitalChange négatif) génère du cash", () => {
    const withoutChange = computeMonthlyFinancials(BASE_INPUTS);
    const withDecrease = computeMonthlyFinancials({
      ...BASE_INPUTS,
      workingCapitalChange: -1_000,
    });
    expect(withDecrease.cashFlow).toBeCloseTo(withoutChange.cashFlow + 1_000);
  });

  it("rejette une valeur négative sur un champ qui doit être >= 0", () => {
    expect(() => computeMonthlyFinancials({ ...BASE_INPUTS, revenue: -1 })).toThrow(RangeError);
    expect(() => computeMonthlyFinancials({ ...BASE_INPUTS, capex: -1 })).toThrow(RangeError);
  });

  it("rejette un taxRate hors [0, 1]", () => {
    expect(() => computeMonthlyFinancials({ ...BASE_INPUTS, taxRate: 1.5 })).toThrow(RangeError);
    expect(() => computeMonthlyFinancials({ ...BASE_INPUTS, taxRate: -0.1 })).toThrow(RangeError);
  });

  it("est pure : n'affecte pas l'objet inputs fourni", () => {
    const inputs = { ...BASE_INPUTS };
    const frozen = Object.freeze({ ...inputs });
    expect(() => computeMonthlyFinancials(frozen)).not.toThrow();
  });
});

describe("consolidateContributions", () => {
  it("additionne les contributions de plusieurs moteurs économiques", () => {
    const total = consolidateContributions([
      { revenue: 1_000, variableCosts: 300 },
      { revenue: 2_500, variableCosts: 900 },
    ]);
    expect(total).toEqual({ revenue: 3_500, variableCosts: 1_200 });
  });

  it("retourne zéro pour une liste vide", () => {
    expect(consolidateContributions([])).toEqual({ revenue: 0, variableCosts: 0 });
  });
});
