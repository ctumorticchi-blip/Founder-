/**
 * Composantes de l'adéquation offre/segment (spec M11.2.2 §3). Jamais
 * réduites à un score unique et opaque avant la fin : conservées pour
 * l'explicabilité (spec §11) — l'UI peut expliquer pourquoi un segment est
 * attiré ou repoussé sans que le moteur invente une raison après coup.
 */
export interface FitBreakdown {
  readonly priceFit: number;
  readonly qualityFit: number;
  readonly positioningFit: number;
  readonly trustFit: number;
  /** Combinaison pondérée par les poids propres au segment (spec §3). */
  readonly overallFit: number;
}

/** Niveau de connaissance du marché — jamais la valeur brute (spec §5, §7). */
export type VisibilityLevel = "low" | "medium" | "high";
/** Perception du prix par les segments touchés — jamais le ratio exact. */
export type PriceSignal = "low" | "fair" | "high";
/** Perception de la demande — jamais le fit numérique brut. */
export type DemandSignal = "weak" | "moderate" | "strong";

/**
 * Contribution d'un segment à la demande d'une offre (spec M11.2.3 §2.2) —
 * extension additive de M11.2.2 : la boucle par segment existait déjà dans
 * `computeOfferDemand`, seule l'exposition de son détail est nouvelle (pas
 * une duplication du calcul de demande). Consommée par la couche
 * Satisfaction & Retention pour attribuer ventes/satisfaction par segment.
 */
export interface SegmentDemandContribution {
  readonly segmentId: string;
  readonly segmentLabel: string;
  readonly demand: number;
  readonly fit: FitBreakdown;
}

/**
 * Résultat de l'entonnoir de demande d'une offre pour un mois (spec §6) :
 * marché disponible → clients exposés → clients intéressés → demande →
 * capacité → ventes. Persisté sur `Offer.lastDemand` pour que l'écran
 * puisse toujours afficher "ce mois-ci" sans recalcul côté web.
 */
export interface DemandFunnelResult {
  readonly availableMarket: number;
  readonly reached: number;
  readonly interested: number;
  /** Demande dans l'unité native de la famille (heures, couverts, unités, mandats, abonnés). */
  readonly demand: number;
  /** `Infinity` quand le moteur économique de la famille ne plafonne pas l'admission (spec §6.2, subscription). */
  readonly capacity: number;
  readonly sales: number;
  readonly lostToCapacity: number;
  readonly topSegmentId: string;
  readonly topSegmentLabel: string;
  /** Moyenne pondérée par la contribution de chaque segment à la demande. */
  readonly fit: FitBreakdown;
  readonly visibilityLevel: VisibilityLevel;
  readonly priceSignal: PriceSignal;
  readonly demandSignal: DemandSignal;
  /** Ventilation par segment (spec M11.2.3 §2.2) — additif, jamais consommé par M11.2.2 lui-même. */
  readonly bySegment: readonly SegmentDemandContribution[];
}
