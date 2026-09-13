import type { Rng } from "../rng/rng.js";
import { createRng, deriveSeed } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { toMonthIndex } from "../time/clock.js";
import { clamp } from "../util/math.js";
import { getMarketSegments } from "../market/segments.js";
import { estimate } from "../intelligence/intelligence.js";
import { generateStrategicAccountIdentity } from "./strategicAccountIdentity.js";
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
    },
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
