/**
 * Familles économiques actives en P0 (spec §7). Une entreprise peut combiner
 * plusieurs familles (spec §3.8, composabilité) ; en P0 la plupart des
 * entreprises n'en activent qu'une seule.
 */
export const ECONOMIC_FAMILIES = [
  "retail",
  "service",
  "hospitality",
  "agency",
  "subscription",
] as const;

export type EconomicFamily = (typeof ECONOMIC_FAMILIES)[number];

/**
 * Sortie commune d'un `EconomicEngine` pour un mois donné : uniquement la
 * partie "métier" du compte de résultat (revenus et coûts variables). Les
 * lignes transversales (salaires, marketing, loyers, administration, etc.)
 * sont ajoutées une seule fois au niveau du Business Engine (spec §3.9),
 * jamais dupliquées par famille.
 */
export interface EconomicContribution {
  readonly revenue: number;
  readonly variableCosts: number;
}

/**
 * Entrées du compte de résultat mensuel consolidé (spec §6). `taxRate` est
 * un paramètre (0-1), pas une donnée de sortie du compte de résultat.
 */
export interface MonthlyFinancialStatementInputs {
  readonly revenue: number;
  readonly variableCosts: number;
  readonly payroll: number;
  readonly marketing: number;
  readonly rent: number;
  readonly admin: number;
  readonly depreciation: number;
  readonly interest: number;
  readonly taxRate: number;
  readonly capex: number;
  /** Variation du BFR : positif = augmentation du BFR = consommation de cash. */
  readonly workingCapitalChange: number;
}

/**
 * Compte de résultat mensuel consolidé + cash-flow (spec §6). Invariant
 * important : `netIncome` peut être positif alors que `cashFlow` est
 * négatif (CAPEX ou hausse de BFR non financés) — voir
 * test/engine/business/accounting.test.ts.
 */
export interface MonthlyFinancialStatement {
  readonly revenue: number;
  readonly variableCosts: number;
  readonly grossMargin: number;
  readonly payroll: number;
  readonly marketing: number;
  readonly rent: number;
  readonly admin: number;
  readonly ebitda: number;
  readonly depreciation: number;
  readonly interest: number;
  readonly ebt: number;
  readonly taxes: number;
  readonly netIncome: number;
  readonly capex: number;
  readonly workingCapitalChange: number;
  readonly cashFlow: number;
}

/**
 * État minimal d'une entreprise pour le P0. `consecutiveNegativeCashMonths`
 * est le signal précurseur exigé par la spec §3.7 ("pas de catastrophe
 * instantanée sans signal") : une liquidation forcée (introduite dans un
 * milestone ultérieur) devra se déclencher sur ce compteur, jamais sur un
 * seul mois de trésorerie négative.
 */
export interface BusinessState {
  readonly name: string;
  readonly families: readonly EconomicFamily[];
  readonly cash: number;
  readonly consecutiveNegativeCashMonths: number;
}
