import { clamp } from "../util/math.js";
import type { Rng } from "../rng/rng.js";
import type { SaleClosing, SaleDecision, SaleProcessState } from "../../types/sale.js";
import type { ValuationResult } from "../../types/valuation.js";

/** Mois minimum avant qu'une première offre puisse arriver (spec M11.1.5 §6.2 : "cela doit prendre du temps"). */
export const MIN_MONTHS_LISTED_BEFORE_OFFER = 1;

/** Frais de transaction forfaitaires à la clôture d'une vente (V1 simple, pas de fiscalité de cession avancée). */
export const TRANSACTION_COST_RATE = 0.05;

/** Une contre-offre acceptée par l'acheteur si elle ne dépasse pas l'offre initiale de plus de 15 %. */
export const COUNTER_OFFER_ACCEPTANCE_MULTIPLE = 1.15;

export function startSaleProcess(): SaleProcessState {
  return { status: "listed", monthsListed: 0, currentOffer: null };
}

/**
 * Probabilité mensuelle qu'un acheteur se manifeste. Nulle par
 * construction quand `valuation.mid <= 0` (société sans valeur) — garantit
 * qu'une société invendable ne reçoit jamais d'offre, jamais un simple
 * "peu probable" (spec M11.1.5 §6.2). Croît légèrement avec la patience
 * (`monthsListed`) pour une société qui a effectivement de la valeur.
 */
function offerProbability(monthsListed: number, valuation: ValuationResult): number {
  const quality = valuation.high > 0 ? clamp(valuation.mid / valuation.high, 0, 1) : 0;
  const timeFactor = 0.3 + Math.min(monthsListed, 5) * 0.08;
  return quality * timeFactor;
}

/**
 * Avance le processus de cession d'un mois (aucun effet si un statut autre
 * que `"listed"` — une offre en attente doit d'abord être tranchée par le
 * joueur via `resolveSaleDecision`). Déterministe/seedé : aucun
 * `Math.random`, tout l'aléa vient de `rng`.
 */
export function advanceSaleProcess(process: SaleProcessState, valuation: ValuationResult, rng: Rng): SaleProcessState {
  if (process.status !== "listed") {
    return process;
  }
  const monthsListed = process.monthsListed + 1;
  if (monthsListed <= MIN_MONTHS_LISTED_BEFORE_OFFER) {
    return { ...process, monthsListed };
  }
  const probability = offerProbability(monthsListed, valuation);
  if (probability <= 0 || !rng.nextBool(probability)) {
    return { ...process, monthsListed };
  }
  const quality = valuation.high > 0 ? clamp(valuation.mid / valuation.high, 0, 1) : 0;
  const amount = valuation.low + rng.nextFloat(0, 1) * (valuation.high - valuation.low);
  return { status: "offer-pending", monthsListed, currentOffer: { amount, buyerQuality: quality } };
}

/**
 * Applique la décision du joueur sur le processus en cours (spec M11.1.5
 * §6.2). `accept`/`reject`/`counter` sans offre en attente sont des no-op
 * (le joueur ne peut pas accepter une offre qui n'existe pas). `withdraw`
 * clôture toujours, quel que soit le statut courant.
 */
export function resolveSaleDecision(process: SaleProcessState, decision: SaleDecision): SaleProcessState {
  if (decision.action === "withdraw") {
    return { status: "withdrawn", monthsListed: process.monthsListed, currentOffer: null };
  }
  if (process.status !== "offer-pending" || !process.currentOffer) {
    return process;
  }
  if (decision.action === "reject") {
    return { status: "listed", monthsListed: process.monthsListed, currentOffer: null };
  }
  if (decision.action === "accept") {
    return { status: "closed", monthsListed: process.monthsListed, currentOffer: process.currentOffer };
  }
  if (decision.action === "counter") {
    const counterAmount = decision.counterAmount ?? 0;
    const buyerAccepts = counterAmount <= process.currentOffer.amount * COUNTER_OFFER_ACCEPTANCE_MULTIPLE;
    if (buyerAccepts) {
      return {
        status: "closed",
        monthsListed: process.monthsListed,
        currentOffer: { amount: counterAmount, buyerQuality: process.currentOffer.buyerQuality },
      };
    }
    return { status: "listed", monthsListed: process.monthsListed, currentOffer: null };
  }
  return process;
}

/**
 * Clôture financière d'une vente acceptée (spec M11.1.5 §6.2) : la dette
 * de l'entreprise (ligne de crédit + obligations impayées + principal
 * immobilier restant dû) est réglée en priorité sur le produit de la
 * vente, les frais de transaction ensuite, le solde net rejoint le
 * patrimoine personnel. Jamais de produit net négatif.
 */
export function closeSale(offerAmount: number, outstandingDebt: number): SaleClosing {
  const transactionCosts = offerAmount * TRANSACTION_COST_RATE;
  const availableAfterCosts = Math.max(0, offerAmount - transactionCosts);
  const debtRepaid = Math.min(outstandingDebt, availableAfterCosts);
  const netProceeds = Math.max(0, availableAfterCosts - debtRepaid);
  return { grossAmount: offerAmount, debtRepaid, transactionCosts, netProceeds };
}
