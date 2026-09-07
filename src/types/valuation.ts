/** Une composante explicable de la valorisation (spec M11.1.5 §6.1, "Pourquoi cette entreprise vaut environ X ?"). */
export interface ValuationFactor {
  readonly label: string;
  readonly amount: number;
}

/**
 * Fourchette de valorisation déterministe (spec M11.1.5 §6.1). `factors`
 * détaille les composantes qui somment vers `mid` — traçabilité exigée par
 * le brief, jamais une boîte noire.
 */
export interface ValuationResult {
  readonly low: number;
  readonly mid: number;
  readonly high: number;
  readonly factors: readonly ValuationFactor[];
}
