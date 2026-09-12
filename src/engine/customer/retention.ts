import type { SatisfactionDiagnosis, SegmentCustomerMemory } from "../../types/satisfaction.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Poids de lissage (EWMA) de la satisfaction — assez petit pour qu'un seul mois ne l'écrase pas (spec M11.2.3 §8). */
const SATISFACTION_EWMA_ALPHA = 0.35;
/** Poids de lissage (EWMA) du volume récurrent — même principe d'inertie. */
const VOLUME_EWMA_ALPHA = 0.4;
/** Seuils de qualification d'un "bon"/"mauvais" mois pour les compteurs de séries consécutives. */
const GOOD_MONTH_THRESHOLD = 62;
const BAD_MONTH_THRESHOLD = 42;

/** Probabilité de réachat/maintien dérivée de la satisfaction lissée (spec §8). Jamais 0 ni 1 : toujours un peu d'inertie des deux côtés. */
export function computeRepeatRate(smoothedSatisfactionScore: number): number {
  return clamp(smoothedSatisfactionScore / 100, 0.05, 0.95);
}

/**
 * Met à jour la mémoire d'un segment pour une offre après un mois résolu
 * (spec M11.2.3 §6, §8). Pure, déterministe — aucun aléa. `previous: null`
 * signifie premier contact du moteur avec ce segment pour cette offre.
 * `satisfactionThisMonth: null` signifie qu'aucune vente n'a eu lieu ce
 * mois-ci pour ce segment (aucune mesure possible).
 */
export function updateSegmentMemory(
  previous: SegmentCustomerMemory | null,
  segmentId: string,
  segmentLabel: string,
  actualVolumeThisMonth: number,
  satisfactionThisMonth: number | null,
  diagnosisThisMonth: SatisfactionDiagnosis | null,
): SegmentCustomerMemory {
  const priorBase = previous?.retainedBaseVolume ?? 0;
  const repeatRate = computeRepeatRate(previous?.smoothedSatisfactionScore ?? 50);
  const expectedRetained = priorBase * repeatRate;
  const retainedVolumeThisMonth = Math.min(actualVolumeThisMonth, expectedRetained);
  const newVolumeThisMonth = Math.max(0, actualVolumeThisMonth - retainedVolumeThisMonth);

  // Inertie (spec §8) : la base glisse vers la valeur du mois, elle n'y saute jamais.
  const retainedBaseVolume = priorBase * (1 - VOLUME_EWMA_ALPHA) + actualVolumeThisMonth * VOLUME_EWMA_ALPHA;

  const smoothedSatisfactionScore =
    satisfactionThisMonth === null
      ? (previous?.smoothedSatisfactionScore ?? 50)
      : (previous?.smoothedSatisfactionScore ?? satisfactionThisMonth) * (1 - SATISFACTION_EWMA_ALPHA) +
        satisfactionThisMonth * SATISFACTION_EWMA_ALPHA;

  const cumulativeAcquiredVolume = (previous?.cumulativeAcquiredVolume ?? 0) + newVolumeThisMonth;

  let consecutiveGoodMonths = previous?.consecutiveGoodMonths ?? 0;
  let consecutiveBadMonths = previous?.consecutiveBadMonths ?? 0;
  if (satisfactionThisMonth !== null) {
    if (satisfactionThisMonth >= GOOD_MONTH_THRESHOLD) {
      consecutiveGoodMonths += 1;
      consecutiveBadMonths = 0;
    } else if (satisfactionThisMonth <= BAD_MONTH_THRESHOLD) {
      consecutiveBadMonths += 1;
      consecutiveGoodMonths = 0;
    } else {
      consecutiveGoodMonths = 0;
      consecutiveBadMonths = 0;
    }
  }

  const monthsSinceFirstSale =
    previous?.monthsSinceFirstSale !== null && previous?.monthsSinceFirstSale !== undefined
      ? previous.monthsSinceFirstSale + 1
      : actualVolumeThisMonth > 0
        ? 0
        : null;

  return {
    segmentId,
    segmentLabel,
    retainedBaseVolume,
    newVolumeThisMonth,
    retainedVolumeThisMonth,
    cumulativeAcquiredVolume,
    lastSatisfactionScore: satisfactionThisMonth,
    smoothedSatisfactionScore,
    lastDiagnosis: satisfactionThisMonth === null ? (previous?.lastDiagnosis ?? null) : diagnosisThisMonth,
    consecutiveGoodMonths,
    consecutiveBadMonths,
    monthsSinceFirstSale,
  };
}

/** Déplacement maximal de réputation en un mois — jamais de réparation ni de chute instantanée (spec M11.2.3 §9). */
const REPUTATION_MAX_MONTHLY_SHIFT = 0.03;

/**
 * Met à jour la réputation d'une entreprise (spec §9) : remplace les
 * anciennes formules naïves par famille (`reputationScore += volume *
 * coefficient`, sans satisfaction ni inertie). Un mois à fort volume ET
 * satisfaction élevée fait progresser la réputation ; à satisfaction
 * basse, elle régresse — jamais l'un sans l'autre. `volumeWeight` évite
 * qu'un mois anecdotique pèse autant qu'un mois massif ; le déplacement
 * plafonné évite toute réparation/chute instantanée. Pure, déterministe.
 */
export function computeReputationUpdate(
  currentReputation: number,
  monthVolumeWeightedSatisfaction: number,
  monthTotalVolume: number,
  referenceVolumeForFullWeight: number,
): number {
  const volumeWeight = referenceVolumeForFullWeight > 0 ? clamp(monthTotalVolume / referenceVolumeForFullWeight, 0, 1) : 0;
  const satisfactionSignal = clamp((monthVolumeWeightedSatisfaction - 50) / 50, -1, 1);
  const shift = satisfactionSignal * volumeWeight * REPUTATION_MAX_MONTHLY_SHIFT;
  return clamp(currentReputation + shift, 0, 1);
}

/** Poids maximal du bouche-à-oreille dans la visibilité — un facteur d'appoint, jamais un canal dominant. */
const WORD_OF_MOUTH_MAX = 0.25;
const WORD_OF_MOUTH_SCALE = 0.5;

/**
 * Bouche-à-oreille organique (spec §10) : dépend de la satisfaction
 * lissée ET du volume lissé de clients concernés — jamais l'un sans
 * l'autre (4 clients ravis ne suffisent pas). Volontairement indépendant
 * de `reputationScore` dans sa propre formule pour ne jamais le compter
 * deux fois dans `computeVisibilityFactor` (spec §6.2, auto-revue). Un
 * mauvais mois isolé ne produit jamais de bouche-à-oreille négatif (hors
 * scope M11.2.5/6 — pas de "bad buzz") : seul le signal positif compte.
 */
export function computeWordOfMouth(
  smoothedSatisfactionScore: number,
  smoothedVolume: number,
  referenceVolumeForFullWeight: number,
): number {
  const volumeWeight = referenceVolumeForFullWeight > 0 ? clamp(smoothedVolume / referenceVolumeForFullWeight, 0, 1) : 0;
  const positiveSignal = clamp((smoothedSatisfactionScore - 50) / 50, 0, 1);
  return clamp(positiveSignal * volumeWeight * WORD_OF_MOUTH_SCALE, 0, WORD_OF_MOUTH_MAX);
}

/** Amplitude maximale de l'ajustement de churn dû à la satisfaction (spec §13) — multiplicatif, distinct de `understaffingPenalty`. */
const MAX_SATISFACTION_CHURN_SWING = 0.6;

/**
 * Ajustement multiplicatif du churn de Subscription dérivé de la
 * satisfaction (spec §13) : `effectiveChurnRate = churnRateBase * (1 +
 * understaffingPenalty) * (1 + computeSubscriptionChurnAdjustment(...))`.
 * `0` quand aucune mémoire n'existe encore (satisfaction neutre 50) —
 * jamais d'effet tant qu'aucune vente n'a eu lieu.
 */
export function computeSubscriptionChurnAdjustment(offerLevelSmoothedSatisfaction: number): number {
  return clamp((50 - offerLevelSmoothedSatisfaction) / 50, -1, 1) * MAX_SATISFACTION_CHURN_SWING;
}
