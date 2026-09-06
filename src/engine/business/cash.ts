import type { BusinessState, MonthlyFinancialStatement } from "../../types/business.js";

export function createBusiness(
  name: string,
  families: readonly BusinessState["families"][number][],
): BusinessState {
  if (families.length === 0) {
    throw new RangeError("createBusiness: une entreprise doit activer au moins une famille économique.");
  }
  return {
    name,
    families,
    cash: 0,
    consecutiveNegativeCashMonths: 0,
  };
}

/**
 * Applique le cash-flow d'un mois à la trésorerie de l'entreprise et met à
 * jour le compteur de mois consécutifs à trésorerie négative. Ce compteur
 * est le signal exigé par la spec §3.7 : une éventuelle liquidation forcée
 * (milestone ultérieur) devra se baser dessus, jamais sur un seul mois
 * négatif isolé.
 */
export function applyCashFlow(
  business: BusinessState,
  statement: MonthlyFinancialStatement,
): BusinessState {
  const cash = business.cash + statement.cashFlow;
  const consecutiveNegativeCashMonths =
    cash < 0 ? business.consecutiveNegativeCashMonths + 1 : 0;
  return { ...business, cash, consecutiveNegativeCashMonths };
}
