import { describe, expect, it } from "vitest";
import { computeMonthlyFinancials } from "../../../src/engine/business/accounting.js";
import {
  INSOLVENCY_THRESHOLD_MONTHS,
  applyMonthlyCashFlow,
  computeMonthlyInterest,
  createBusiness,
  injectCapital,
} from "../../../src/engine/business/treasury.js";
import type { MonthlyFinancialStatementInputs } from "../../../src/types/business.js";

const NO_FINANCING = { creditLineLimit: 0, creditLineInterestRateAnnual: 0 };

const BASE_INPUTS: MonthlyFinancialStatementInputs = {
  revenue: 10_000,
  variableCosts: 3_000,
  payroll: 4_000,
  marketing: 500,
  rent: 800,
  admin: 300,
  depreciation: 200,
  interest: 0,
  taxRate: 0.25,
  capex: 0,
  workingCapitalChange: 0,
};

describe("createBusiness", () => {
  it("démarre à cash 0, aucun encours de crédit, solvable", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0.1 });
    expect(business.treasury.cash).toBe(0);
    expect(business.treasury.creditLine.drawn).toBe(0);
    expect(business.treasury.isInsolvent).toBe(false);
  });

  it("rejette une ligne de crédit ou un taux négatif", () => {
    expect(() => createBusiness("Test", ["service"], { creditLineLimit: -1, creditLineInterestRateAnnual: 0 })).toThrow(RangeError);
    expect(() => createBusiness("Test", ["service"], { creditLineLimit: 0, creditLineInterestRateAnnual: -0.1 })).toThrow(RangeError);
  });
});

describe("computeMonthlyInterest", () => {
  it("est proportionnel à l'encours tiré et au taux annuel/12", () => {
    expect(computeMonthlyInterest({ limit: 10_000, drawn: 6_000, interestRateAnnual: 0.12 })).toBeCloseTo(60);
  });

  it("est nul sans encours tiré", () => {
    expect(computeMonthlyInterest({ limit: 10_000, drawn: 0, interestRateAnnual: 0.12 })).toBe(0);
  });
});

describe("applyMonthlyCashFlow — cash disponible jamais négatif", () => {
  it("un cash-flow positif augmente simplement le cash", () => {
    const business = createBusiness("Test", ["service"], NO_FINANCING);
    const statement = computeMonthlyFinancials(BASE_INPUTS);
    const result = applyMonthlyCashFlow(business, statement);
    expect(result.business.treasury.cash).toBeCloseTo(statement.cashFlow);
    expect(result.outcome.kind).toBe("covered-by-cash");
  });

  it("scénario : entreprise rentable mais en crise de liquidité (CAPEX ponctuel financé par la ligne de crédit)", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 20_000, creditLineInterestRateAnnual: 0.1 });
    const statement = computeMonthlyFinancials({ ...BASE_INPUTS, capex: 15_000 });
    expect(statement.netIncome).toBeGreaterThan(0);
    expect(statement.cashFlow).toBeLessThan(0);

    const result = applyMonthlyCashFlow(business, statement);
    expect(result.outcome.kind).toBe("covered-by-credit-draw");
    expect(result.business.treasury.cash).toBe(0);
    expect(result.business.treasury.creditLine.drawn).toBeCloseTo(-statement.cashFlow);
    expect(result.business.treasury.isInsolvent).toBe(false);
  });

  it("scénario : entreprise déficitaire mais solvable grâce à ses réserves", () => {
    let business = createBusiness("Test", ["service"], NO_FINANCING);
    business = { ...business, treasury: { ...business.treasury, cash: 50_000 } };
    const lossStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 1_000 });
    expect(lossStatement.netIncome).toBeLessThan(0);

    const result = applyMonthlyCashFlow(business, lossStatement);
    expect(result.business.treasury.cash).toBeGreaterThan(0);
    expect(result.business.treasury.consecutiveUnmetShortfallMonths).toBe(0);
    expect(result.business.treasury.isInsolvent).toBe(false);
  });

  it("un excédent de cash rembourse en priorité la ligne de crédit tirée (remboursement partiel si le cash-flow ne couvre pas tout)", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0 });
    business = { ...business, treasury: { ...business.treasury, creditLine: { ...business.treasury.creditLine, drawn: 4_000 } } };
    const statement = computeMonthlyFinancials(BASE_INPUTS); // cashFlow positif (1100) mais < 4000 d'encours
    expect(statement.cashFlow).toBeGreaterThan(0);
    expect(statement.cashFlow).toBeLessThan(4_000);

    const result = applyMonthlyCashFlow(business, statement);
    expect(result.outcome.kind).toBe("credit-repaid");
    expect(result.business.treasury.cash).toBe(0);
    expect(result.business.treasury.creditLine.drawn).toBeCloseTo(4_000 - statement.cashFlow);
  });

  it("un excédent de cash rembourse intégralement l'encours quand le cash-flow le couvre largement", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0 });
    business = { ...business, treasury: { ...business.treasury, creditLine: { ...business.treasury.creditLine, drawn: 800 } } };
    const statement = computeMonthlyFinancials(BASE_INPUTS); // cashFlow (1100) > 800 d'encours
    const result = applyMonthlyCashFlow(business, statement);
    expect(result.outcome.kind).toBe("credit-repaid");
    expect(result.business.treasury.creditLine.drawn).toBe(0);
    expect(result.business.treasury.cash).toBeCloseTo(statement.cashFlow - 800);
  });

  it("scénario : besoin de financement partiellement couvert par une ligne de crédit insuffisante", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 2_000, creditLineInterestRateAnnual: 0 });
    const statement = computeMonthlyFinancials({ ...BASE_INPUTS, capex: 15_000 });
    const result = applyMonthlyCashFlow(business, statement);
    expect(result.outcome.kind).toBe("shortfall-unmet");
    expect(result.business.treasury.creditLine.drawn).toBe(2_000);
    expect(result.business.treasury.consecutiveUnmetShortfallMonths).toBe(1);
    expect(result.business.treasury.isInsolvent).toBe(false);
  });

  it("scénario : faillite réelle — découvert non couvert pendant plusieurs mois consécutifs", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 1_000, creditLineInterestRateAnnual: 0 });
    const ruinousStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 0, capex: 5_000 });

    let sawInsolvency = false;
    for (let month = 0; month < INSOLVENCY_THRESHOLD_MONTHS; month++) {
      const result = applyMonthlyCashFlow(business, ruinousStatement);
      business = result.business;
      expect(business.treasury.cash).toBe(0); // jamais négatif
      if (result.outcome.kind === "insolvent") {
        sawInsolvency = true;
      }
      if (month < INSOLVENCY_THRESHOLD_MONTHS - 1) {
        expect(business.treasury.isInsolvent).toBe(false);
      }
    }
    expect(sawInsolvency).toBe(true);
    expect(business.treasury.isInsolvent).toBe(true);
    expect(business.treasury.consecutiveUnmetShortfallMonths).toBe(INSOLVENCY_THRESHOLD_MONTHS);
  });

  it("un mois couvert intégralement réinitialise le compteur de découvert (pas de catastrophe rétroactive)", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 1_000, creditLineInterestRateAnnual: 0 });
    const ruinousStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 0, capex: 5_000 });
    business = applyMonthlyCashFlow(business, ruinousStatement).business;
    business = applyMonthlyCashFlow(business, ruinousStatement).business;
    expect(business.treasury.consecutiveUnmetShortfallMonths).toBe(2);

    const goodStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 100_000 });
    business = applyMonthlyCashFlow(business, goodStatement).business;
    expect(business.treasury.consecutiveUnmetShortfallMonths).toBe(0);
    expect(business.treasury.isInsolvent).toBe(false);
  });

  it("ne mute pas l'entreprise d'origine", () => {
    const business = createBusiness("Test", ["service"], NO_FINANCING);
    const statement = computeMonthlyFinancials(BASE_INPUTS);
    applyMonthlyCashFlow(business, statement);
    expect(business.treasury.cash).toBe(0);
  });
});

describe("injectCapital — scénario : entreprise sauvée par apport", () => {
  it("augmente directement le cash sans toucher à la ligne de crédit", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 5_000, creditLineInterestRateAnnual: 0 });
    const funded = injectCapital(business, 20_000);
    expect(funded.treasury.cash).toBe(20_000);
    expect(funded.treasury.creditLine.drawn).toBe(0);
  });

  it("un apport préventif peut éviter la liquidation d'une entreprise en difficulté", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 1_000, creditLineInterestRateAnnual: 0 });
    const ruinousStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 0, capex: 5_000 });

    for (let month = 0; month < INSOLVENCY_THRESHOLD_MONTHS - 1; month++) {
      business = applyMonthlyCashFlow(business, ruinousStatement).business;
    }
    expect(business.treasury.isInsolvent).toBe(false);
    expect(business.treasury.consecutiveUnmetShortfallMonths).toBe(INSOLVENCY_THRESHOLD_MONTHS - 1);

    business = injectCapital(business, 100_000);
    const goodStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 100_000 });
    business = applyMonthlyCashFlow(business, goodStatement).business;

    expect(business.treasury.isInsolvent).toBe(false);
    expect(business.treasury.consecutiveUnmetShortfallMonths).toBe(0);
  });

  it("rejette un montant négatif", () => {
    const business = createBusiness("Test", ["service"], NO_FINANCING);
    expect(() => injectCapital(business, -1)).toThrow(RangeError);
  });
});
