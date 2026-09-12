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
  /** Demande récurrente calculée ce mois-ci par `computeRepeatDemand`, AVANT allocation de capacité (spec M11.2.3.1 §2). */
  readonly repeatDemandThisMonth: number;
  /** Part de `repeatDemandThisMonth` non servie faute de capacité (spec M11.2.3.1 §3-4) — jamais assimilée à une mauvaise expérience. */
  readonly unservedRepeatDemandThisMonth: number;
  /** Frustration de disponibilité lissée (EWMA), 0-1 — distincte de la satisfaction (spec M11.2.3.1 §5). */
  readonly availabilityFrustration: number;
}

/**
 * Grandeurs nécessaires à `updateSegmentMemory` (spec M11.2.3.1 §7) : des
 * FLUX RÉELS (nouveaux/récurrents effectivement servis), jamais un volume
 * agrégé à reclasser après coup — cette reclassification était le défaut
 * architectural corrigé par M11.2.3.1 (spec §0).
 */
export interface SegmentMemoryUpdateInput {
  readonly segmentId: string;
  readonly segmentLabel: string;
  /** Nouveaux clients EFFECTIVEMENT SERVIS ce mois-ci (flux réel, spec §9). */
  readonly newVolumeThisMonth: number;
  /** Clients récurrents EFFECTIVEMENT SERVIS ce mois-ci (flux réel, spec §9). */
  readonly retainedVolumeThisMonth: number;
  /** Demande récurrente calculée ce mois-ci (spec §5), avant capacité. `0` si aucune mémoire préalable ou famille sans mécanique de repeat demand (ex. Subscription, spec §12). */
  readonly repeatDemandThisMonth: number;
  /** Part de `repeatDemandThisMonth` refusée faute de capacité (spec §4). */
  readonly unservedRepeatDemandThisMonth: number;
  /** `null` si aucune vente servie ce mois-ci pour ce segment (aucune mesure de satisfaction possible). */
  readonly satisfactionThisMonth: number | null;
  readonly diagnosisThisMonth: SatisfactionDiagnosis | null;
}
