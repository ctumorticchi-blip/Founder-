import type { SatisfactionDiagnosis, SatisfactionLevel, SatisfactionResult } from "../../types/satisfaction.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Points de score par point d'écart expérience-attentes (spec M11.2.3 §5). */
const SATISFACTION_GAP_SCALE = 1.2;

const HIGH_EXPECTATION_THRESHOLD = 70;
/** Marge (en points d'écart) au-delà de laquelle un diagnostic causal est déclenché. */
const DIAGNOSIS_MARGIN = 10;
const STRAIN_DIAGNOSIS_THRESHOLD = 15;

/**
 * Traduit un score interne 0-100 en signal public qualitatif (spec §4) —
 * exportée pour que l'écran puisse catégoriser un score déjà connu (ex.
 * `smoothedSatisfactionScore` en mémoire) sans jamais réimplémenter ses
 * propres seuils (spec §15 : aucun coefficient interne inventé côté web).
 */
export function bucketSatisfactionLevel(score: number): SatisfactionLevel {
  if (score >= 80) return "very-positive";
  if (score >= 62) return "positive";
  if (score >= 42) return "mixed";
  if (score >= 22) return "negative";
  return "very-negative";
}

/**
 * Satisfaction d'un segment (spec M11.2.3 §5) : écart entre l'expérience
 * réellement délivrée et les attentes de ce segment — jamais un score
 * opaque, le diagnostic causal accompagne toujours le résultat pour que
 * l'UI explique sans jamais inventer une raison après coup (spec §5, §15).
 * Pure, déterministe.
 */
export function computeSatisfaction(
  expectation: number,
  deliveredExperience: number,
  priceRatio: number,
  operationalPenalty: number,
): SatisfactionResult {
  const gap = deliveredExperience - expectation;
  const score = clamp(50 + gap * SATISFACTION_GAP_SCALE, 0, 100);
  const level = bucketSatisfactionLevel(score);

  const diagnosis: SatisfactionDiagnosis = {
    highExpectations: expectation >= HIGH_EXPECTATION_THRESHOLD,
    greatValueForMoney: priceRatio <= 1 && score >= 62,
    qualityAboveExpectations: gap >= DIAGNOSIS_MARGIN,
    operationsUnderStrain: operationalPenalty >= STRAIN_DIAGNOSIS_THRESHOLD,
    experienceBelowPromise: gap <= -DIAGNOSIS_MARGIN,
  };

  return { score, level, diagnosis };
}
