import type {
  BusinessState,
  CreditLineState,
  EconomicFamily,
  MonthlyFinancialStatement,
  TreasuryState,
} from "../../types/business.js";

/**
 * Mois consécutifs avec des obligations impayées (`unpaidObligations > 0`
 * en fin de mois) avant liquidation forcée pour insolvabilité. Le compteur
 * est le signal précurseur exigé par la spec §3.7.
 */
export const INSOLVENCY_THRESHOLD_MONTHS = 6;

/**
 * Pénalité de retard mensuelle appliquée au solde d'obligations impayées
 * tant qu'il n'est pas soldé (conséquence progressive, spec de clôture
 * M9.5 : "produire des conséquences progressives"). Volontairement simple
 * (un seul taux constant) — pas de moteur juridique de recouvrement.
 */
export const UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY = 0.02;

export interface CreateBusinessFinancing {
  readonly creditLineLimit: number;
  readonly creditLineInterestRateAnnual: number;
}

export function createBusiness(
  name: string,
  families: readonly EconomicFamily[],
  financing: CreateBusinessFinancing,
): BusinessState {
  if (name.trim().length === 0) {
    throw new RangeError("createBusiness: name ne peut pas être vide ou blanc.");
  }
  if (families.length === 0) {
    throw new RangeError("createBusiness: une entreprise doit activer au moins une famille économique.");
  }
  if (financing.creditLineLimit < 0) {
    throw new RangeError(`createBusiness: creditLineLimit=${financing.creditLineLimit} doit être >= 0.`);
  }
  if (financing.creditLineInterestRateAnnual < 0) {
    throw new RangeError(
      `createBusiness: creditLineInterestRateAnnual=${financing.creditLineInterestRateAnnual} doit être >= 0.`,
    );
  }
  return {
    name,
    families,
    treasury: {
      cash: 0,
      creditLine: {
        limit: financing.creditLineLimit,
        drawn: 0,
        interestRateAnnual: financing.creditLineInterestRateAnnual,
      },
      unpaidObligations: 0,
      consecutiveUnpaidMonths: 0,
      isInsolvent: false,
    },
    properties: [],
  };
}

/** Charge d'intérêt du mois, calculée sur l'encours de crédit DU DÉBUT du mois (avant le tirage éventuel de ce mois-ci). */
export function computeMonthlyInterest(creditLine: CreditLineState): number {
  return creditLine.drawn * (creditLine.interestRateAnnual / 12);
}

export type FinancingOutcomeKind =
  | "covered-by-cash"
  | "obligations-repaid"
  | "credit-repaid"
  | "covered-by-credit-draw"
  | "shortfall-unmet"
  | "insolvent";

export interface FinancingOutcome {
  readonly kind: FinancingOutcomeKind;
  /** Montant pertinent selon `kind` (remboursement, tirage, ou impayé nouveau/persistant). */
  readonly amount: number;
}

export interface ApplyCashFlowResult {
  readonly business: BusinessState;
  readonly outcome: FinancingOutcome;
}

function finalizeInsolvencyState(
  unpaidObligations: number,
  previousConsecutiveUnpaidMonths: number,
): { readonly consecutiveUnpaidMonths: number; readonly isInsolvent: boolean } {
  const consecutiveUnpaidMonths = unpaidObligations > 0 ? previousConsecutiveUnpaidMonths + 1 : 0;
  return { consecutiveUnpaidMonths, isInsolvent: consecutiveUnpaidMonths >= INSOLVENCY_THRESHOLD_MONTHS };
}

/**
 * Applique le cash-flow du mois à la trésorerie, en suivant une cascade de
 * financement explicite qui ne laisse jamais un coût engagé disparaître
 * (spec de clôture M9.5) :
 *
 * 0. Les obligations impayées héritées des mois précédents portent d'abord
 *    une pénalité de retard (conséquence progressive).
 * 1. Cash disponible = cash + cashFlow du mois.
 * 2. Si positif ou nul : on éponge en priorité les obligations impayées
 *    (+ pénalité), puis on rembourse l'encours de crédit tiré, puis le
 *    solde reste en cash. Jamais de cash négatif.
 * 3. Si négatif (besoin de financement) : on tire sur la ligne de crédit
 *    dans la limite de son plafond. Ce qui n'est ni couvert par le cash ni
 *    par la ligne de crédit s'ajoute aux obligations impayées existantes
 *    (+ pénalité) — ce n'est jamais simplement annulé.
 *
 * Le cash ne peut donc jamais devenir négatif : un besoin de financement
 * non couvert se lit sur `unpaidObligations`/`consecutiveUnpaidMonths`/
 * `isInsolvent`, jamais sur un solde de cash fictif ni sur un montant qui
 * se serait volatilisé sans contrepartie économique.
 */
export function applyMonthlyCashFlow(
  business: BusinessState,
  statement: MonthlyFinancialStatement,
): ApplyCashFlowResult {
  const treasury = business.treasury;
  const accruedUnpaidObligations = treasury.unpaidObligations * (1 + UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY);
  const availableCash = treasury.cash + statement.cashFlow;

  if (availableCash >= 0) {
    const obligationsRepayment = Math.min(accruedUnpaidObligations, availableCash);
    const unpaidObligations = accruedUnpaidObligations - obligationsRepayment;
    const cashAfterObligations = availableCash - obligationsRepayment;

    const creditRepayment = Math.min(treasury.creditLine.drawn, cashAfterObligations);
    const cash = cashAfterObligations - creditRepayment;
    const creditLine: CreditLineState = { ...treasury.creditLine, drawn: treasury.creditLine.drawn - creditRepayment };

    const { consecutiveUnpaidMonths, isInsolvent } = finalizeInsolvencyState(
      unpaidObligations,
      treasury.consecutiveUnpaidMonths,
    );
    const nextTreasury: TreasuryState = { cash, creditLine, unpaidObligations, consecutiveUnpaidMonths, isInsolvent };
    const updatedBusiness = { ...business, treasury: nextTreasury };

    if (isInsolvent) {
      return { business: updatedBusiness, outcome: { kind: "insolvent", amount: unpaidObligations } };
    }
    if (unpaidObligations > 0) {
      return { business: updatedBusiness, outcome: { kind: "shortfall-unmet", amount: unpaidObligations } };
    }
    if (obligationsRepayment > 0) {
      return { business: updatedBusiness, outcome: { kind: "obligations-repaid", amount: obligationsRepayment } };
    }
    if (creditRepayment > 0) {
      return { business: updatedBusiness, outcome: { kind: "credit-repaid", amount: creditRepayment } };
    }
    return { business: updatedBusiness, outcome: { kind: "covered-by-cash", amount: availableCash } };
  }

  const financingNeed = -availableCash;
  const roomLeft = treasury.creditLine.limit - treasury.creditLine.drawn;
  const draw = Math.max(0, Math.min(financingNeed, roomLeft));
  const newShortfall = financingNeed - draw;
  const creditLine: CreditLineState = { ...treasury.creditLine, drawn: treasury.creditLine.drawn + draw };
  const unpaidObligations = accruedUnpaidObligations + newShortfall;

  const { consecutiveUnpaidMonths, isInsolvent } = finalizeInsolvencyState(
    unpaidObligations,
    treasury.consecutiveUnpaidMonths,
  );
  const nextTreasury: TreasuryState = { cash: 0, creditLine, unpaidObligations, consecutiveUnpaidMonths, isInsolvent };
  const updatedBusiness = { ...business, treasury: nextTreasury };

  if (isInsolvent) {
    return { business: updatedBusiness, outcome: { kind: "insolvent", amount: unpaidObligations } };
  }
  if (unpaidObligations > 0) {
    return { business: updatedBusiness, outcome: { kind: "shortfall-unmet", amount: unpaidObligations } };
  }
  return { business: updatedBusiness, outcome: { kind: "covered-by-credit-draw", amount: draw } };
}

/**
 * Apport de capital externe (personnel ou tiers) directement en trésorerie
 * — le levier "entreprise sauvée par apport" de la spec. N'affecte jamais la
 * ligne de crédit ni les obligations impayées directement : c'est un
 * financement en fonds propres qui augmente le cash disponible, lequel
 * pourra ensuite éponger des impayés au prochain `applyMonthlyCashFlow`.
 */
export function injectCapital(business: BusinessState, amount: number): BusinessState {
  if (amount < 0) {
    throw new RangeError(`injectCapital: amount=${amount} doit être >= 0.`);
  }
  return { ...business, treasury: { ...business.treasury, cash: business.treasury.cash + amount } };
}
