import type { Rng } from "../rng/rng.js";
import { createRng, deriveSeed } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { toMonthIndex } from "../time/clock.js";
import { clamp } from "../util/math.js";
import { getMarketSegments } from "../market/segments.js";
import { estimate } from "../intelligence/intelligence.js";
import { generateStrategicAccountIdentity } from "./strategicAccountIdentity.js";
import { INITIAL_ACCOUNT_TRUST } from "./accountRelationship.js";
import type { EconomicFamily } from "../../types/business.js";
import type { Offer } from "../../types/offer.js";
import type {
  AccountNegotiationDecision,
  AccountProposal,
  StrategicAccountAction,
  StrategicAccountOpportunity,
  StrategicAccountOpportunitySource,
} from "../../types/strategicAccount.js";

/** Probabilité, PAR slot éligible ET PAR MOIS, qu'une nouvelle opportunité apparaisse (calibrage empirique, comme `sale.ts`). */
export const STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY = 0.06;

/**
 * Garde-fou explicite : au-delà de ce nombre d'opportunités actives
 * simultanées pour une entreprise, plus aucune nouvelle n'apparaît ce
 * mois-ci — évite une accumulation illimitée tant qu'aucune négociation
 * (M11.2.4.2) ne vient réduire ce nombre.
 */
export const MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS = 3;

const OPPORTUNITY_SOURCES: readonly StrategicAccountOpportunitySource[] = ["prospecting", "network", "referral", "inbound", "tender"];

export interface StrategicAccountSlot {
  readonly offerId: string;
  readonly segmentId: string;
}

/**
 * Couples (offre lancée, son propre targetSegment) pouvant faire
 * apparaître une opportunité (spec §4 — corrigé revue produit
 * 2026-09-13) : une opportunité est rattachée à un couple (offre,
 * segment) précis, jamais à une famille entière. Un slot n'existe QUE si
 * `offer.targetSegment` EST LUI-MÊME le segment marqué
 * `strategicAccountsEligible === true` — jamais un produit cartésien
 * entre les offres lancées et tous les segments éligibles de la famille.
 */
export function findEligibleStrategicAccountSlots(offers: readonly Offer[], family: EconomicFamily): readonly StrategicAccountSlot[] {
  const segmentsById = new Map(getMarketSegments(family).map((segment) => [segment.id, segment]));
  const slots: StrategicAccountSlot[] = [];
  for (const offer of offers) {
    if (offer.status !== "launched") continue;
    const segment = segmentsById.get(offer.targetSegment);
    if (segment?.strategicAccountsEligible === true) {
      slots.push({ offerId: offer.id, segmentId: offer.targetSegment });
    }
  }
  return slots;
}

/** Nombre d'heures de recherche au-delà duquel l'incertitude atteint son plancher (spec M11.2.4.2 §7). */
export const MAX_RESEARCH_HOURS_FOR_FULL_CONFIDENCE = 40;

function referencePriceFor(segmentId: string, family: EconomicFamily): number {
  return getMarketSegments(family).find((segment) => segment.id === segmentId)?.referencePrice ?? 0;
}

/**
 * Budget/attentes RÉELS du compte (spec M11.2.4.2 §8) — jamais persisté,
 * dérivé à la demande depuis l'id de l'opportunité (stable) et le prix de
 * référence de son segment : même id + même prix -> même budget, toujours.
 * Connu EXACTEMENT par le moteur pour résoudre une négociation ; le
 * joueur n'en a jamais qu'une vue bruitée (`computeBudgetEstimate`).
 */
export function deriveTrueOpportunityBudget(
  opportunityId: string,
  referencePrice: number,
): {
  readonly maxAcceptablePrice: number;
  readonly expectedVolume: number;
  readonly minAcceptableQuality: number;
} {
  const rng = createRng(deriveSeed(0, "strategic-account-budget", opportunityId));
  return {
    maxAcceptablePrice: referencePrice * rng.nextFloat(0.9, 1.5),
    expectedVolume: rng.nextFloat(20, 80),
    minAcceptableQuality: rng.nextFloat(50, 80),
  };
}

/** Nombre de mois avant départ automatique si un renouvellement en attente n'est jamais résolu (spec M11.2.4.5 §12) — calibrage empirique. */
export const RENEWAL_GRACE_PERIOD_MONTHS = 3;

/** Un client confiant est moins enclin à négocier âprement (spec §9, §11) — relève `maxAcceptablePrice`, abaisse légèrement `minAcceptableQuality`. */
export const TRUST_PRICE_LENIENCY = 0.3;
/** Un compte qui pèse lourd dans le CA (spec §10) sait qu'il a du pouvoir — abaisse `maxAcceptablePrice`, relève `minAcceptableQuality`. */
export const CONCENTRATION_PRICE_PRESSURE = 0.2;
/** Une entreprise réputée négocie en meilleure position (spec §11, tableau). */
export const REPUTATION_PRICE_BONUS = 0.1;
/** Plus le marché offre d'alternatives déjà captées par la concurrence agrégée (proxy explicite, spec §18.1), plus le client négocie dur. */
export const COMPETITION_PRICE_PRESSURE = 0.25;

/**
 * Vraie proposition de renouvellement du CLIENT (spec M11.2.4.5 §11-§12)
 * — jamais une équation unique opaque (spec §19.1) : une graine de base
 * indépendante de la négociation initiale (`deriveTrueOpportunityBudget`),
 * puis 4 AJUSTEMENTS BORNÉS et NOMMÉS individuellement, appliqués dans
 * l'ordre, chacun testable isolément. `expectedVolume` n'est affecté par
 * aucun facteur (aucun élément du tableau §11 ne relie volume et pouvoir
 * de négociation). Pure, déterministe.
 */
export function deriveRenewalBudget(params: {
  readonly opportunityId: string;
  readonly referencePrice: number;
  readonly trust: number;
  readonly concentration: number;
  readonly reputationScore: number;
  readonly competitivePressure: number;
}): {
  readonly maxAcceptablePrice: number;
  readonly expectedVolume: number;
  readonly minAcceptableQuality: number;
} {
  const { opportunityId, referencePrice, trust, concentration, reputationScore, competitivePressure } = params;
  const rng = createRng(deriveSeed(0, "strategic-account-renewal-budget", opportunityId));
  const baseMaxAcceptablePrice = referencePrice * rng.nextFloat(0.9, 1.5);
  const baseExpectedVolume = rng.nextFloat(20, 80);
  const baseMinAcceptableQuality = rng.nextFloat(50, 80);

  const clampedTrust = clamp(trust, 0, 1);
  const clampedConcentration = clamp(concentration, 0, 1);
  const clampedReputation = clamp(reputationScore, 0, 1);
  const clampedCompetitivePressure = clamp(competitivePressure, 0, 1);

  const priceLeniency = 1 + (clampedTrust - 0.5) * TRUST_PRICE_LENIENCY;
  const concentrationPricePressure = 1 - clampedConcentration * CONCENTRATION_PRICE_PRESSURE;
  const reputationBonus = 1 + clampedReputation * REPUTATION_PRICE_BONUS;
  const competitionPricePressure = 1 - clampedCompetitivePressure * COMPETITION_PRICE_PRESSURE;
  const maxAcceptablePrice = clamp(
    baseMaxAcceptablePrice * priceLeniency * concentrationPricePressure * reputationBonus * competitionPricePressure,
    referencePrice * 0.4,
    referencePrice * 3,
  );

  // Symétrique côté qualité : confiance -> plus indulgent, concentration/concurrence -> plus exigeant.
  const trustQualityLeniency = -(clampedTrust - 0.5) * 10;
  const concentrationQualityPressure = clampedConcentration * 10;
  const competitionQualityPressure = clampedCompetitivePressure * 10;
  const minAcceptableQuality = clamp(baseMinAcceptableQuality + trustQualityLeniency + concentrationQualityPressure + competitionQualityPressure, 0, 100);

  return { maxAcceptablePrice, expectedVolume: baseExpectedVolume, minAcceptableQuality };
}

/**
 * Vue imparfaite du budget réel (spec §7) : réutilise `estimate()`
 * (`intelligence.ts`, patron Truth/PlayerView déjà éprouvé) — le nombre
 * d'heures de recherche investies fait office de "compétence équivalente"
 * 0-100, aucune nouvelle courbe de bruit inventée. Déterministe pour un
 * couple (id, heures) donné — jamais dépendant du RNG mensuel de fond.
 */
export function computeBudgetEstimate(
  opportunityId: string,
  referencePrice: number,
  researchHoursInvested: number,
): StrategicAccountOpportunity["budgetEstimate"] {
  const truth = deriveTrueOpportunityBudget(opportunityId, referencePrice);
  const confidenceEquivalent = clamp((researchHoursInvested / MAX_RESEARCH_HOURS_FOR_FULL_CONFIDENCE) * 100, 0, 100);
  const rng = createRng(deriveSeed(0, "strategic-account-estimate", opportunityId));
  return {
    price: estimate(truth.maxAcceptablePrice, confidenceEquivalent, rng.fork("price")),
    volume: estimate(truth.expectedVolume, confidenceEquivalent, rng.fork("volume")),
    qualityCommitment: estimate(truth.minAcceptableQuality, confidenceEquivalent, rng.fork("quality")),
  };
}

/** Nombre d'opportunités encore activement à l'étude (seul "researching" compte pour le plafond — aucun autre statut n'est jamais produit avant M11.2.4.2). */
function countActiveOpportunities(opportunities: readonly StrategicAccountOpportunity[]): number {
  return opportunities.filter((o) => o.status === "researching").length;
}

/**
 * Fait avancer d'un mois les opportunités de comptes stratégiques d'une
 * entreprise (spec M11.2.4.1 §15, patron d'arrivée seedée identique à
 * `advanceSaleProcess`) : ajoute au plus une opportunité par slot
 * éligible, jamais au-delà du plafond, jamais de résolution de statut
 * (M11.2.4.2). Fonction pure, déterministe : mêmes arguments -> même
 * résultat.
 */
export function advanceStrategicAccountOpportunities(params: {
  readonly businessId: string;
  readonly offers: readonly Offer[];
  readonly family: EconomicFamily;
  readonly existingOpportunities: readonly StrategicAccountOpportunity[];
  readonly rng: Rng;
  readonly date: GameDate;
}): readonly StrategicAccountOpportunity[] {
  const { businessId, offers, family, existingOpportunities, rng, date } = params;
  let active = countActiveOpportunities(existingOpportunities);
  if (active >= MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS) {
    return existingOpportunities;
  }

  const slots = findEligibleStrategicAccountSlots(offers, family);
  const created: StrategicAccountOpportunity[] = [];
  for (const slot of slots) {
    if (active >= MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS) break;
    const slotRng = rng.fork(`${slot.offerId}:${slot.segmentId}`);
    if (!slotRng.nextBool(STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY)) continue;

    const identity = generateStrategicAccountIdentity(slotRng.fork("identity"));
    const source = slotRng.fork("source").pick(OPPORTUNITY_SOURCES);
    const id = `${businessId}:${slot.offerId}:${slot.segmentId}:${toMonthIndex(date)}`;
    created.push({
      id,
      businessId,
      offerId: slot.offerId,
      segmentId: slot.segmentId,
      companyName: identity.companyName,
      contactName: identity.contactName,
      contactRole: identity.contactRole,
      source,
      discoveredAt: date,
      status: "researching",
      researchHoursInvested: 0,
      budgetEstimate: computeBudgetEstimate(id, referencePriceFor(slot.segmentId, family), 0),
      lastAccountProposal: null,
      contract: null,
      relationship: null,
    });
    active += 1;
  }

  return created.length === 0 ? existingOpportunities : [...existingOpportunities, ...created];
}

/** Tolérance de prix pour l'acceptation d'une proposition (spec M11.2.4.2 §8) : accepte tout prix <= budget réel × ce facteur, jamais un jet de probabilité. */
export const NEGOTIATION_PRICE_TOLERANCE = 1.0;

function signContract(opportunity: StrategicAccountOpportunity, proposal: AccountProposal, date: GameDate): StrategicAccountOpportunity {
  return {
    ...opportunity,
    status: "won",
    lastAccountProposal: null,
    contract: {
      price: proposal.price,
      volume: proposal.volume,
      qualityCommitment: proposal.qualityCommitment,
      durationMonths: proposal.durationMonths,
      monthsRemaining: proposal.durationMonths,
      signedAt: date,
      lastMonthServedVolume: 0,
      lastMonthUnservedVolume: 0,
      renewalProposal: null,
      renewalDeadlineMonthsRemaining: null,
    },
    relationship: null,
  };
}

/**
 * Résout une décision de négociation (spec M11.2.4.2 §8) : la RÉSOLUTION
 * d'une proposition donnée est TOUJOURS un calcul déterministe contre le
 * budget réel du compte (`deriveTrueOpportunityBudget`) — jamais un jet
 * de probabilité sur l'issue elle-même (seule l'arrivée d'une opportunité,
 * M11.2.4.1, reste stochastique-seedée). Fonction pure.
 */
export function resolveAccountNegotiationDecision(
  opportunity: StrategicAccountOpportunity,
  family: EconomicFamily,
  decision: AccountNegotiationDecision,
  date: GameDate,
): StrategicAccountOpportunity {
  if (opportunity.status !== "researching" && opportunity.status !== "negotiating") {
    throw new RangeError(
      `resolveAccountNegotiationDecision: "${opportunity.id}" au statut "${opportunity.status}", négociation impossible.`,
    );
  }
  if (decision.action === "withdraw") {
    return { ...opportunity, status: "declined-by-player", lastAccountProposal: null };
  }
  if (decision.action === "accept") {
    if (!opportunity.lastAccountProposal) {
      throw new RangeError(`resolveAccountNegotiationDecision: aucune contre-proposition à accepter pour "${opportunity.id}".`);
    }
    return signContract(opportunity, opportunity.lastAccountProposal, date);
  }

  const referencePrice = referencePriceFor(opportunity.segmentId, family);
  const budget = deriveTrueOpportunityBudget(opportunity.id, referencePrice);
  const { proposal } = decision;
  const accepted = proposal.price <= budget.maxAcceptablePrice * NEGOTIATION_PRICE_TOLERANCE && proposal.qualityCommitment >= budget.minAcceptableQuality;
  if (accepted) return signContract(opportunity, proposal, date);

  return {
    ...opportunity,
    status: "negotiating",
    lastAccountProposal: {
      price: budget.maxAcceptablePrice,
      volume: budget.expectedVolume,
      qualityCommitment: budget.minAcceptableQuality,
      durationMonths: proposal.durationMonths,
    },
  };
}

/**
 * Résout une décision de RENOUVELLEMENT (spec M11.2.4.5 §11-§12) —
 * cycle de vie distinct de `resolveAccountNegotiationDecision` (réservée
 * à `"researching"`/`"negotiating"`) : opère sur un compte TOUJOURS
 * `"won"`, avec une `contract.renewalProposal` en attente posée par le
 * moteur (c'est le client qui ouvre le renouvellement, jamais le joueur
 * — `decision.action === "propose"` n'a donc aucun sens ici). Même
 * discipline que la négociation initiale : la résolution est TOUJOURS
 * déterministe contre le vrai budget de renouvellement
 * (`deriveRenewalBudget`), jamais un jet de probabilité sur l'issue.
 * Fonction pure.
 */
export function resolveAccountRenewalDecision(
  opportunity: StrategicAccountOpportunity,
  family: EconomicFamily,
  decision: Extract<AccountNegotiationDecision, { action: "accept" | "counter" | "withdraw" }>,
  concentration: number,
  competitivePressure: number,
  reputationScore: number,
  date: GameDate,
): StrategicAccountOpportunity {
  if (opportunity.status !== "won" || !opportunity.contract) {
    throw new RangeError(`resolveAccountRenewalDecision: "${opportunity.id}" au statut "${opportunity.status}", pas un compte actif.`);
  }
  const { contract } = opportunity;
  if (!contract.renewalProposal) {
    throw new RangeError(`resolveAccountRenewalDecision: aucun renouvellement en attente pour "${opportunity.id}".`);
  }

  if (decision.action === "withdraw") {
    return { ...opportunity, status: "lost", contract: null };
  }
  if (decision.action === "accept") {
    return signContract(opportunity, contract.renewalProposal, date);
  }

  const referencePrice = referencePriceFor(opportunity.segmentId, family);
  const budget = deriveRenewalBudget({
    opportunityId: opportunity.id,
    referencePrice,
    trust: opportunity.relationship?.trust ?? INITIAL_ACCOUNT_TRUST,
    concentration,
    reputationScore,
    competitivePressure,
  });
  const { proposal } = decision;
  const accepted = proposal.price <= budget.maxAcceptablePrice * NEGOTIATION_PRICE_TOLERANCE && proposal.qualityCommitment >= budget.minAcceptableQuality;
  if (accepted) return signContract(opportunity, proposal, date);

  return {
    ...opportunity,
    contract: {
      ...contract,
      renewalProposal: {
        price: budget.maxAcceptablePrice,
        volume: budget.expectedVolume,
        qualityCommitment: budget.minAcceptableQuality,
        durationMonths: proposal.durationMonths,
      },
      // Le compteur d'expiration n'est JAMAIS remis à zéro par une contre-négociation (décision 4, plan).
    },
  };
}

/** Investit des heures de recherche sur une opportunité (spec §6, §7) : accumule, raffraîchit l'estimation. No-op sur un statut terminal. */
export function applyResearchHours(opportunity: StrategicAccountOpportunity, hours: number, family: EconomicFamily): StrategicAccountOpportunity {
  if (hours < 0) {
    throw new RangeError(`applyResearchHours: hours=${hours} doit être >= 0.`);
  }
  if (opportunity.status !== "researching" && opportunity.status !== "negotiating") {
    return opportunity;
  }
  const researchHoursInvested = opportunity.researchHoursInvested + hours;
  const referencePrice = referencePriceFor(opportunity.segmentId, family);
  return {
    ...opportunity,
    researchHoursInvested,
    budgetEstimate: computeBudgetEstimate(opportunity.id, referencePrice, researchHoursInvested),
  };
}

/** Opportunités `"won"` (contrat signé) rattachées à une offre précise (spec M11.2.4.3 §2). */
export function wonOpportunitiesForOffer(
  opportunities: readonly StrategicAccountOpportunity[],
  offerId: string,
): readonly StrategicAccountOpportunity[] {
  return opportunities.filter((o) => o.offerId === offerId && o.status === "won" && o.contract !== null);
}

/** Somme du volume contractuel déjà signé pour une offre (spec §2) — `0` si aucun contrat won. */
export function computeContractedVolumeForOffer(opportunities: readonly StrategicAccountOpportunity[], offerId: string): number {
  return wonOpportunitiesForOffer(opportunities, offerId).reduce((sum, o) => sum + o.contract!.volume, 0);
}

/**
 * Ajustement du funnel de demande agrégée pour retirer le chevauchement
 * avec le volume contractuel (spec §2, formule prouvée) : `overlap` est la
 * part du contrat déjà comptée dans la demande agrégée du segment ciblé
 * (reclassement pur, aucun double comptage) ; `incremental` est la part du
 * contrat qui EXCÈDE la demande agrégée (demande réellement nouvelle,
 * apportée par la relation commerciale directe).
 */
export interface ContractualDemandAdjustment {
  readonly overlap: number;
  readonly incremental: number;
  readonly adjustedSegmentDemand: number;
}
export function computeContractualDemandAdjustment(aggregateDemandForSegment: number, contractedVolume: number): ContractualDemandAdjustment {
  const overlap = Math.min(aggregateDemandForSegment, contractedVolume);
  return {
    overlap,
    incremental: contractedVolume - overlap,
    adjustedSegmentDemand: aggregateDemandForSegment - overlap,
  };
}

/**
 * Allocation de capacité à 3 flux (new/repeat/contractuel) SANS priorité
 * cachée (spec §3, formule prouvée) : chaque flux perd exactement la même
 * proportion de sa propre demande en cas de surcharge — jamais de flux
 * privilégié. Fonction pure, aucune division par zéro (`totalDemand = 0`
 * -> toutes les parts nulles).
 */
export interface ContractualCapacityAllocation {
  readonly totalDemandIncludingContractual: number;
  readonly actualSales: number;
  readonly lostToCapacity: number;
  readonly contractualSales: number;
  readonly unservedContractual: number;
  readonly newRepeatSales: number;
  readonly newRepeatLost: number;
}
export function computeContractualCapacityAllocation(params: {
  readonly newRepeatTotalDemand: number;
  readonly contractedVolume: number;
  readonly capacityForOffer: number;
}): ContractualCapacityAllocation {
  const { newRepeatTotalDemand, contractedVolume, capacityForOffer } = params;
  const totalDemandIncludingContractual = newRepeatTotalDemand + contractedVolume;
  const actualSales = Math.min(totalDemandIncludingContractual, capacityForOffer);
  const lostToCapacity = Math.max(0, totalDemandIncludingContractual - capacityForOffer);
  const shareContractual = totalDemandIncludingContractual > 0 ? contractedVolume / totalDemandIncludingContractual : 0;
  const contractualSales = actualSales * shareContractual;
  const unservedContractual = lostToCapacity * shareContractual;
  return {
    totalDemandIncludingContractual,
    actualSales,
    lostToCapacity,
    contractualSales,
    unservedContractual,
    newRepeatSales: actualSales - contractualSales,
    newRepeatLost: lostToCapacity - unservedContractual,
  };
}

/**
 * Répartit `contractualSales`/`unservedContractual` (agrégés, toutes
 * relations confondues sur l'offre) entre les contrats individuels
 * proportionnellement au `volume` propre de chacun (spec §10) — jamais de
 * priorité entre comptes gagnés sur la même offre.
 */
export interface ContractOutcome {
  readonly opportunityId: string;
  readonly servedVolume: number;
  readonly unservedVolume: number;
  readonly revenue: number;
}
export function allocateContractOutcomes(
  wonOpportunities: readonly StrategicAccountOpportunity[],
  contractualSales: number,
  unservedContractual: number,
  contractedVolume: number,
): readonly ContractOutcome[] {
  if (contractedVolume <= 0) return [];
  return wonOpportunities.map((opportunity) => {
    const contract = opportunity.contract!;
    const share = contract.volume / contractedVolume;
    const servedVolume = contractualSales * share;
    return {
      opportunityId: opportunity.id,
      servedVolume,
      unservedVolume: unservedContractual * share,
      revenue: servedVolume * contract.price,
    };
  });
}

/**
 * Applique une série d'actions joueur (temps investi/négociation) sur une
 * liste d'opportunités (spec §6, §8) — une par une, dans l'ordre fourni,
 * jamais de résimulation ni de RNG (déjà résolu dans les fonctions pures
 * appelées ici).
 */
export function applyStrategicAccountActions(
  opportunities: readonly StrategicAccountOpportunity[],
  actions: readonly StrategicAccountAction[],
  family: EconomicFamily,
  date: GameDate,
): readonly StrategicAccountOpportunity[] {
  let result = opportunities;
  for (const action of actions) {
    const index = result.findIndex((o) => o.id === action.opportunityId);
    if (index === -1) {
      throw new RangeError(`applyStrategicAccountActions: opportunité "${action.opportunityId}" introuvable.`);
    }
    const opportunity = result[index]!;
    const updated =
      action.kind === "invest-time"
        ? applyResearchHours(opportunity, action.hours, family)
        : resolveAccountNegotiationDecision(
            opportunity,
            family,
            action.kind === "accept" || action.kind === "withdraw" ? { action: action.kind } : { action: action.kind, proposal: action.proposal },
            date,
          );
    result = result.map((o, i) => (i === index ? updated : o));
  }
  return result;
}
