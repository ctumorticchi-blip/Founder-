import type { Rng } from "../rng/rng.js";
import { clamp } from "../util/math.js";
import type { AggregateCompetition } from "../../types/competition.js";
import type { Market } from "../../types/market.js";

const MAX_CAPTURED_SHARE = 0.95;

/**
 * Crée la concurrence de fond initiale d'un marché (spec §17, niveau 1).
 * Tirage seedé pour une part de marché déjà captée et une qualité moyenne
 * plausibles, sans figer une valeur unique identique sur tous les marchés.
 */
export function createAggregateCompetition(marketId: string, rng: Rng): AggregateCompetition {
  const competitionRng = rng.fork(`competition:${marketId}`);
  return {
    marketId,
    totalCapturedRevenueShare: competitionRng.nextFloat(0.3, 0.7),
    averageQuality: competitionRng.nextFloat(0.3, 0.7),
  };
}

/**
 * Fait évoluer la concurrence de fond d'un mois. Plus un marché est
 * concurrentiel, plus la part captée par la concurrence de fond tend à
 * augmenter (spec §5 : `competitiveIntensity`).
 */
export function advanceAggregateCompetition(
  competition: AggregateCompetition,
  market: Market,
  rng: Rng,
): AggregateCompetition {
  const driftRng = rng.fork(`competition:${competition.marketId}:drift`);
  const drift = driftRng.nextGaussian(market.competitiveIntensity * 0.005, 0.01);
  const totalCapturedRevenueShare = clamp(
    competition.totalCapturedRevenueShare + drift,
    0,
    MAX_CAPTURED_SHARE,
  );
  return { ...competition, totalCapturedRevenueShare };
}

/** Part du marché encore disponible pour le joueur et les concurrents identifiés. */
export function availableDemandShare(competition: AggregateCompetition): number {
  return 1 - competition.totalCapturedRevenueShare;
}
