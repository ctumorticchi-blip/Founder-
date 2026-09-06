/**
 * Estimation bruitée d'une grandeur réelle (spec §9, information imparfaite).
 * `uncertainty` est l'écart-type du bruit appliqué : plus il est grand, moins
 * l'estimation est fiable. Jamais 0, même à compétence maximale (spec §3.5).
 */
export interface Estimate {
  readonly value: number;
  readonly uncertainty: number;
}

/** Projection bruitée d'un `Market` (types/market.ts) pour le joueur. */
export interface MarketEstimate {
  readonly marketId: string;
  readonly sizeMonthlyRevenuePotential: Estimate;
  readonly growthRateMonthly: Estimate;
  readonly competitiveIntensity: Estimate;
}
