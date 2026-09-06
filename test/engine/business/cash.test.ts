import { describe, expect, it } from "vitest";
import { applyCashFlow, createBusiness } from "../../../src/engine/business/cash.js";
import { computeMonthlyFinancials } from "../../../src/engine/business/accounting.js";
import type { MonthlyFinancialStatementInputs } from "../../../src/types/business.js";

const POSITIVE_INPUTS: MonthlyFinancialStatementInputs = {
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

const NEGATIVE_INPUTS: MonthlyFinancialStatementInputs = {
  ...POSITIVE_INPUTS,
  revenue: 100,
};

describe("createBusiness", () => {
  it("démarre avec zéro cash et zéro mois négatif", () => {
    const business = createBusiness("Nettoyage Express", ["service"]);
    expect(business.cash).toBe(0);
    expect(business.consecutiveNegativeCashMonths).toBe(0);
  });

  it("rejette une entreprise sans famille économique", () => {
    expect(() => createBusiness("Vide", [])).toThrow(RangeError);
  });

  it("accepte plusieurs familles (composabilité, spec §3.8)", () => {
    const business = createBusiness("Boutique + abonnement", ["retail", "subscription"]);
    expect(business.families).toEqual(["retail", "subscription"]);
  });
});

describe("applyCashFlow", () => {
  it("ajoute le cash-flow du mois à la trésorerie", () => {
    const business = createBusiness("Test", ["service"]);
    const statement = computeMonthlyFinancials(POSITIVE_INPUTS);
    const updated = applyCashFlow(business, statement);
    expect(updated.cash).toBeCloseTo(statement.cashFlow);
  });

  it("incrémente le compteur de mois négatifs consécutifs", () => {
    let business = createBusiness("Test", ["service"]);
    const badStatement = computeMonthlyFinancials(NEGATIVE_INPUTS);
    expect(badStatement.cashFlow).toBeLessThan(0);

    business = applyCashFlow(business, badStatement);
    expect(business.consecutiveNegativeCashMonths).toBe(1);
    business = applyCashFlow(business, badStatement);
    expect(business.consecutiveNegativeCashMonths).toBe(2);
  });

  it("réinitialise le compteur dès que la trésorerie redevient positive", () => {
    let business = createBusiness("Test", ["service"]);
    const badStatement = computeMonthlyFinancials(NEGATIVE_INPUTS);
    business = applyCashFlow(business, badStatement);
    business = applyCashFlow(business, badStatement);
    expect(business.consecutiveNegativeCashMonths).toBe(2);

    const goodStatement = computeMonthlyFinancials({ ...POSITIVE_INPUTS, revenue: 100_000 });
    business = applyCashFlow(business, goodStatement);
    expect(business.cash).toBeGreaterThan(0);
    expect(business.consecutiveNegativeCashMonths).toBe(0);
  });

  it("ne mute pas l'entreprise d'origine", () => {
    const business = createBusiness("Test", ["service"]);
    const statement = computeMonthlyFinancials(POSITIVE_INPUTS);
    applyCashFlow(business, statement);
    expect(business.cash).toBe(0);
  });
});
