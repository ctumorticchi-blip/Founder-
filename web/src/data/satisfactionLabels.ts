import {
  bucketSatisfactionLevel,
  computeWordOfMouth,
  wordOfMouthReferenceVolume,
  type EconomicFamily,
  type FidelityTrend,
  type SatisfactionDiagnosis,
  type SatisfactionLevel,
  type SegmentCustomerMemory,
} from "@founder/engine";

/**
 * Vocabulaire métier de la satisfaction client (spec M11.2.3 §4, §15) : le
 * moteur ne renvoie jamais de score brut ni de coefficient interne à
 * l'écran, seulement des signaux qualitatifs déjà catégorisés
 * (`SatisfactionLevel`, `SatisfactionDiagnosis`). Donnée pure, même statut
 * que `offerModels.ts` — aucune logique économique ici.
 */
const SATISFACTION_LEVEL_LABELS: Readonly<Record<SatisfactionLevel, string>> = {
  "very-positive": "Très satisfaits",
  positive: "Satisfaits",
  mixed: "Mitigés",
  negative: "Déçus",
  "very-negative": "Très déçus",
};

export function satisfactionLevelLabel(level: SatisfactionLevel): string {
  return SATISFACTION_LEVEL_LABELS[level];
}

const FIDELITY_TREND_LABELS: Readonly<Record<FidelityTrend, string>> = {
  improving: "En progression",
  stable: "Stable",
  declining: "En recul",
};

export function fidelityTrendLabel(trend: FidelityTrend): string {
  return FIDELITY_TREND_LABELS[trend];
}

/**
 * Tendance de fidélité affichable (spec §15), dérivée des compteurs de mois
 * consécutifs déjà tenus par le moteur (`consecutiveGoodMonths`/
 * `consecutiveBadMonths`, spec §8) — une simple catégorisation d'affichage,
 * jamais un nouveau calcul économique côté web.
 */
export function fidelityTrendFromMemory(memory: SegmentCustomerMemory): FidelityTrend {
  if (memory.consecutiveGoodMonths >= 2) return "improving";
  if (memory.consecutiveBadMonths >= 2) return "declining";
  return "stable";
}

/**
 * Phrases causales du diagnostic (spec §5, §15 : "✓ Qualité supérieure aux
 * attentes", "⚠ Équipe proche de la saturation"). Chaque phrase vient d'un
 * booléen déjà calculé par le moteur — jamais reconstruite après coup depuis
 * le seul score.
 */
const DIAGNOSIS_LABELS: Readonly<{
  readonly [K in keyof SatisfactionDiagnosis]: { readonly positive: boolean; readonly label: string };
}> = {
  highExpectations: { positive: false, label: "Attentes très élevées" },
  greatValueForMoney: { positive: true, label: "Bon rapport qualité/prix" },
  qualityAboveExpectations: { positive: true, label: "Qualité supérieure aux attentes" },
  operationsUnderStrain: { positive: false, label: "Équipe proche de la saturation" },
  experienceBelowPromise: { positive: false, label: "Expérience en-dessous de la promesse" },
};

export interface DiagnosisLine {
  readonly key: keyof SatisfactionDiagnosis;
  readonly label: string;
  readonly positive: boolean;
}

/** Ne retient que les diagnostics actifs (`true`) — jamais une liste exhaustive de non-événements. */
export function activeDiagnosisLines(diagnosis: SatisfactionDiagnosis): readonly DiagnosisLine[] {
  return (Object.keys(DIAGNOSIS_LABELS) as (keyof SatisfactionDiagnosis)[])
    .filter((key) => diagnosis[key])
    .map((key) => ({ key, label: DIAGNOSIS_LABELS[key].label, positive: DIAGNOSIS_LABELS[key].positive }));
}

/**
 * Résumé agrégé "Clients" d'une offre (spec §15, exemple : "Nouveaux ce
 * mois-ci : 38 / Clients récurrents : 21 / Satisfaction : Très bonne /
 * Fidélité : En progression"). `null` tant qu'aucun segment n'a encore de
 * vente réelle (`monthsSinceFirstSale === null` partout) — pas d'affichage
 * avant que la donnée soit suffisante (spec §15).
 */
export interface CustomerSummary {
  readonly newThisMonth: number;
  readonly recurrentThisMonth: number;
  readonly unservedThisMonth: number;
  readonly satisfactionLevel: SatisfactionLevel;
  readonly fidelityTrend: FidelityTrend;
}

export function summarizeCustomerMemory(memories: readonly SegmentCustomerMemory[]): CustomerSummary | null {
  const withHistory = memories.filter((m) => m.monthsSinceFirstSale !== null);
  if (withHistory.length === 0) return null;

  const newThisMonth = memories.reduce((sum, m) => sum + m.newVolumeThisMonth, 0);
  const recurrentThisMonth = memories.reduce((sum, m) => sum + m.retainedVolumeThisMonth, 0);
  const unservedThisMonth = memories.reduce((sum, m) => sum + m.unservedRepeatDemandThisMonth, 0);

  const totalVolume = memories.reduce((sum, m) => sum + m.retainedBaseVolume, 0);
  const weightedScore =
    totalVolume > 0
      ? memories.reduce((sum, m) => sum + m.smoothedSatisfactionScore * m.retainedBaseVolume, 0) / totalVolume
      : memories.reduce((sum, m) => sum + m.smoothedSatisfactionScore, 0) / memories.length;

  const totalGoodMonths = memories.reduce((sum, m) => sum + m.consecutiveGoodMonths, 0);
  const totalBadMonths = memories.reduce((sum, m) => sum + m.consecutiveBadMonths, 0);
  const fidelityTrend: FidelityTrend =
    totalGoodMonths >= 2 && totalGoodMonths > totalBadMonths
      ? "improving"
      : totalBadMonths >= 2 && totalBadMonths > totalGoodMonths
        ? "declining"
        : "stable";

  return {
    newThisMonth,
    recurrentThisMonth,
    unservedThisMonth,
    satisfactionLevel: bucketSatisfactionLevel(weightedScore),
    fidelityTrend,
  };
}

/**
 * Intensité affichable du bouche-à-oreille (spec §10, §15) : le moteur
 * renvoie un facteur d'appoint continu (`computeWordOfMouth`, borné à 0.25
 * — spec §10) jamais montré tel quel (ce serait un coefficient interne) —
 * seulement catégorisé en 3 paliers, à l'image de `demandSignalLabel`.
 */
const WORD_OF_MOUTH_STRONG_THRESHOLD = 0.15;
const WORD_OF_MOUTH_MODERATE_THRESHOLD = 0.05;

function wordOfMouthIntensityLabel(wordOfMouth: number): string {
  if (wordOfMouth >= WORD_OF_MOUTH_STRONG_THRESHOLD) return "Fort";
  if (wordOfMouth >= WORD_OF_MOUTH_MODERATE_THRESHOLD) return "Modéré";
  return "Faible";
}

/**
 * Calcule le bouche-à-oreille d'une offre EXACTEMENT comme le moteur (même
 * fonction, même volume de référence par famille — `wordOfMouthReferenceVolume`)
 * à partir de la mémoire client déjà persistée, pour un affichage honnête
 * sans dupliquer ni réinventer le calibrage interne.
 */
export function computeOfferWordOfMouth(
  memories: readonly SegmentCustomerMemory[],
  family: EconomicFamily,
  activeSubscribers?: number,
): number {
  const totalVolume = memories.reduce((sum, m) => sum + m.retainedBaseVolume, 0);
  const weightedScore =
    totalVolume > 0 ? memories.reduce((sum, m) => sum + m.smoothedSatisfactionScore * m.retainedBaseVolume, 0) / totalVolume : 50;
  return computeWordOfMouth(weightedScore, totalVolume, wordOfMouthReferenceVolume(family, activeSubscribers));
}

/** Phrase complète "Faible mais en hausse" (spec §15) : intensité + tendance de fidélité comme direction. */
export function wordOfMouthDescription(wordOfMouth: number, trend: FidelityTrend): string {
  const intensity = wordOfMouthIntensityLabel(wordOfMouth);
  if (trend === "improving") return `${intensity} mais en hausse`;
  if (trend === "declining") return `${intensity} et en baisse`;
  return intensity;
}
