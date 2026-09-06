import type { Rng } from "../rng/rng.js";
import { clamp } from "../util/math.js";
import type { AggregateCompetition } from "../../types/competition.js";
import type { Market, MarketInefficiency } from "../../types/market.js";
import type { MacroState } from "../../types/world.js";

/**
 * Fait croître le marché d'un mois, en composant sa croissance structurelle
 * propre avec le cycle macroéconomique (spec §16 : le monde évolue même sans
 * action du joueur). `market.cyclicality` module l'exposition de ce marché
 * précis au cycle (0 = insensible, 1 = pleinement exposé).
 */
export function advanceMarket(market: Market, macro: MacroState, rng: Rng): Market {
  const monthlyGdpGrowth = macro.gdpGrowthRateAnnual / 12;
  const cycleEffect = monthlyGdpGrowth * market.cyclicality;
  const noise = rng.fork(`market:${market.id}:size`).nextGaussian(0, 0.005);
  const effectiveGrowth = market.growthRateMonthly + cycleEffect + noise;

  return {
    ...market,
    sizeMonthlyRevenuePotential: Math.max(
      0,
      market.sizeMonthlyRevenuePotential * (1 + effectiveGrowth),
    ),
  };
}

const OPPORTUNITY_THRESHOLD = 0.15;

/**
 * Détecte une inefficience exploitable (spec §5) : un marché est
 * structurellement attractif (marge, faibles barrières) mais sous-exploité
 * par la concurrence de fond actuelle. Retourne `null` si rien de notable.
 */
export function detectMarketInefficiency(
  market: Market,
  competition: AggregateCompetition,
): MarketInefficiency | null {
  const underservedShare = 1 - competition.totalCapturedRevenueShare;
  const structuralAttractiveness =
    market.averageMargin * (1 - market.competitiveIntensity) * (1 - market.entryBarriers);
  const opportunityScore = clamp(underservedShare * structuralAttractiveness, 0, 1);

  if (opportunityScore < OPPORTUNITY_THRESHOLD) {
    return null;
  }
  return { marketId: market.id, opportunityScore };
}
