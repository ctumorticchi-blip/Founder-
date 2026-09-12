import { monthsBetween } from "../time/clock.js";
import type { CustomerSegment } from "../../types/customerSegment.js";
import type {
  DemandFunnelResult,
  DemandSignal,
  FitBreakdown,
  PriceSignal,
  SegmentDemandContribution,
  VisibilityLevel,
} from "../../types/demand.js";
import type { GameDate } from "../time/clock.js";
import type { Market } from "../../types/market.js";
import type { Offer, OfferPositioning } from "../../types/offer.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const POSITIONING_INDEX: Readonly<Record<OfferPositioning, number>> = {
  economy: 0,
  standard: 1,
  premium: 2,
};

/** Pénalité par cran d'écart de positionnement (spec §3) — volontairement simple. */
const POSITIONING_PENALTY_PER_STEP = 0.6;
/** Amortisseur de l'effet de la réputation sur la confiance (spec §3) : la réputation
 * pèse surtout sur la visibilité (§7), pas sur l'adéquation de l'offre elle-même. */
const TRUST_REPUTATION_DAMPING = 0.1;
/** Avantage du ciblage principal, jamais une exclusivité (spec §2) : un segment non
 * ciblé reste toujours atteignable, seulement moins favorisé. */
const NON_PRIMARY_TARGET_FACTOR = 0.9;

/**
 * Adéquation offre/segment (spec M11.2.2 §3) : 4 composantes indépendantes et
 * testables, jamais réduites à un score opaque avant la fin. Pure, sans aléa.
 */
export function computeSegmentFit(
  offer: Offer,
  segment: CustomerSegment,
  reputationScore: number,
  isPrimaryTarget: boolean,
): FitBreakdown {
  const priceFit =
    offer.price <= segment.referencePrice
      ? 1
      : clamp(1 - ((offer.price - segment.referencePrice) / segment.referencePrice) * segment.priceSensitivity, 0, 1);

  const qualityFit = clamp(offer.qualityLevel / segment.qualityExpectation, 0, 1);

  const positioningDistance = Math.abs(POSITIONING_INDEX[offer.positioning] - POSITIONING_INDEX[segment.preferredPositioning]);
  const positioningFit = clamp(1 - positioningDistance * POSITIONING_PENALTY_PER_STEP, 0, 1);

  const trustFit = clamp(1 - segment.trustImportance * (1 - clamp(reputationScore, 0, 1)) * TRUST_REPUTATION_DAMPING, 0, 1);

  const priceWeight = 1 + segment.priceSensitivity;
  const qualityWeight = 1;
  const positioningWeight = 1;
  const trustWeight = 1 + segment.trustImportance;
  const totalWeight = priceWeight + qualityWeight + positioningWeight + trustWeight;

  const base =
    (priceFit * priceWeight + qualityFit * qualityWeight + positioningFit * positioningWeight + trustFit * trustWeight) /
    totalWeight;
  const overallFit = clamp(isPrimaryTarget ? base : base * NON_PRIMARY_TARGET_FACTOR, 0, 1);

  return { priceFit, qualityFit, positioningFit, trustFit, overallFit };
}

/** Taux de conversion "intéressé -> demande" (spec §6, exemple conceptuel ~0.65). */
const INTERESTED_TO_DEMAND_RATE = 0.65;

const VISIBILITY_BASELINE = 0.1;
const VISIBILITY_PROSPECTION_WEIGHT = 0.5;
const VISIBILITY_REPUTATION_WEIGHT = 0.4;
const MAX_USEFUL_PROSPECTION_HOURS = 160;
/** Poids du bouche-à-oreille organique dans la visibilité (spec M11.2.3 §6.2) — un facteur d'appoint, jamais dominant. */
const VISIBILITY_WORD_OF_MOUTH_WEIGHT = 0.3;

function computeVisibilityFactor(prospectionHours: number, reputationScore: number, organicWordOfMouth: number): number {
  const prospectionRatio = clamp(prospectionHours, 0, MAX_USEFUL_PROSPECTION_HOURS) / MAX_USEFUL_PROSPECTION_HOURS;
  return clamp(
    VISIBILITY_BASELINE +
      VISIBILITY_PROSPECTION_WEIGHT * prospectionRatio +
      VISIBILITY_REPUTATION_WEIGHT * clamp(reputationScore, 0, 1) +
      VISIBILITY_WORD_OF_MOUTH_WEIGHT * clamp(organicWordOfMouth, 0, 1),
    0,
    1,
  );
}

function bucketVisibility(factor: number): VisibilityLevel {
  if (factor < 0.4) return "low";
  if (factor < 0.75) return "medium";
  return "high";
}

function bucketPriceSignal(offerPrice: number, weightedAverageReferencePrice: number): PriceSignal {
  if (weightedAverageReferencePrice <= 0) return "fair";
  const ratio = offerPrice / weightedAverageReferencePrice;
  if (ratio < 0.85) return "low";
  if (ratio <= 1.3) return "fair";
  return "high";
}

function bucketDemandSignal(demand: number, availableMarket: number): DemandSignal {
  if (availableMarket <= 0) return "weak";
  const captureRate = demand / availableMarket;
  if (captureRate < 0.05) return "weak";
  if (captureRate < 0.15) return "moderate";
  return "strong";
}

export interface ComputeOfferDemandParams {
  /** Part de la demande captable par CETTE entreprise face à la concurrence (spec §8, réutilise `availableDemandShare`). */
  readonly demandShare: number;
  readonly reputationScore: number;
  readonly prospectionHours: number;
  readonly date: GameDate;
  /**
   * Bouche-à-oreille organique (spec M11.2.3 §6.2, §10) — optionnel,
   * défaut `0` : tout appel omettant ce paramètre produit un résultat
   * strictement identique à M11.2.2 (non-régressif par construction).
   */
  readonly organicWordOfMouth?: number;
}

/**
 * Entonnoir de demande d'une offre pour un mois (spec M11.2.2 §4-§7) :
 * marché disponible -> exposition -> intérêt -> demande, agrégé sur tous
 * les segments d'une famille. `capacity`/`sales`/`lostToCapacity` ne sont
 * PAS calculés ici : ils dépendent du moteur économique de la famille
 * (spec §6.1) et sont ajoutés par `businessResolution.ts`.
 */
export function computeOfferDemand(
  offer: Offer,
  market: Market,
  segments: readonly CustomerSegment[],
  params: ComputeOfferDemandParams,
): Omit<DemandFunnelResult, "capacity" | "sales" | "lostToCapacity"> {
  const monthsActive = monthsBetween(offer.createdAt, params.date);
  const monthOfYearIndex = params.date.month - 1;
  const visibilityFactor = computeVisibilityFactor(params.prospectionHours, params.reputationScore, params.organicWordOfMouth ?? 0);

  // Prix "normal" moyen du marché, pondéré par la taille catalogue des segments — stable
  // dans le mois (n'inclut ni la dérive structurelle ni la saisonnalité) et surtout
  // INDÉPENDANT du prix de CETTE offre : sert de convertisseur monétaire -> unités natives
  // pour que `reached` mesure l'exposition (visibilité), jamais un effet du prix affiché.
  let referencePriceWeightSum = 0;
  let referencePriceWeighted = 0;
  for (const segment of segments) {
    referencePriceWeighted += segment.referencePrice * segment.relativeSize;
    referencePriceWeightSum += segment.relativeSize;
  }
  const marketReferencePrice = referencePriceWeightSum > 0 ? referencePriceWeighted / referencePriceWeightSum : offer.price;

  let availableMarket = 0;
  let reached = 0;
  let interested = 0;
  let demand = 0;

  let topSegment: CustomerSegment = segments[0]!;
  let topSegmentInterest = -Infinity;

  const bySegment: SegmentDemandContribution[] = [];

  const fitWeightSum = { total: 0 };
  const fitAccumulator = { priceFit: 0, qualityFit: 0, positioningFit: 0, trustFit: 0, overallFit: 0 };
  const equalWeightAccumulator = { priceFit: 0, qualityFit: 0, positioningFit: 0, trustFit: 0, overallFit: 0 };

  for (const segment of segments) {
    const effectiveRelativeSize = clamp(segment.relativeSize * (1 + segment.structuralTrend * monthsActive), 0, 1);
    const seasonalMultiplier = segment.seasonality[monthOfYearIndex] ?? 1;

    const segmentAvailable = (market.sizeMonthlyRevenuePotential * effectiveRelativeSize * seasonalMultiplier) / marketReferencePrice;
    const segmentReached = segmentAvailable * visibilityFactor;

    const isPrimaryTarget = offer.targetSegment.length > 0 && segment.id === offer.targetSegment;
    const fit = computeSegmentFit(offer, segment, params.reputationScore, isPrimaryTarget);

    const segmentInterested = segmentReached * fit.overallFit;
    const segmentDemand = segmentInterested * INTERESTED_TO_DEMAND_RATE * params.demandShare;

    availableMarket += segmentAvailable;
    reached += segmentReached;
    interested += segmentInterested;
    demand += segmentDemand;

    bySegment.push({ segmentId: segment.id, segmentLabel: segment.label, demand: segmentDemand, fit });

    fitAccumulator.priceFit += fit.priceFit * segmentInterested;
    fitAccumulator.qualityFit += fit.qualityFit * segmentInterested;
    fitAccumulator.positioningFit += fit.positioningFit * segmentInterested;
    fitAccumulator.trustFit += fit.trustFit * segmentInterested;
    fitAccumulator.overallFit += fit.overallFit * segmentInterested;
    fitWeightSum.total += segmentInterested;

    equalWeightAccumulator.priceFit += fit.priceFit;
    equalWeightAccumulator.qualityFit += fit.qualityFit;
    equalWeightAccumulator.positioningFit += fit.positioningFit;
    equalWeightAccumulator.trustFit += fit.trustFit;
    equalWeightAccumulator.overallFit += fit.overallFit;

    if (segmentInterested > topSegmentInterest) {
      topSegmentInterest = segmentInterested;
      topSegment = segment;
    }
  }

  const segmentCount = segments.length || 1;
  const fit: FitBreakdown =
    fitWeightSum.total > 0
      ? {
          priceFit: fitAccumulator.priceFit / fitWeightSum.total,
          qualityFit: fitAccumulator.qualityFit / fitWeightSum.total,
          positioningFit: fitAccumulator.positioningFit / fitWeightSum.total,
          trustFit: fitAccumulator.trustFit / fitWeightSum.total,
          overallFit: fitAccumulator.overallFit / fitWeightSum.total,
        }
      : {
          priceFit: equalWeightAccumulator.priceFit / segmentCount,
          qualityFit: equalWeightAccumulator.qualityFit / segmentCount,
          positioningFit: equalWeightAccumulator.positioningFit / segmentCount,
          trustFit: equalWeightAccumulator.trustFit / segmentCount,
          overallFit: equalWeightAccumulator.overallFit / segmentCount,
        };

  return {
    availableMarket,
    reached,
    interested,
    demand,
    topSegmentId: topSegment.id,
    topSegmentLabel: topSegment.label,
    fit,
    visibilityLevel: bucketVisibility(visibilityFactor),
    priceSignal: bucketPriceSignal(offer.price, marketReferencePrice),
    demandSignal: bucketDemandSignal(demand, availableMarket),
    bySegment,
  };
}
