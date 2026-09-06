import type { Rng } from "../rng/rng.js";
import { clamp } from "../util/math.js";
import type { Estimate, MarketEstimate } from "../../types/intelligence.js";
import type { Market } from "../../types/market.js";

/**
 * Incertitude relative minimale (spec §3.5, §9) : même à compétence
 * maximale, l'estimation du joueur garde une marge d'erreur non nulle.
 */
const MIN_RELATIVE_NOISE = 0.03;
/** Incertitude relative à compétence nulle (18 ans, aucune expérience). */
const MAX_RELATIVE_NOISE = 0.5;

/** Compétences (0-100) qui améliorent la qualité de l'information (spec §3.7). */
export interface IntelligenceSkills {
  readonly finance: number;
  readonly strategie: number;
}

function relativeNoiseFor(skillAverage0To100: number): number {
  const skillFactor = clamp(skillAverage0To100 / 100, 0, 1);
  return MAX_RELATIVE_NOISE - skillFactor * (MAX_RELATIVE_NOISE - MIN_RELATIVE_NOISE);
}

function estimate(trueValue: number, skillAverage0To100: number, rng: Rng): Estimate {
  const stdDev = Math.abs(trueValue) * relativeNoiseFor(skillAverage0To100);
  const noisyValue = trueValue + rng.nextGaussian(0, stdDev);
  return { value: noisyValue, uncertainty: stdDev };
}

/**
 * Projette la vérité d'un marché (`Truth`) vers ce que le joueur en perçoit
 * (`PlayerView`), avec un bruit déterministe fonction du seed et des
 * compétences (spec §9). Deux appels avec le même `rng` (même seed dérivée)
 * et les mêmes compétences donnent exactement la même estimation.
 */
export function projectMarketView(
  market: Market,
  skills: IntelligenceSkills,
  rng: Rng,
): MarketEstimate {
  const skillAverage = (skills.finance + skills.strategie) / 2;
  const marketRng = rng.fork(`intelligence:market:${market.id}`);

  return {
    marketId: market.id,
    sizeMonthlyRevenuePotential: estimate(
      market.sizeMonthlyRevenuePotential,
      skillAverage,
      marketRng.fork("size"),
    ),
    growthRateMonthly: estimate(market.growthRateMonthly, skillAverage, marketRng.fork("growth")),
    competitiveIntensity: estimate(
      market.competitiveIntensity,
      skillAverage,
      marketRng.fork("competition"),
    ),
  };
}
