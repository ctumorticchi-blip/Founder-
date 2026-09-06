/**
 * Concurrence de fond agrégée sur un marché (spec §17, niveau 1 : "entreprises
 * de fond agrégées"). Ne modélise pas d'acteurs individuels, seulement une
 * part de marché déjà captée et un niveau de qualité moyen.
 */
export interface AggregateCompetition {
  readonly marketId: string;
  /** Part du potentiel de marché déjà captée par la concurrence de fond, 0-1. */
  readonly totalCapturedRevenueShare: number;
  /** Qualité/efficacité moyenne de la concurrence de fond, 0-1. */
  readonly averageQuality: number;
}

/**
 * Concurrent identifié (spec §17, niveau 2). Le niveau 3 ("entrepreneurs
 * majeurs persistants") est hors périmètre P0 : le champ `tier` prévoit
 * l'extension mais aucune logique de simulation "major" n'existe encore.
 */
export type CompetitorTier = "identified" | "major";

export interface Competitor {
  readonly id: string;
  readonly name: string;
  readonly marketId: string;
  readonly tier: CompetitorTier;
  /** Force globale du concurrent, 0-1 (taille, capacités, ressources). */
  readonly strength: number;
}
