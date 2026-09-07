import type { BusinessState, EconomicFamily, MonthlyFinancialStatement } from "../../types/business.js";
import type { WorkforceState } from "../../types/employees.js";
import type { ValuationFactor, ValuationResult } from "../../types/valuation.js";

/**
 * Multiple d'EBITDA annualisé par famille (spec M11.1.5 §6.1) : les
 * revenus récurrents (subscription, agency) valent structurellement plus
 * qu'un commerce à actifs physiques et marges fines (retail, hospitality).
 * Ordres de grandeur plausibles, pas un modèle de banque d'affaires.
 */
const FAMILY_EBITDA_MULTIPLE: Readonly<Record<EconomicFamily, number>> = {
  subscription: 4.5,
  agency: 3.5,
  service: 3.0,
  retail: 2.0,
  hospitality: 1.8,
};

/** Multiple de repli sur le CA annualisé quand l'EBITDA est négatif ou nul (très inférieur au multiple d'EBITDA). */
const UNPROFITABLE_REVENUE_MULTIPLE_FACTOR = 0.3;

/** Bonus de valeur par tête de salarié (équipe formée = actif, même heuristique simple). */
const TEAM_VALUE_PER_HEADCOUNT_MONTHS_OF_SALARY = 3;

function riskDiscount(treasury: BusinessState["treasury"]): number {
  if (treasury.isInsolvent) return 0.05;
  if (treasury.unpaidObligations > 0) return 0.6;
  return 1;
}

function primaryFamily(business: BusinessState): EconomicFamily {
  return business.families[0] ?? "service";
}

function netDebt(business: BusinessState): number {
  const propertyDebt = business.properties.reduce((sum, property) => sum + (property.mortgage?.principalRemaining ?? 0), 0);
  return business.treasury.creditLine.drawn + business.treasury.unpaidObligations + propertyDebt;
}

/**
 * Valorisation déterministe d'une entreprise (spec M11.1.5 §6.1) : pas de
 * modèle de banque d'affaires sophistiqué, mais une fourchette explicable
 * facteur par facteur. `statement: null` (aucun mois résolu) => valorisation
 * nulle, une entreprise qui n'a jamais tourné n'a pas d'historique à
 * valoriser en V1 (limite assumée, documentée dans la spec).
 */
export function computeValuation(
  business: BusinessState,
  statement: MonthlyFinancialStatement | null,
  workforce: WorkforceState,
): ValuationResult {
  if (!statement) {
    return {
      low: 0,
      mid: 0,
      high: 0,
      factors: [{ label: "Aucun mois d'activité résolu — pas encore d'historique à valoriser", amount: 0 }],
    };
  }

  const family = primaryFamily(business);
  const discount = riskDiscount(business.treasury);

  const profitabilityBase =
    statement.ebitda > 0
      ? statement.ebitda * 12 * FAMILY_EBITDA_MULTIPLE[family]
      : statement.revenue * 12 * FAMILY_EBITDA_MULTIPLE[family] * UNPROFITABLE_REVENUE_MULTIPLE_FACTOR;
  const profitabilityTerm = profitabilityBase * discount;

  const netCashPositionTerm = business.treasury.cash - netDebt(business);

  const teamValueTerm = workforce.headcount * workforce.averageMonthlySalary * TEAM_VALUE_PER_HEADCOUNT_MONTHS_OF_SALARY;

  const rawMid = profitabilityTerm + netCashPositionTerm + teamValueTerm;
  const mid = Math.max(0, rawMid);

  const factors: ValuationFactor[] = [
    { label: `Rentabilité annualisée (${family}, ajustée du risque)`, amount: profitabilityTerm },
    { label: "Trésorerie nette (cash − dettes)", amount: netCashPositionTerm },
    { label: "Valeur de l'équipe en place", amount: teamValueTerm },
  ];
  if (rawMid < 0) {
    factors.push({ label: "Plancher de valorisation (jamais négative)", amount: mid - rawMid });
  }

  const spreadFactor = discount < 1 ? 0.4 : 0.25;
  const low = Math.max(0, mid * (1 - spreadFactor));
  const high = mid * (1 + spreadFactor);

  return { low, mid, high, factors };
}
