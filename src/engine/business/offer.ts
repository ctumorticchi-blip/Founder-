import type { GameDate } from "../time/clock.js";
import { clamp } from "../util/math.js";
import type { Offer, OfferBusinessModel, OfferCreateSpec, OfferPositioning } from "../../types/offer.js";

/**
 * Coefficients de progression du développement d'une offre (spec M11.2
 * §3.2), déterministes — aucun aléa : investir du temps/argent est un
 * arbitrage du joueur, pas un tirage. Calibrage vérifié : 20 h + 500 €
 * investis un mois ⇒ 40 points (`test/engine/business/offer.test.ts`).
 */
export const DEVELOPMENT_POINTS_PER_HOUR = 1.5;
export const DEVELOPMENT_POINTS_PER_BUDGET_EURO = 0.02;

/** Qualité de départ d'une offre nouvellement créée, sur 0-100. */
export const INITIAL_QUALITY_LEVEL = 30;

/**
 * Maturité minimale requise pour lancer une offre, selon son modèle
 * économique (spec M11.2 §3.2, §10 : « si applicable au modèle retenu »).
 * `service-hours` (le "produit" est le temps du fondateur) n'a aucun seuil
 * — toujours lançable immédiatement.
 */
const LAUNCH_MATURITY_THRESHOLD: Readonly<Record<OfferBusinessModel, number>> = {
  "service-hours": 0,
  project: 40,
  "unit-sale": 60,
  recurring: 70,
};

export function computeLaunchThreshold(businessModel: OfferBusinessModel): number {
  return LAUNCH_MATURITY_THRESHOLD[businessModel];
}

/** Crée une nouvelle offre en développement (spec §3.2). */
export function createOffer(spec: OfferCreateSpec, date: GameDate): Offer {
  if (spec.name.trim().length === 0) {
    throw new RangeError("createOffer: le nom de l'offre ne peut pas être vide.");
  }
  if (spec.price < 0) {
    throw new RangeError(`createOffer: price=${spec.price} doit être >= 0.`);
  }

  return {
    id: spec.id,
    name: spec.name,
    businessModel: spec.businessModel,
    positioning: spec.positioning,
    targetSegment: spec.targetSegment,
    price: spec.price,
    status: "in-development",
    maturity: 0,
    qualityLevel: INITIAL_QUALITY_LEVEL,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: date,
    launchedAt: null,
  };
}

/**
 * Investit du temps de fondateur et de l'argent de l'entreprise dans le
 * développement de l'offre (spec §3.2-3.3). Avant lancement, fait
 * progresser `maturity` (readiness à lancer) ; après lancement, fait
 * progresser `qualityLevel` à la place (amélioration continue, jamais
 * `maturity` qui reste gelée à sa valeur de lancement) — traduit
 * littéralement « voir sa maturité progresser [avant] ; puis l'améliorer
 * […] avec de vrais arbitrages coût/temps/qualité [après] ».
 */
export function developOffer(offer: Offer, hours: number, budget: number): Offer {
  if (hours < 0) {
    throw new RangeError(`developOffer: hours=${hours} doit être >= 0.`);
  }
  if (budget < 0) {
    throw new RangeError(`developOffer: budget=${budget} doit être >= 0.`);
  }

  const points = hours * DEVELOPMENT_POINTS_PER_HOUR + budget * DEVELOPMENT_POINTS_PER_BUDGET_EURO;

  return {
    ...offer,
    maturity: offer.status === "in-development" ? clamp(offer.maturity + points, 0, 100) : offer.maturity,
    qualityLevel: offer.status === "launched" ? clamp(offer.qualityLevel + points, 0, 100) : offer.qualityLevel,
    developmentHoursInvested: offer.developmentHoursInvested + hours,
    developmentBudgetInvested: offer.developmentBudgetInvested + budget,
  };
}

/**
 * Lance une offre suffisamment développée (spec §3.2-3.3). Rejet explicite
 * (jamais un clamp silencieux, même discipline que la capacité physique
 * M11.1.5) si déjà lancée ou sous le seuil de maturité de son modèle
 * économique. Le message cite toujours `offer.name`, jamais `offer.id`
 * (invariant I1, spec §9).
 */
export function launchOffer(offer: Offer, date: GameDate): Offer {
  if (offer.status === "launched") {
    throw new RangeError(`launchOffer: « ${offer.name} » est déjà lancée.`);
  }
  const threshold = computeLaunchThreshold(offer.businessModel);
  if (offer.maturity < threshold) {
    throw new RangeError(
      `launchOffer: « ${offer.name} » n'est pas assez développée pour être lancée (${Math.round(offer.maturity)}% — ${threshold}% requis pour ce modèle économique). Continuez à investir du temps et de l'argent dans son développement.`,
    );
  }
  return { ...offer, status: "launched", launchedAt: date };
}

/** Ajuste prix/positionnement d'une offre (spec §3.2, "modifier prix/positionnement"). */
export function updateOfferPricing(offer: Offer, price: number, positioning: OfferPositioning): Offer {
  if (price < 0) {
    throw new RangeError(`updateOfferPricing: price=${price} doit être >= 0.`);
  }
  return { ...offer, price, positioning };
}
