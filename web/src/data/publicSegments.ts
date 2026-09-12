import type { EconomicFamily } from "@founder/engine";
import { getMarketSegments } from "@founder/engine";

/**
 * Projection minimale des segments clients d'une famille pour le sélecteur
 * de cible (spec M11.2.2 §11) : `{id, label}` uniquement — jamais les
 * coefficients internes (`priceSensitivity`/`qualityExpectation`/
 * `referencePrice`/`trustImportance`/`structuralTrend`, spec §5, §7). Le
 * moteur ne persiste aucun état pour les segments (catalogue statique) :
 * cette projection est recalculée à chaque affichage, jamais stockée.
 */
export interface PublicSegmentOption {
  readonly id: string;
  readonly label: string;
}

export function getPublicSegmentOptions(family: EconomicFamily): readonly PublicSegmentOption[] {
  return getMarketSegments(family).map((segment) => ({ id: segment.id, label: segment.label }));
}
