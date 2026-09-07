import { describe, expect, it } from "vitest";
import { computeValuation } from "../../../src/engine/business/valuation.js";
import { createBusiness } from "../../../src/engine/business/treasury.js";
import type { MonthlyFinancialStatement } from "../../../src/types/business.js";
import type { WorkforceState } from "../../../src/types/employees.js";

const WORKFORCE: WorkforceState = { headcount: 2, averageMonthlySalary: 2_000 };

function statement(overrides: Partial<MonthlyFinancialStatement> = {}): MonthlyFinancialStatement {
  return {
    revenue: 10_000,
    variableCosts: 3_000,
    grossMargin: 7_000,
    payroll: 4_000,
    marketing: 300,
    rent: 400,
    admin: 200,
    ebitda: 2_100,
    depreciation: 0,
    interest: 0,
    ebt: 2_100,
    taxes: 525,
    netIncome: 1_575,
    capex: 0,
    workingCapitalChange: 0,
    cashFlow: 1_575,
    ...overrides,
  };
}

describe("computeValuation", () => {
  it("est déterministe : mêmes entrées -> même sortie", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0.08 });
    const a = computeValuation(business, statement(), WORKFORCE);
    const b = computeValuation(business, statement(), WORKFORCE);
    expect(a).toEqual(b);
  });

  it("low <= mid <= high, y compris en cas d'EBITDA négatif", () => {
    const business = createBusiness("Test", ["retail"], { creditLineLimit: 0, creditLineInterestRateAnnual: 0 });
    const result = computeValuation(business, statement({ ebitda: -500, netIncome: -600 }), WORKFORCE);
    expect(result.low).toBeLessThanOrEqual(result.mid);
    expect(result.mid).toBeLessThanOrEqual(result.high);
    expect(result.low).toBeGreaterThanOrEqual(0);
  });

  it("un multiple de revenu récurrent (subscription) vaut plus qu'un multiple d'actifs physiques (retail) à EBITDA égal", () => {
    const subscriptionBusiness = createBusiness("Sub", ["subscription"], { creditLineLimit: 0, creditLineInterestRateAnnual: 0 });
    const retailBusiness = createBusiness("Retail", ["retail"], { creditLineLimit: 0, creditLineInterestRateAnnual: 0 });
    const subValuation = computeValuation(subscriptionBusiness, statement(), WORKFORCE);
    const retailValuation = computeValuation(retailBusiness, statement(), WORKFORCE);
    expect(subValuation.mid).toBeGreaterThan(retailValuation.mid);
  });

  it("une entreprise avec des obligations impayées vaut moins qu'une entreprise saine sinon identique", () => {
    const healthy = createBusiness("Healthy", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0.08 });
    const distressedBase = createBusiness("Distressed", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0.08 });
    const distressed = { ...distressedBase, treasury: { ...distressedBase.treasury, unpaidObligations: 5_000, consecutiveUnpaidMonths: 3 } };

    const healthyValuation = computeValuation(healthy, statement(), WORKFORCE);
    const distressedValuation = computeValuation(distressed, statement(), WORKFORCE);
    expect(distressedValuation.mid).toBeLessThan(healthyValuation.mid);
  });

  it("une entreprise insolvable a une valorisation très fortement décotée (proche de 0)", () => {
    const base = createBusiness("Insolvent", ["hospitality"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0.08 });
    const insolvent = { ...base, treasury: { ...base.treasury, unpaidObligations: 50_000, consecutiveUnpaidMonths: 6, isInsolvent: true } };
    const result = computeValuation(insolvent, statement({ ebitda: -2_000, netIncome: -2_200 }), WORKFORCE);
    expect(result.mid).toBeLessThan(5_000);
  });

  it("les facteurs somment vers mid (traçabilité)", () => {
    const business = createBusiness("Test", ["agency"], { creditLineLimit: 5_000, creditLineInterestRateAnnual: 0.05 });
    const result = computeValuation(business, statement(), WORKFORCE);
    const factorsSum = result.factors.reduce((sum, factor) => sum + factor.amount, 0);
    expect(factorsSum).toBeCloseTo(result.mid, 6);
  });

  it("sans historique financier (aucun mois résolu), la valorisation est nulle et explicable", () => {
    const business = createBusiness("Brand new", ["service"], { creditLineLimit: 0, creditLineInterestRateAnnual: 0 });
    const result = computeValuation(business, null, { headcount: 0, averageMonthlySalary: 0 });
    expect(result.low).toBe(0);
    expect(result.mid).toBe(0);
    expect(result.high).toBe(0);
    expect(result.factors.length).toBeGreaterThan(0);
  });
});
