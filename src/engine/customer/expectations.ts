import type { CustomerSegment } from "../../types/customerSegment.js";
import type { Offer, OfferPositioning } from "../../types/offer.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Points d'attente ajoutés par 100% de prime de prix, modulés par la sensibilité prix du segment (spec M11.2.3 §3). */
const PRICE_PREMIUM_EXPECTATION_SCALE = 20;
/** Une offre positionnée premium promet plus, même à qualité/prix égaux — élève la barre (spec §3). */
const POSITIONING_EXPECTATION_BONUS: Readonly<Record<OfferPositioning, number>> = {
  economy: -5,
  standard: 0,
  premium: 10,
};
/** Une entreprise réputée est déjà perçue comme une promesse de qualité (spec §3). */
const REPUTATION_EXPECTATION_WEIGHT = 15;

/**
 * Attentes d'un segment envers une offre (spec M11.2.3 §3) : exigence de
 * base du segment + prime de prix + positionnement + réputation/promesse.
 * Jamais réduit à `expectation = segment.qualityExpectation` — 4 facteurs
 * minimum, chacun testable indépendamment. Pure, déterministe.
 */
export function computeSegmentExpectation(offer: Offer, segment: CustomerSegment, reputationScore: number): number {
  const priceRatio = offer.price / segment.referencePrice;
  const pricePremiumEffect = Math.max(0, priceRatio - 1) * PRICE_PREMIUM_EXPECTATION_SCALE * (0.5 + segment.priceSensitivity);
  const positioningEffect = POSITIONING_EXPECTATION_BONUS[offer.positioning];
  const reputationEffect = clamp(reputationScore, 0, 1) * REPUTATION_EXPECTATION_WEIGHT;

  return clamp(segment.qualityExpectation + pricePremiumEffect + positioningEffect + reputationEffect, 0, 100);
}
