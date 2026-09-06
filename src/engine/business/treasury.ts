import type {
  BusinessState,
  CreditLineState,
  EconomicFamily,
  MonthlyFinancialStatement,
  TreasuryState,
} from "../../types/business.js";

/**
 * Mois consécutifs de besoin de financement non couvert (cash épuisé ET
 * ligne de crédit au plafond) avant liquidation forcée pour insolvabilité.
 * Le compteur est le signal précurseur exigé par la spec §3.7.
 */
export const INSOLVENCY_THRESHOLD_MONTHS = 6;

export interface CreateBusinessFinancing {
  readonly creditLineLimit: number;
  readonly creditLineInterestRateAnnual: number;
}

export function createBusiness(
  name: string,
  families: readonly EconomicFamily[],
  financing: CreateBusinessFinancing,
): BusinessState {
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
      consecutiveUnmetShortfallMonths: 0,
      isInsolvent: false,
    },
  };
}

/** Charge d'intérêt du mois, calculée sur l'encours de crédit DU DÉBUT du mois (avant le tirage éventuel de ce mois-ci). */
export function computeMonthlyInterest(creditLine: CreditLineState): number {
  return creditLine.drawn * (creditLine.interestRateAnnual / 12);
}

export type FinancingOutcomeKind =
  | "covered-by-cash"
  | "credit-repaid"
  | "covered-by-credit-draw"
  | "shortfall-unmet"
  | "insolvent";

export interface FinancingOutcome {
  readonly kind: FinancingOutcomeKind;
  /** Montant pertinent selon `kind` (remboursement, tirage, ou découvert non couvert). */
  readonly amount: number;
}

export interface ApplyCashFlowResult {
  readonly business: BusinessState;
  readonly outcome: FinancingOutcome;
}

/**
 * Applique le cash-flow du mois à la trésorerie, en suivant une cascade de
 * financement explicite (spec) :
 *
 * 1. Cash disponible = cash + cashFlow du mois.
 * 2. Si positif ou nul : on rembourse en priorité l'encours de crédit tiré,
 *    puis le solde reste en cash. Jamais de cash négatif.
 * 3. Si négatif (besoin de financement) : on tire sur la ligne de crédit
 *    dans la limite de son plafond.
 *    - Si le tirage couvre tout le besoin : cash = 0, pas de signal.
 *    - Sinon (ligne de crédit épuisée ET besoin non couvert) : le compteur
 *      de mois consécutifs de découvert non couvert s'incrémente ; au-delà
 *      du seuil, l'entreprise devient insolvable (liquidation forcée par
 *      l'appelant).
 *
 * Le cash ne peut donc jamais devenir négatif : un besoin de financement
 * non couvert se lit sur `consecutiveUnmetShortfallMonths`/`isInsolvent`,
 * jamais sur un solde de cash fictif.
 */
export function applyMonthlyCashFlow(
  business: BusinessState,
  statement: MonthlyFinancialStatement,
): ApplyCashFlowResult {
  const treasury = business.treasury;
  const availableCash = treasury.cash + statement.cashFlow;

  if (availableCash >= 0) {
    const repayment = Math.min(treasury.creditLine.drawn, availableCash);
    const nextTreasury: TreasuryState = {
      cash: availableCash - repayment,
      creditLine: { ...treasury.creditLine, drawn: treasury.creditLine.drawn - repayment },
      consecutiveUnmetShortfallMonths: 0,
      isInsolvent: false,
    };
    return {
      business: { ...business, treasury: nextTreasury },
      outcome:
        repayment > 0
          ? { kind: "credit-repaid", amount: repayment }
          : { kind: "covered-by-cash", amount: availableCash },
    };
  }

  const financingNeed = -availableCash;
  const roomLeft = treasury.creditLine.limit - treasury.creditLine.drawn;
  const draw = Math.max(0, Math.min(financingNeed, roomLeft));
  const remainingShortfall = financingNeed - draw;
  const creditLine: CreditLineState = { ...treasury.creditLine, drawn: treasury.creditLine.drawn + draw };

  if (remainingShortfall <= 0) {
    const nextTreasury: TreasuryState = {
      cash: 0,
      creditLine,
      consecutiveUnmetShortfallMonths: 0,
      isInsolvent: false,
    };
    return {
      business: { ...business, treasury: nextTreasury },
      outcome: { kind: "covered-by-credit-draw", amount: draw },
    };
  }

  const consecutiveUnmetShortfallMonths = treasury.consecutiveUnmetShortfallMonths + 1;
  const isInsolvent = consecutiveUnmetShortfallMonths >= INSOLVENCY_THRESHOLD_MONTHS;
  const nextTreasury: TreasuryState = {
    cash: 0,
    creditLine,
    consecutiveUnmetShortfallMonths,
    isInsolvent,
  };
  return {
    business: { ...business, treasury: nextTreasury },
    outcome: isInsolvent
      ? { kind: "insolvent", amount: remainingShortfall }
      : { kind: "shortfall-unmet", amount: remainingShortfall },
  };
}

/**
 * Apport de capital externe (personnel ou tiers) directement en trésorerie
 * — le levier "entreprise sauvée par apport" de la spec. N'affecte jamais la
 * ligne de crédit : c'est un financement en fonds propres, pas de la dette.
 */
export function injectCapital(business: BusinessState, amount: number): BusinessState {
  if (amount < 0) {
    throw new RangeError(`injectCapital: amount=${amount} doit être >= 0.`);
  }
  return { ...business, treasury: { ...business.treasury, cash: business.treasury.cash + amount } };
}
