import { computeSegmentExpectation } from "../customer/expectations.js";
import { computeDeliveredExperience, computeOperationalPenalty } from "../customer/experience.js";
import { computeSatisfaction } from "../customer/satisfaction.js";
import { SATISFACTION_EWMA_ALPHA } from "../customer/retention.js";
import type { GameDate } from "../time/clock.js";
import type { CustomerSegment } from "../../types/customerSegment.js";
import type { Offer } from "../../types/offer.js";
import type { AccountContract, AccountHistoryEntry, AccountRelationshipState } from "../../types/strategicAccount.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Poids de lissage (EWMA) du taux de sous-livraison — même ordre que `AVAILABILITY_FRUSTRATION_EWMA_ALPHA` (retention.ts, M11.2.3.1 §5). */
export const CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA = 0.3;

/** Poids de lissage (EWMA) de la confiance — sensiblement plus PETIT que `SATISFACTION_EWMA_ALPHA` (0.35) : la confiance évolue plus lentement (spec M11.2.4 §9). */
export const TRUST_EWMA_ALPHA = 0.15;

/** Confiance neutre à la signature, avant toute expérience mesurée (calibrage empirique, comme `NEGOTIATION_PRICE_TOLERANCE`). */
export const INITIAL_ACCOUNT_TRUST = 0.5;

const NEUTRAL_SATISFACTION_SCORE = 50;

function neutralRelationship(): AccountRelationshipState {
  return {
    satisfaction: { scoreThisMonth: null, smoothedScore: NEUTRAL_SATISFACTION_SCORE, diagnosisThisMonth: null },
    trust: INITIAL_ACCOUNT_TRUST,
    breachFrustration: 0,
    history: [],
  };
}

/**
 * Met à jour la satisfaction/confiance/historique d'un compte stratégique
 * après l'exécution économique d'un mois (spec M11.2.4.4 §9) — réutilise
 * EXACTEMENT `computeSegmentExpectation`/`computeSatisfaction`/
 * `computeDeliveredExperience`/`computeOperationalPenalty` (`customer/*`,
 * tous intouchés) : un offre/segment "virtuels" (prix/qualité remplacés
 * par ceux du contrat) fournissent le triplet qualité/prix habituel, un
 * second appel à `computeOperationalPenalty` dédié au compte
 * (`accountSaturationRatio = contract.volume / contract.lastMonthServedVolume`,
 * équivalent à `contractedVolume/contractualSales` agrégé de l'offre —
 * identique pour chaque contrat d'une même offre par construction de
 * l'allocation proportionnelle M11.2.4.3) s'ajoute à la pénalité
 * opérationnelle générique avant l'appel à `computeSatisfaction`. Pure,
 * déterministe. `contract.volume <= 0` (ne devrait jamais arriver pour un
 * contrat signé) -> aucun signal, état précédent conservé tel quel.
 */
export function computeAccountRelationshipUpdate(params: {
  readonly previous: AccountRelationshipState | null;
  readonly contract: AccountContract;
  readonly offer: Offer;
  readonly segment: CustomerSegment;
  readonly genericOperationalPenalty: number;
  readonly reputationScore: number;
  readonly date: GameDate;
}): AccountRelationshipState {
  const { previous, contract, offer, segment, genericOperationalPenalty, reputationScore, date } = params;

  if (contract.volume <= 0) {
    return previous ?? neutralRelationship();
  }

  const virtualOffer: Offer = { ...offer, price: contract.price };
  const virtualSegment: CustomerSegment = { ...segment, qualityExpectation: contract.qualityCommitment };
  const expectation = computeSegmentExpectation(virtualOffer, virtualSegment, reputationScore);

  const accountSaturationRatio =
    contract.lastMonthServedVolume > 0 ? contract.volume / contract.lastMonthServedVolume : Number.POSITIVE_INFINITY;
  const accountOperationalPenalty = computeOperationalPenalty({ saturationRatio: accountSaturationRatio });
  const totalOperationalPenalty = genericOperationalPenalty + accountOperationalPenalty;

  const deliveredExperience = computeDeliveredExperience(offer.qualityLevel, totalOperationalPenalty);
  const priceRatio = contract.price / segment.referencePrice;
  const result = computeSatisfaction(expectation, deliveredExperience, priceRatio, totalOperationalPenalty);

  const priorSmoothed = previous?.satisfaction.smoothedScore ?? result.score;
  const smoothedScore = priorSmoothed * (1 - SATISFACTION_EWMA_ALPHA) + result.score * SATISFACTION_EWMA_ALPHA;

  const unservedRatio = clamp(contract.lastMonthUnservedVolume / contract.volume, 0, 1);
  const priorBreach = previous?.breachFrustration ?? 0;
  const breachFrustration = priorBreach * (1 - CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA) + unservedRatio * CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA;

  // Formule de confiance (calibrage empirique, pas une vérité produit figée) :
  // deux sources à poids égal, jamais l'une sans l'autre (spec §9).
  const satisfactionComponent = clamp(result.score, 0, 100) / 100;
  const breachComponent = 1 - breachFrustration;
  const trustSignalThisMonth = clamp(satisfactionComponent * 0.5 + breachComponent * 0.5, 0, 1);
  const priorTrust = previous?.trust ?? INITIAL_ACCOUNT_TRUST;
  const trust = priorTrust * (1 - TRUST_EWMA_ALPHA) + trustSignalThisMonth * TRUST_EWMA_ALPHA;

  const historyEntry: AccountHistoryEntry = {
    date,
    servedVolume: contract.lastMonthServedVolume,
    unservedVolume: contract.lastMonthUnservedVolume,
    satisfactionScore: result.score,
    trust,
  };

  return {
    satisfaction: { scoreThisMonth: result.score, smoothedScore, diagnosisThisMonth: result.diagnosis },
    trust,
    breachFrustration,
    history: [...(previous?.history ?? []), historyEntry],
  };
}

/**
 * Concentration/dépendance (spec §10) : part du CA de l'entreprise
 * attribuable à CE compte, ce mois-ci — `0` si l'entreprise n'a réalisé
 * aucun CA (jamais de division par zéro), jamais plafonnée sinon
 * (principe 10 : un compte peut représenter 100% du CA sans artifice).
 */
export function computeAccountConcentration(accountRevenueThisMonth: number, businessRevenueThisMonth: number): number {
  return businessRevenueThisMonth > 0 ? accountRevenueThisMonth / businessRevenueThisMonth : 0;
}
