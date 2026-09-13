import type { CompetitivePositionLevel, MarketShareLevel } from "@founder/engine";

/**
 * Vocabulaire métier des paliers qualitatifs de `projectCompetitorView`
 * (spec M11.2.5 §5) — jamais le score brut (`qualityLevel`/part de marché)
 * affiché au joueur.
 */
const POSITION_LABELS: Readonly<Record<CompetitivePositionLevel, string>> = {
  economy: "Positionnement économique",
  standard: "Positionnement standard",
  premium: "Positionnement premium",
};

export function competitivePositionLabel(level: CompetitivePositionLevel): string {
  return POSITION_LABELS[level];
}

const SHARE_LABELS: Readonly<Record<MarketShareLevel, string>> = {
  low: "Part de marché faible",
  moderate: "Part de marché modérée",
  high: "Part de marché élevée",
};

export function marketShareLevelLabel(level: MarketShareLevel): string {
  return SHARE_LABELS[level];
}

/**
 * Traduction qualitative de l'intensité concurrentielle d'un marché
 * (0-1, spec M11.2.6.1 §3) — une fourchette de pourcentage serait
 * illisible pour le joueur, contrairement au potentiel/à la croissance
 * (des grandeurs monétaires/de taux qu'une fourchette exprime bien).
 */
export function competitiveIntensityLabel(value: number): string {
  if (value < 0.35) return "Faible";
  if (value < 0.65) return "Modérée";
  return "Élevée";
}
