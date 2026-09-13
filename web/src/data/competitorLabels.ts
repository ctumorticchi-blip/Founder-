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
