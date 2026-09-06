import { describe, expect, it } from "vitest";
import { computeMonthlyFinancials } from "../../../src/engine/business/accounting.js";
import {
  INSOLVENCY_THRESHOLD_MONTHS,
  UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY,
  applyMonthlyCashFlow,
  computeMonthlyInterest,
  createBusiness,
  injectCapital,
} from "../../../src/engine/business/treasury.js";
import type { BusinessState, MonthlyFinancialStatementInputs } from "../../../src/types/business.js";

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
  it("démarre à cash 0, aucun encours de crédit, aucun impayé, solvable", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 10_000, creditLineInterestRateAnnual: 0.1 });
    expect(business.treasury.cash).toBe(0);
    expect(business.treasury.creditLine.drawn).toBe(0);
    expect(business.treasury.unpaidObligations).toBe(0);
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
    expect(result.business.treasury.unpaidObligations).toBe(0);
    expect(result.business.treasury.isInsolvent).toBe(false);
  });

  it("scénario : entreprise déficitaire mais solvable grâce à ses réserves", () => {
    let business = createBusiness("Test", ["service"], NO_FINANCING);
    business = { ...business, treasury: { ...business.treasury, cash: 50_000 } };
    const lossStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 1_000 });
    expect(lossStatement.netIncome).toBeLessThan(0);

    const result = applyMonthlyCashFlow(business, lossStatement);
    expect(result.business.treasury.cash).toBeGreaterThan(0);
    expect(result.business.treasury.unpaidObligations).toBe(0);
    expect(result.business.treasury.consecutiveUnpaidMonths).toBe(0);
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

  it("scénario : besoin de financement partiellement couvert par une ligne de crédit insuffisante -> impayé réel (pas d'évaporation)", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 2_000, creditLineInterestRateAnnual: 0 });
    const statement = computeMonthlyFinancials({ ...BASE_INPUTS, capex: 15_000 });
    const financingNeed = -statement.cashFlow;
    const result = applyMonthlyCashFlow(business, statement);

    expect(result.outcome.kind).toBe("shortfall-unmet");
    expect(result.business.treasury.creditLine.drawn).toBe(2_000);
    // Le reliquat non couvert par la ligne de crédit devient un impayé réel, pas un montant qui disparaît.
    expect(result.business.treasury.unpaidObligations).toBeCloseTo(financingNeed - 2_000);
    expect(result.business.treasury.consecutiveUnpaidMonths).toBe(1);
    expect(result.business.treasury.isInsolvent).toBe(false);
  });
});

describe("applyMonthlyCashFlow — obligations impayées (spec de clôture M9.5)", () => {
  it("un impayé persiste d'un mois à l'autre et porte une pénalité de retard (conséquence progressive)", () => {
    const business: BusinessState = {
      ...createBusiness("Test", ["service"], NO_FINANCING),
      treasury: {
        ...createBusiness("Test", ["service"], NO_FINANCING).treasury,
        unpaidObligations: 1_000,
        consecutiveUnpaidMonths: 1,
      },
    };
    // Cash-flow nul ce mois-ci : ni remboursement, ni nouveau déficit.
    const neutralStatement = computeMonthlyFinancials({
      ...BASE_INPUTS,
      revenue: BASE_INPUTS.payroll + BASE_INPUTS.marketing + BASE_INPUTS.rent + BASE_INPUTS.admin + BASE_INPUTS.variableCosts,
      depreciation: 0,
    });
    expect(neutralStatement.cashFlow).toBeCloseTo(0, 1);

    const result = applyMonthlyCashFlow(business, neutralStatement);
    expect(result.business.treasury.unpaidObligations).toBeCloseTo(1_000 * (1 + UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY));
    expect(result.business.treasury.consecutiveUnpaidMonths).toBe(2);
  });

  it("un impayé est remboursé en priorité (avant la ligne de crédit) dès que du cash redevient disponible", () => {
    const base = createBusiness("Test", ["service"], { creditLineLimit: 5_000, creditLineInterestRateAnnual: 0 });
    const business: BusinessState = {
      ...base,
      treasury: { ...base.treasury, unpaidObligations: 1_000, creditLine: { ...base.treasury.creditLine, drawn: 500 } },
    };
    const statement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 20_000 }); // gros excédent
    const result = applyMonthlyCashFlow(business, statement);

    expect(result.outcome.kind).toBe("obligations-repaid");
    expect(result.business.treasury.unpaidObligations).toBe(0);
    expect(result.business.treasury.creditLine.drawn).toBe(0); // remboursée ensuite, une fois les impayés soldés
    expect(result.business.treasury.cash).toBeGreaterThan(0);
  });

  it("un remboursement partiel d'impayés reste visible (pas de solde qui s'évapore)", () => {
    const base = createBusiness("Test", ["service"], NO_FINANCING);
    const business: BusinessState = { ...base, treasury: { ...base.treasury, unpaidObligations: 5_000 } };
    const statement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 10_800 }); // petit excédent (cashFlow ~1100)
    expect(statement.cashFlow).toBeGreaterThan(0);
    expect(statement.cashFlow).toBeLessThan(5_000);

    const result = applyMonthlyCashFlow(business, statement);
    const accrued = 5_000 * (1 + UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY);
    expect(result.business.treasury.unpaidObligations).toBeCloseTo(accrued - statement.cashFlow);
    expect(result.business.treasury.unpaidObligations).toBeGreaterThan(0);
    expect(result.business.treasury.cash).toBe(0);
  });

  it("aucune création ni destruction artificielle de cash : identité de conservation exacte", () => {
    // netPosition = cash - créditTiré - impayés. Chaque mois, sa variation doit être
    // exactement cashFlow moins la pénalité de retard accumulée sur l'impayé existant —
    // jamais autre chose : aucun euro ne doit apparaître ou disparaître ailleurs.
    const fixtures: ReadonlyArray<{ readonly treasury: BusinessState["treasury"]; readonly cashFlow: number }> = [
      { treasury: { cash: 0, creditLine: { limit: 5000, drawn: 0, interestRateAnnual: 0 }, unpaidObligations: 0, consecutiveUnpaidMonths: 0, isInsolvent: false }, cashFlow: 1200 },
      { treasury: { cash: 200, creditLine: { limit: 5000, drawn: 1000, interestRateAnnual: 0 }, unpaidObligations: 0, consecutiveUnpaidMonths: 0, isInsolvent: false }, cashFlow: -3000 },
      { treasury: { cash: 0, creditLine: { limit: 1000, drawn: 1000, interestRateAnnual: 0 }, unpaidObligations: 2000, consecutiveUnpaidMonths: 2, isInsolvent: false }, cashFlow: -500 },
      { treasury: { cash: 0, creditLine: { limit: 1000, drawn: 500, interestRateAnnual: 0 }, unpaidObligations: 8000, consecutiveUnpaidMonths: 4, isInsolvent: false }, cashFlow: 12000 },
      { treasury: { cash: 0, creditLine: { limit: 0, drawn: 0, interestRateAnnual: 0 }, unpaidObligations: 3000, consecutiveUnpaidMonths: 3, isInsolvent: false }, cashFlow: 0 },
    ];

    for (const fixture of fixtures) {
      const business: BusinessState = { name: "Test", families: ["service"], treasury: fixture.treasury };
      // Avec BASE_INPUTS, netIncome est fixe (900) quel que soit workingCapitalChange
      // (qui n'entre en jeu qu'après impôt) : cashFlow = netIncome + depreciation - workingCapitalChange.
      const baseStatement = computeMonthlyFinancials(BASE_INPUTS);
      const workingCapitalChange = baseStatement.netIncome + baseStatement.depreciation - fixture.cashFlow;
      const statement = computeMonthlyFinancials({ ...BASE_INPUTS, workingCapitalChange });
      expect(statement.cashFlow).toBeCloseTo(fixture.cashFlow, 6);

      const netPositionBefore = fixture.treasury.cash - fixture.treasury.creditLine.drawn - fixture.treasury.unpaidObligations;
      const penalty = fixture.treasury.unpaidObligations * UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY;

      const result = applyMonthlyCashFlow(business, statement);
      const t = result.business.treasury;
      const netPositionAfter = t.cash - t.creditLine.drawn - t.unpaidObligations;

      expect(netPositionAfter).toBeCloseTo(netPositionBefore + statement.cashFlow - penalty, 6);
      expect(t.cash).toBeGreaterThanOrEqual(0);
      expect(t.creditLine.drawn).toBeGreaterThanOrEqual(0);
      expect(t.creditLine.drawn).toBeLessThanOrEqual(fixture.treasury.creditLine.limit + 1e-9);
      expect(t.unpaidObligations).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("applyMonthlyCashFlow — insolvabilité (spec §3.7 : signal préalable conservé)", () => {
  it("scénario : faillite réelle — obligations impayées persistantes pendant plusieurs mois consécutifs", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 1_000, creditLineInterestRateAnnual: 0 });
    const ruinousStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 0, capex: 5_000 });

    let sawInsolvency = false;
    let previousUnpaid = 0;
    for (let month = 0; month < INSOLVENCY_THRESHOLD_MONTHS; month++) {
      const result = applyMonthlyCashFlow(business, ruinousStatement);
      business = result.business;
      expect(business.treasury.cash).toBe(0); // jamais négatif
      expect(business.treasury.unpaidObligations).toBeGreaterThan(previousUnpaid); // la dette progresse (conséquence progressive)
      previousUnpaid = business.treasury.unpaidObligations;
      if (result.outcome.kind === "insolvent") {
        sawInsolvency = true;
      }
      if (month < INSOLVENCY_THRESHOLD_MONTHS - 1) {
        expect(business.treasury.isInsolvent).toBe(false);
      }
    }
    expect(sawInsolvency).toBe(true);
    expect(business.treasury.isInsolvent).toBe(true);
    expect(business.treasury.consecutiveUnpaidMonths).toBe(INSOLVENCY_THRESHOLD_MONTHS);
    expect(business.treasury.unpaidObligations).toBeGreaterThan(0); // la dette reste visible, jamais évaporée
  });

  it("un mois qui solde intégralement les impayés réinitialise le compteur (pas de catastrophe rétroactive)", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 1_000, creditLineInterestRateAnnual: 0 });
    const ruinousStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 0, capex: 5_000 });
    business = applyMonthlyCashFlow(business, ruinousStatement).business;
    business = applyMonthlyCashFlow(business, ruinousStatement).business;
    expect(business.treasury.consecutiveUnpaidMonths).toBe(2);
    expect(business.treasury.unpaidObligations).toBeGreaterThan(0);

    const goodStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 100_000 });
    business = applyMonthlyCashFlow(business, goodStatement).business;
    expect(business.treasury.unpaidObligations).toBe(0);
    expect(business.treasury.consecutiveUnpaidMonths).toBe(0);
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
  it("augmente directement le cash sans toucher à la ligne de crédit ni aux impayés", () => {
    const business = createBusiness("Test", ["service"], { creditLineLimit: 5_000, creditLineInterestRateAnnual: 0 });
    const funded = injectCapital(business, 20_000);
    expect(funded.treasury.cash).toBe(20_000);
    expect(funded.treasury.creditLine.drawn).toBe(0);
    expect(funded.treasury.unpaidObligations).toBe(0);
  });

  it("un apport préventif peut éviter la liquidation d'une entreprise en difficulté", () => {
    let business = createBusiness("Test", ["service"], { creditLineLimit: 1_000, creditLineInterestRateAnnual: 0 });
    const ruinousStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 0, capex: 5_000 });

    for (let month = 0; month < INSOLVENCY_THRESHOLD_MONTHS - 1; month++) {
      business = applyMonthlyCashFlow(business, ruinousStatement).business;
    }
    expect(business.treasury.isInsolvent).toBe(false);
    expect(business.treasury.consecutiveUnpaidMonths).toBe(INSOLVENCY_THRESHOLD_MONTHS - 1);
    expect(business.treasury.unpaidObligations).toBeGreaterThan(0);

    business = injectCapital(business, 1_000_000);
    const goodStatement = computeMonthlyFinancials({ ...BASE_INPUTS, revenue: 100_000 });
    business = applyMonthlyCashFlow(business, goodStatement).business;

    expect(business.treasury.isInsolvent).toBe(false);
    expect(business.treasury.consecutiveUnpaidMonths).toBe(0);
    expect(business.treasury.unpaidObligations).toBe(0);
  });

  it("rejette un montant négatif", () => {
    const business = createBusiness("Test", ["service"], NO_FINANCING);
    expect(() => injectCapital(business, -1)).toThrow(RangeError);
  });
});
