import type { OfferPositioning } from "./offer.js";

/**
 * Segment de clientèle d'un marché (spec M11.2.2 §2). Donnée statique,
 * déterministe, catalogue par famille (`engine/market/segments.ts`) — pas
 * un état persisté : `getMarketSegments(family)` renvoie toujours le même
 * résultat pour une famille donnée, aucune migration nécessaire.
 *
 * Les coefficients internes (`priceSensitivity`, `qualityExpectation`,
 * `referencePrice`, `trustImportance`, `structuralTrend`) ne doivent
 * jamais atteindre le web au-delà d'une projection minimale `{id, label}`
 * (spec §5, §11) — voir `web/src/data/publicSegments.ts`.
 */
export interface CustomerSegment {
  readonly id: string;
  /** Description métier compréhensible, ex. "Entreprises exigeantes". */
  readonly label: string;
  /** Part du marché de la famille attribuable à ce segment, 0-1 (les segments d'une famille somment à 1). */
  readonly relativeSize: number;
  /** Prix "normal" perçu par ce segment, dans l'unité native de la famille (€/heure, €/ticket, €/unité, €/mandat, €/mois). */
  readonly referencePrice: number;
  readonly preferredPositioning: OfferPositioning;
  /** 0-1 : sévérité de la pénalité si le prix de l'offre dépasse `referencePrice`. */
  readonly priceSensitivity: number;
  /** 0-100 : qualité en-deçà de laquelle l'offre déçoit ce segment. */
  readonly qualityExpectation: number;
  /** 0-1 : poids de la réputation/confiance dans l'adéquation pour ce segment. */
  readonly trustImportance: number;
  /** Dérive linéaire (jamais exponentielle) de `relativeSize` par mois d'ancienneté de l'offre — petite, signée. */
  readonly structuralTrend: number;
  /** 12 multiplicateurs saisonniers, centrés sur 1 (index 0 = janvier). */
  readonly seasonality: readonly number[];
}
