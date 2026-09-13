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

/** Positionnement qualitatif estimé d'un concurrent identifié (spec M11.2.5 §5). */
export type CompetitivePositionLevel = "economy" | "standard" | "premium";
/** Part de marché qualitative estimée d'un concurrent identifié (spec M11.2.5 §5). */
export type MarketShareLevel = "low" | "moderate" | "high";

/**
 * Projection bruitée d'un `Competitor` (types/competition.ts) pour le
 * joueur — jamais un score brut, toujours un palier qualitatif (même
 * patron que `bucketPriceSignal`/`bucketVisibility`, `market/demand.ts`).
 * Le nom n'est jamais bruité (une identité n'est pas une grandeur
 * économique).
 */
export interface CompetitorView {
  readonly id: string;
  readonly name: string;
  readonly positionLevel: CompetitivePositionLevel;
  readonly shareLevel: MarketShareLevel;
}

/**
 * Projection bruitée d'un `SegmentAvailability` (types/demand.ts) pour le
 * joueur (spec M11.2.6.2 §1) — une fourchette, jamais un nombre brut. Le
 * segment (id/libellé) n'est jamais bruité, seule sa taille adressable
 * l'est.
 */
export interface SegmentAvailabilityEstimate {
  readonly segmentId: string;
  readonly segmentLabel: string;
  readonly availableMarket: Estimate;
}
