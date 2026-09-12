/**
 * Signal public qualitatif de satisfaction (spec M11.2.3 §4) — jamais un
 * score brut affiché au joueur.
 */
export type SatisfactionLevel = "very-positive" | "positive" | "mixed" | "negative" | "very-negative";

/** Tendance de fidélité pour l'UX (spec §15 : "Fidélité : En progression"). */
export type FidelityTrend = "improving" | "stable" | "declining";

/**
 * Diagnostic causal (spec §5) : calculé DEPUIS les grandeurs internes du
 * moteur (attentes, expérience délivrée, pénalité opérationnelle, prix
 * relatif), jamais déduit après coup par l'UI à partir du seul score.
 */
export interface SatisfactionDiagnosis {
  readonly highExpectations: boolean;
  readonly greatValueForMoney: boolean;
  readonly qualityAboveExpectations: boolean;
  readonly operationsUnderStrain: boolean;
  readonly experienceBelowPromise: boolean;
}

/** Résultat complet de satisfaction pour un segment donné (spec §5). */
export interface SatisfactionResult {
  /** 0-100, précision interne — jamais affiché tel quel (spec §4). */
  readonly score: number;
  readonly level: SatisfactionLevel;
  readonly diagnosis: SatisfactionDiagnosis;
}

/**
 * Mémoire persistante d'un segment pour une offre (spec §6). Les
 * grandeurs de "volume" sont dans l'unité native de la famille (heures,
 * couverts, unités, mandats, abonnés) — PAS un décompte de personnes
 * physiques (limite assumée, spec §8 : un même client peut par exemple
 * acheter plusieurs heures de service dans le même mois).
 */
export interface SegmentCustomerMemory {
  readonly segmentId: string;
  readonly segmentLabel: string;
  /** Base récurrente estimée, lissée (EWMA) — jamais remise à zéro par un seul mauvais mois (spec §8). */
  readonly retainedBaseVolume: number;
  readonly newVolumeThisMonth: number;
  readonly retainedVolumeThisMonth: number;
  /** Cumul indicatif de volume nouveau, jamais réinitialisé (spec §6, "clients déjà acquis"). */
  readonly cumulativeAcquiredVolume: number;
  /** `null` si aucune vente ce mois-ci pour ce segment (pas de mesure possible). */
  readonly lastSatisfactionScore: number | null;
  /** Lissée (EWMA) — porte l'inertie de réputation/rétention (spec §8, §9). */
  readonly smoothedSatisfactionScore: number;
  readonly lastDiagnosis: SatisfactionDiagnosis | null;
  readonly consecutiveGoodMonths: number;
  readonly consecutiveBadMonths: number;
  /** `null` tant qu'aucune vente n'a jamais eu lieu pour ce segment. */
  readonly monthsSinceFirstSale: number | null;
}
