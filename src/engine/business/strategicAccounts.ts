import type { Rng } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { toMonthIndex } from "../time/clock.js";
import { getMarketSegments } from "../market/segments.js";
import { generateStrategicAccountIdentity } from "./strategicAccountIdentity.js";
import type { EconomicFamily } from "../../types/business.js";
import type { Offer } from "../../types/offer.js";
import type { StrategicAccountOpportunity, StrategicAccountOpportunitySource } from "../../types/strategicAccount.js";

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
    created.push({
      id: `${businessId}:${slot.offerId}:${slot.segmentId}:${toMonthIndex(date)}`,
      businessId,
      offerId: slot.offerId,
      segmentId: slot.segmentId,
      companyName: identity.companyName,
      contactName: identity.contactName,
      contactRole: identity.contactRole,
      source,
      discoveredAt: date,
      status: "researching",
    });
    active += 1;
  }

  return created.length === 0 ? existingOpportunities : [...existingOpportunities, ...created];
}
