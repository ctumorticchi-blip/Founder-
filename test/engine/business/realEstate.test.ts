import { describe, expect, it } from "vitest";
import {
  MORTGAGE_DEBT_SERVICE_RATIO,
  applyMortgagePayment,
  computeMortgagePayment,
  evaluateFinancingEligibility,
  purchaseProperty,
} from "../../../src/engine/business/realEstate.js";
import { createBusiness } from "../../../src/engine/business/treasury.js";

describe("computeMortgagePayment", () => {
  it("calcule une mensualité d'amortissement standard (cas vérifiable à la main)", () => {
    // 120 000 € à 6%/an sur 120 mois -> mensualité ≈ 1 332,00 €
    const payment = computeMortgagePayment(120_000, 0.06, 120);
    expect(payment).toBeCloseTo(1332.0, 0);
  });

  it("sans intérêt, la mensualité est simplement le principal réparti sur la durée", () => {
    expect(computeMortgagePayment(12_000, 0, 12)).toBeCloseTo(1_000, 6);
  });

  it("rejette une durée <= 0", () => {
    expect(() => computeMortgagePayment(10_000, 0.05, 0)).toThrow(RangeError);
  });
});

describe("evaluateFinancingEligibility", () => {
  it("refuse sans historique financier (pas de lastStatement)", () => {
    const result = evaluateFinancingEligibility({
      downPayment: 10_000,
      availableCash: 50_000,
      monthlyPayment: 500,
      lastStatementEbitda: null,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/historique/i);
  });

  it("refuse si l'apport dépasse le cash disponible", () => {
    const result = evaluateFinancingEligibility({
      downPayment: 60_000,
      availableCash: 50_000,
      monthlyPayment: 500,
      lastStatementEbitda: 5_000,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/apport/i);
  });

  it("refuse si la mensualité dépasse le ratio d'endettement autorisé", () => {
    const ebitda = 1_000;
    const result = evaluateFinancingEligibility({
      downPayment: 10_000,
      availableCash: 50_000,
      monthlyPayment: ebitda * MORTGAGE_DEBT_SERVICE_RATIO + 1,
      lastStatementEbitda: ebitda,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toMatch(/mensualité/i);
  });

  it("accepte quand apport et mensualité sont soutenables", () => {
    const result = evaluateFinancingEligibility({
      downPayment: 10_000,
      availableCash: 50_000,
      monthlyPayment: 1_000,
      lastStatementEbitda: 10_000,
    });
    expect(result.approved).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});

describe("purchaseProperty", () => {
  const business = { ...createBusiness("Test", ["service"], { creditLineLimit: 0, creditLineInterestRateAnnual: 0 }), treasury: { ...createBusiness("Test", ["service"], { creditLineLimit: 0, creditLineInterestRateAnnual: 0 }).treasury, cash: 50_000 } };

  it("déduit l'apport du cash entreprise et ajoute le bien à properties", () => {
    const { business: updated, property } = purchaseProperty(business, {
      purchasePrice: 200_000,
      monthlyMaintenance: 300,
      downPaymentFromPersonalCash: 40_000,
      mortgageTermMonths: 180,
      mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100,
    }, "prop-1");

    expect(updated.treasury.cash).toBeCloseTo(10_000, 6);
    expect(updated.properties).toHaveLength(1);
    expect(property.purchasePrice).toBe(200_000);
    expect(property.marketValue).toBe(200_000);
    expect(property.mortgage).not.toBeNull();
    expect(property.mortgage!.originalPrincipal).toBeCloseTo(160_000, 6);
  });

  it("aucun emprunt si l'apport couvre le prix total", () => {
    const { property } = purchaseProperty(business, {
      purchasePrice: 30_000,
      monthlyMaintenance: 100,
      downPaymentFromPersonalCash: 30_000,
      mortgageTermMonths: 120,
      mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100,
    }, "prop-2");
    expect(property.mortgage).toBeNull();
  });

  it("rejette un apport négatif ou supérieur au cash disponible", () => {
    expect(() =>
      purchaseProperty(business, { purchasePrice: 10_000, monthlyMaintenance: 50, downPaymentFromPersonalCash: -1, mortgageTermMonths: 60, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 }, "prop-3"),
    ).toThrow(RangeError);
    expect(() =>
      purchaseProperty(business, { purchasePrice: 10_000, monthlyMaintenance: 50, downPaymentFromPersonalCash: 999_999, mortgageTermMonths: 60, mortgageRateAnnual: 0.05, headcountCapacity: 10, storageCapacity: 100 }, "prop-4"),
    ).toThrow(RangeError);
  });
});

describe("applyMortgagePayment", () => {
  it("répartit intérêts/principal et fait décroître le principal restant sur plusieurs mois", () => {
    let mortgage = {
      originalPrincipal: 120_000,
      principalRemaining: 120_000,
      monthlyPayment: computeMortgagePayment(120_000, 0.06, 120),
      interestRateAnnual: 0.06,
      monthsRemaining: 120,
    };

    const balances: number[] = [mortgage.principalRemaining];
    for (let i = 0; i < 12; i++) {
      const result = applyMortgagePayment(mortgage);
      expect(result.interestPortion).toBeGreaterThan(0);
      expect(result.principalPortion).toBeGreaterThan(0);
      expect(result.mortgage).not.toBeNull();
      mortgage = result.mortgage!;
      balances.push(mortgage.principalRemaining);
    }

    // Le principal restant décroît strictement, jamais négatif.
    for (let i = 1; i < balances.length; i++) {
      expect(balances[i]).toBeLessThan(balances[i - 1]!);
      expect(balances[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it("solde l'emprunt (mortgage devient null) au dernier mois", () => {
    let mortgage = {
      originalPrincipal: 1_000,
      principalRemaining: 1_000,
      monthlyPayment: computeMortgagePayment(1_000, 0.05, 3),
      interestRateAnnual: 0.05,
      monthsRemaining: 3,
    };
    for (let i = 0; i < 3; i++) {
      const result = applyMortgagePayment(mortgage);
      if (i < 2) {
        expect(result.mortgage).not.toBeNull();
        mortgage = result.mortgage!;
      } else {
        expect(result.mortgage).toBeNull();
        expect(result.principalPortion).toBeGreaterThan(0);
      }
    }
  });

  it("un emprunt déjà soldé (appelé par erreur) ne produit aucun mouvement", () => {
    const mortgage = { originalPrincipal: 1_000, principalRemaining: 0, monthlyPayment: 100, interestRateAnnual: 0.05, monthsRemaining: 0 };
    const result = applyMortgagePayment(mortgage);
    expect(result.mortgage).toBeNull();
    expect(result.interestPortion).toBe(0);
    expect(result.principalPortion).toBe(0);
  });
});
