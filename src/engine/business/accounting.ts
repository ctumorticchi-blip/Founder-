import type {
  EconomicContribution,
  MonthlyFinancialStatement,
  MonthlyFinancialStatementInputs,
} from "../../types/business.js";

/**
 * Additionne les contributions de plusieurs moteurs économiques
 * (spec §3.8, composabilité — ex. Retail + Subscription pour une même
 * entreprise) sur la structure comptable commune.
 */
export function consolidateContributions(
  contributions: readonly EconomicContribution[],
): EconomicContribution {
  return contributions.reduce<EconomicContribution>(
    (acc, contribution) => ({
      revenue: acc.revenue + contribution.revenue,
      variableCosts: acc.variableCosts + contribution.variableCosts,
    }),
    { revenue: 0, variableCosts: 0 },
  );
}

const NON_NEGATIVE_FIELDS = [
  "revenue",
  "variableCosts",
  "payroll",
  "marketing",
  "rent",
  "admin",
  "depreciation",
  "interest",
  "capex",
] as const satisfies ReadonlyArray<keyof MonthlyFinancialStatementInputs>;

function validateInputs(inputs: MonthlyFinancialStatementInputs): void {
  for (const field of NON_NEGATIVE_FIELDS) {
    const value = inputs[field];
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`computeMonthlyFinancials: ${field}=${value} doit être un nombre >= 0.`);
    }
  }
  if (!Number.isFinite(inputs.taxRate) || inputs.taxRate < 0 || inputs.taxRate > 1) {
    throw new RangeError(`computeMonthlyFinancials: taxRate=${inputs.taxRate} doit être dans [0, 1].`);
  }
  if (!Number.isFinite(inputs.workingCapitalChange)) {
    throw new RangeError("computeMonthlyFinancials: workingCapitalChange doit être un nombre fini.");
  }
}

/**
 * Assemble le compte de résultat mensuel consolidé et son cash-flow
 * (spec §6). Fonction pure : aucune donnée hors `inputs` n'influence le
 * résultat.
 *
 * Chaîne de calcul :
 *   grossMargin = revenue - variableCosts
 *   ebitda      = grossMargin - payroll - marketing - rent - admin
 *   ebt         = ebitda - depreciation - interest
 *   taxes       = max(ebt, 0) * taxRate   (pas de crédit d'impôt sur perte en P0)
 *   netIncome   = ebt - taxes
 *   cashFlow    = netIncome + depreciation - capex - workingCapitalChange
 */
export function computeMonthlyFinancials(
  inputs: MonthlyFinancialStatementInputs,
): MonthlyFinancialStatement {
  validateInputs(inputs);

  const grossMargin = inputs.revenue - inputs.variableCosts;
  const ebitda = grossMargin - inputs.payroll - inputs.marketing - inputs.rent - inputs.admin;
  const ebt = ebitda - inputs.depreciation - inputs.interest;
  const taxes = ebt > 0 ? ebt * inputs.taxRate : 0;
  const netIncome = ebt - taxes;
  const cashFlow =
    netIncome + inputs.depreciation - inputs.capex - inputs.workingCapitalChange;

  return {
    revenue: inputs.revenue,
    variableCosts: inputs.variableCosts,
    grossMargin,
    payroll: inputs.payroll,
    marketing: inputs.marketing,
    rent: inputs.rent,
    admin: inputs.admin,
    ebitda,
    depreciation: inputs.depreciation,
    interest: inputs.interest,
    ebt,
    taxes,
    netIncome,
    capex: inputs.capex,
    workingCapitalChange: inputs.workingCapitalChange,
    cashFlow,
  };
}
