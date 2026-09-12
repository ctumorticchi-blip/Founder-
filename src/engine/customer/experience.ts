function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Pression opérationnelle sur une offre (spec M11.2.3 §4) : `saturationRatio`
 * est agnostique de la famille — calculé par `businessResolution.ts` comme
 * `demande / capacité` (familles à capacité finie) ou dérivé de
 * `understaffingPenalty` (Subscription, spec §4). `0` = aucune tension.
 */
export interface OperationalPressure {
  readonly saturationRatio: number;
}

/** En-deçà de ce ratio demande/capacité, l'organisation absorbe la charge sans dégradation perceptible. */
const SATURATION_COMFORT_THRESHOLD = 0.8;
/** Points de qualité perdus par unité de ratio au-delà du seuil de confort. */
const OPERATIONAL_PENALTY_SLOPE = 50;
/** Une organisation sous tension ne peut jamais réduire l'expérience à zéro à elle seule. */
const MAX_OPERATIONAL_PENALTY = 40;

/**
 * Pénalité infligée à l'expérience délivrée par la tension opérationnelle
 * (spec §4). Pure, déterministe — jamais de RNG (contrairement au bruit
 * d'exécution déjà présent dans les moteurs économiques historiques, qui
 * reste inchangé et distinct de cette pénalité).
 */
export function computeOperationalPenalty(pressure: OperationalPressure): number {
  const excess = Math.max(0, pressure.saturationRatio - SATURATION_COMFORT_THRESHOLD);
  return clamp(excess * OPERATIONAL_PENALTY_SLOPE, 0, MAX_OPERATIONAL_PENALTY);
}

/**
 * Expérience réellement délivrée (spec M11.2.3 §4) : part de la qualité
 * intrinsèque de l'offre (`qualityLevel`), dégradée par l'exécution
 * opérationnelle. Une offre de qualité 90 ne garantit pas une expérience
 * de 90 — une entreprise surchargée délivre moins que ce qu'elle a construit.
 */
export function computeDeliveredExperience(qualityLevel: number, operationalPenalty: number): number {
  return clamp(qualityLevel - operationalPenalty, 0, 100);
}
