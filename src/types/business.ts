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
 * Ligne de crédit / découvert autorisé (spec : "distinction entre cash
 * disponible, découvert/ligne de crédit, besoin de financement,
 * insolvabilité"). `drawn` ne peut jamais dépasser `limit`.
 */
export interface CreditLineState {
  readonly limit: number;
  readonly drawn: number;
  readonly interestRateAnnual: number;
}

/**
 * Trésorerie d'une entreprise. `cash` ne peut jamais être négatif : un
 * besoin de financement non couvert par le cash disponible est d'abord
 * absorbé par la ligne de crédit (jusqu'à `creditLine.limit`), jamais par
 * un solde de cash fictif négatif (spec : "une trésorerie réellement
 * négative ne doit pas être possible sans mécanisme explicite permettant
 * de la financer").
 *
 * `unpaidObligations` est le montant réellement dû mais non réglé une fois
 * la ligne de crédit épuisée (spec de clôture M9.5 : "aucun coût engagé ne
 * doit disparaître"). Ce n'est pas un solde qui s'évapore : il persiste
 * d'un mois à l'autre, porte une pénalité de retard tant qu'il reste dû
 * (conséquence progressive), et est remboursé en priorité dès que du cash
 * redevient disponible (voir engine/business/treasury.ts).
 *
 * `consecutiveUnpaidMonths` est le signal précurseur exigé par la spec §3.7
 * ("pas de catastrophe instantanée sans signal") : il compte les mois
 * consécutifs où `unpaidObligations > 0` en fin de mois — pas un simple
 * mois de cash-flow négatif, qui peut parfaitement être absorbé par le
 * cash ou le crédit disponible sans laisser aucune dette. `isInsolvent`
 * devient vrai quand ce compteur atteint le seuil de liquidation forcée.
 */
export interface TreasuryState {
  readonly cash: number;
  readonly creditLine: CreditLineState;
  readonly unpaidObligations: number;
  readonly consecutiveUnpaidMonths: number;
  readonly isInsolvent: boolean;
}

/** État minimal d'une entreprise pour le P0. */
export interface BusinessState {
  readonly name: string;
  readonly families: readonly EconomicFamily[];
  readonly treasury: TreasuryState;
}
