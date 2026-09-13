import type { Rng } from "../rng/rng.js";
import { clamp } from "../util/math.js";
import type {
  CompetitivePositionLevel,
  CompetitorView,
  Estimate,
  MarketEstimate,
  MarketShareLevel,
  SegmentAvailabilityEstimate,
} from "../../types/intelligence.js";
import type { Market } from "../../types/market.js";
import type { Competitor } from "../../types/competition.js";
import type { SegmentAvailability } from "../../types/demand.js";

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

export function estimate(trueValue: number, skillAverage0To100: number, rng: Rng): Estimate {
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

const POSITION_ECONOMY_MAX = 0.4;
const POSITION_STANDARD_MAX = 0.7;

function bucketCompetitivePosition(noisyQualityLevel: number): CompetitivePositionLevel {
  if (noisyQualityLevel < POSITION_ECONOMY_MAX) return "economy";
  if (noisyQualityLevel < POSITION_STANDARD_MAX) return "standard";
  return "premium";
}

const SHARE_LOW_MAX = 0.1;
const SHARE_MODERATE_MAX = 0.25;

function bucketMarketShare(noisyMarketShare: number): MarketShareLevel {
  if (noisyMarketShare < SHARE_LOW_MAX) return "low";
  if (noisyMarketShare < SHARE_MODERATE_MAX) return "moderate";
  return "high";
}

/**
 * Projette un concurrent identifié (`Competitor`) vers ce que le joueur en
 * perçoit (spec M11.2.5 §5) : `qualityLevel`/`marketShare` passent par
 * `estimate()` (bruit jamais nul) avant d'être bucketés en paliers
 * qualitatifs — jamais un score brut affiché. Le nom n'est jamais bruité.
 */
export function projectCompetitorView(
  competitor: Competitor,
  marketShare: number,
  skillAverage0To100: number,
  rng: Rng,
): CompetitorView {
  const competitorRng = rng.fork(`intelligence:competitor:${competitor.id}`);
  const noisyQuality = estimate(competitor.qualityLevel, skillAverage0To100, competitorRng.fork("quality"));
  const noisyShare = estimate(marketShare, skillAverage0To100, competitorRng.fork("share"));
  return {
    id: competitor.id,
    name: competitor.name,
    positionLevel: bucketCompetitivePosition(noisyQuality.value),
    shareLevel: bucketMarketShare(noisyShare.value),
  };
}

/**
 * Projette la disponibilité de chaque segment (`computeSegmentAvailability`,
 * `engine/market/demand.ts`) vers ce que le joueur en perçoit (spec
 * M11.2.6.2 §2) : `availableMarket` passe par `estimate()` (bruit jamais
 * nul), le segment lui-même n'est jamais bruité.
 */
export function projectSegmentAvailabilityView(
  availability: readonly SegmentAvailability[],
  skillAverage0To100: number,
  rng: Rng,
): readonly SegmentAvailabilityEstimate[] {
  return availability.map((segment) => ({
    segmentId: segment.segmentId,
    segmentLabel: segment.segmentLabel,
    availableMarket: estimate(segment.availableMarket, skillAverage0To100, rng.fork(`segment:${segment.segmentId}`)),
  }));
}
