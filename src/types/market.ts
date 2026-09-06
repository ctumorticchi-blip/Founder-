import type { EconomicFamily } from "./business.js";

/**
 * Marché (spec §5). Tous les champs sont numériques/normalisés — jamais de
 * texte libre — pour rester simulables par le moteur.
 */
export interface Market {
  readonly id: string;
  readonly family: EconomicFamily;
  /** Potentiel de revenu mensuel total adressable sur ce marché. */
  readonly sizeMonthlyRevenuePotential: number;
  /** Croissance mensuelle structurelle du marché (ex. 0.01 = 1%/mois). */
  readonly growthRateMonthly: number;
  /** Marge brute moyenne observée sur ce marché, 0-1. */
  readonly averageMargin: number;
  /** Fragmentation du marché, 0-1 (1 = très fragmenté, beaucoup de petits acteurs). */
  readonly fragmentation: number;
  /** Intensité concurrentielle, 0-1. */
  readonly competitiveIntensity: number;
  /** Intensité capitalistique, 0-1 (capital nécessaire pour opérer). */
  readonly capitalIntensity: number;
  /** Niveau de réglementation/barrières administratives, 0-1. */
  readonly regulation: number;
  /** Rythme d'innovation du secteur, 0-1. */
  readonly innovationRate: number;
  /** Sensibilité des clients au prix, 0-1. */
  readonly priceSensitivity: number;
  /** Barrières à l'entrée hors réglementation (capital, réseau, marque...), 0-1. */
  readonly entryBarriers: number;
  /** Sensibilité du marché au cycle macroéconomique, 0-1. */
  readonly cyclicality: number;
}

/**
 * Inefficience détectée sur un marché (spec §5) : un écart exploitable
 * entre l'attractivité structurelle du marché et la pression concurrentielle
 * qui s'y exerce réellement.
 */
export interface MarketInefficiency {
  readonly marketId: string;
  /** Score d'opportunité, 0-1 : plus haut = inefficience plus marquée. */
  readonly opportunityScore: number;
}
