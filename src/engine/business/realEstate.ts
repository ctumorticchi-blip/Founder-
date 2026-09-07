import type { BusinessState } from "../../types/business.js";
import type { Mortgage, OwnedProperty, PropertyPurchaseSpec } from "../../types/realEstate.js";

/**
 * Fraction maximale de l'EBITDA du dernier mois résolu pouvant être
 * consacrée à une mensualité immobilière (spec M11.1.5 §4.2 : "critères
 * simples d'accès au financement basés sur la situation économique").
 */
export const MORTGAGE_DEBT_SERVICE_RATIO = 0.35;

/**
 * Mensualité d'un emprunt amortissable standard (annuité constante).
 * `annualRate = 0` dégénère proprement en un remboursement linéaire.
 */
export function computeMortgagePayment(principal: number, annualRateAnnual: number, termMonths: number): number {
  if (termMonths <= 0) {
    throw new RangeError(`computeMortgagePayment: termMonths=${termMonths} doit être > 0.`);
  }
  if (annualRateAnnual === 0) {
    return principal / termMonths;
  }
  const monthlyRate = annualRateAnnual / 12;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
}

export interface FinancingEligibilityInput {
  readonly downPayment: number;
  readonly availableCash: number;
  readonly monthlyPayment: number;
  /** `null` = l'entreprise n'a pas encore résolu de mois (pas d'historique financier). */
  readonly lastStatementEbitda: number | null;
}

export interface FinancingEligibilityResult {
  readonly approved: boolean;
  readonly reason?: string;
}

/**
 * Règle de financement V1, délibérément simple et déterministe (spec
 * M11.1.5 §4.2) : refuse sans historique financier, refuse un apport non
 * couvert par le cash disponible, refuse une mensualité disproportionnée
 * par rapport à la rentabilité récente. Toujours accompagnée d'une raison
 * explicite en cas de refus.
 */
export function evaluateFinancingEligibility(input: FinancingEligibilityInput): FinancingEligibilityResult {
  if (input.lastStatementEbitda === null) {
    return {
      approved: false,
      reason:
        "Aucun historique financier : au moins un mois d'activité résolu est nécessaire avant de financer un achat immobilier.",
    };
  }
  if (input.downPayment > input.availableCash) {
    return {
      approved: false,
      reason: `Apport de ${Math.round(input.downPayment)} € supérieur au cash disponible (${Math.round(input.availableCash)} €).`,
    };
  }
  const maxMonthlyPayment = Math.max(0, input.lastStatementEbitda) * MORTGAGE_DEBT_SERVICE_RATIO;
  if (input.monthlyPayment > maxMonthlyPayment) {
    return {
      approved: false,
      reason: `Mensualité de ${Math.round(input.monthlyPayment)} €/mois trop élevée pour votre rentabilité actuelle (maximum recommandé : ${Math.round(maxMonthlyPayment)} €/mois).`,
    };
  }
  return { approved: true };
}

/**
 * Achète un bien immobilier professionnel (spec M11.1.5 §4.2-4.3).
 * `spec.downPaymentFromPersonalCash` est déduit directement du cash de
 * l'entreprise : l'appelant (`businessResolution.ts`) est responsable d'y
 * avoir préalablement injecté l'apport personnel (même mécanisme que
 * `injectCapital`), donc le cash entreprise au moment de l'appel contient
 * déjà cet apport. Le reste du prix devient le principal de l'emprunt.
 */
export function purchaseProperty(
  business: BusinessState,
  spec: PropertyPurchaseSpec,
  propertyId: string,
): { readonly business: BusinessState; readonly property: OwnedProperty } {
  if (spec.downPaymentFromPersonalCash < 0) {
    throw new RangeError(`purchaseProperty: downPaymentFromPersonalCash=${spec.downPaymentFromPersonalCash} doit être >= 0.`);
  }
  if (spec.downPaymentFromPersonalCash > business.treasury.cash) {
    throw new RangeError(
      `purchaseProperty: apport de ${spec.downPaymentFromPersonalCash} supérieur au cash disponible (${business.treasury.cash}).`,
    );
  }
  if (spec.downPaymentFromPersonalCash > spec.purchasePrice) {
    throw new RangeError("purchaseProperty: l'apport ne peut pas dépasser le prix d'achat.");
  }

  const mortgagePrincipal = spec.purchasePrice - spec.downPaymentFromPersonalCash;
  const mortgage: Mortgage | null =
    mortgagePrincipal > 0
      ? {
          originalPrincipal: mortgagePrincipal,
          principalRemaining: mortgagePrincipal,
          monthlyPayment: computeMortgagePayment(mortgagePrincipal, spec.mortgageRateAnnual, spec.mortgageTermMonths),
          interestRateAnnual: spec.mortgageRateAnnual,
          monthsRemaining: spec.mortgageTermMonths,
        }
      : null;

  const property: OwnedProperty = {
    id: propertyId,
    purchasePrice: spec.purchasePrice,
    marketValue: spec.purchasePrice,
    monthlyMaintenance: spec.monthlyMaintenance,
    owner: "business",
    mortgage,
    headcountCapacity: spec.headcountCapacity,
    storageCapacity: spec.storageCapacity,
  };

  return {
    business: {
      ...business,
      treasury: { ...business.treasury, cash: business.treasury.cash - spec.downPaymentFromPersonalCash },
      properties: [...business.properties, property],
    },
    property,
  };
}

export interface MortgagePaymentResult {
  readonly mortgage: Mortgage | null;
  readonly interestPortion: number;
  readonly principalPortion: number;
}

/**
 * Applique la mensualité du mois : répartit intérêts/principal (aucun
 * aléa), fait décroître `principalRemaining`, solde l'emprunt
 * (`mortgage: null`) au dernier mois ou si déjà remboursé.
 */
export function applyMortgagePayment(mortgage: Mortgage): MortgagePaymentResult {
  if (mortgage.monthsRemaining <= 0 || mortgage.principalRemaining <= 0) {
    return { mortgage: null, interestPortion: 0, principalPortion: 0 };
  }

  const monthlyRate = mortgage.interestRateAnnual / 12;
  const interestPortion = mortgage.principalRemaining * monthlyRate;
  const principalPortion = Math.min(mortgage.principalRemaining, mortgage.monthlyPayment - interestPortion);
  const principalRemaining = Math.max(0, mortgage.principalRemaining - principalPortion);
  const monthsRemaining = mortgage.monthsRemaining - 1;

  const nextMortgage: Mortgage | null =
    principalRemaining > 0 && monthsRemaining > 0 ? { ...mortgage, principalRemaining, monthsRemaining } : null;

  return { mortgage: nextMortgage, interestPortion, principalPortion };
}

/** Maintenance mensuelle cumulée de tous les biens possédés (conséquence engine, pas une entrée web). */
export function computeTotalMaintenance(properties: readonly OwnedProperty[]): number {
  return properties.reduce((sum, property) => sum + property.monthlyMaintenance, 0);
}
