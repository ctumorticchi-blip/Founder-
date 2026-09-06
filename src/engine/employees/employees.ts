import { clamp } from "../util/math.js";
import type { HeadcountAdjustmentResult, WorkforceState } from "../../types/employees.js";

/** Heures de travail mensuelles d'un équivalent temps plein (aligné sur le budget de temps du personnage). */
export const HOURS_PER_EMPLOYEE_PER_MONTH = 140;

/** Bonus de productivité maximal apporté par un management/leadership fondateur excellent (compétence 100). */
const LEADERSHIP_PRODUCTIVITY_MAX_BONUS = 0.3;

/** Coût de recrutement/licenciement par tête, exprimé en mois de salaire (heuristique simple pour le P0). */
const RECRUITMENT_COST_MONTHS_OF_SALARY = 1;
const SEVERANCE_COST_MONTHS_OF_SALARY = 1;

export function createWorkforce(averageMonthlySalary: number): WorkforceState {
  if (averageMonthlySalary < 0) {
    throw new RangeError(`createWorkforce: averageMonthlySalary=${averageMonthlySalary} doit être >= 0.`);
  }
  return { headcount: 0, averageMonthlySalary };
}

/**
 * Ajuste l'effectif vers `targetHeadcount` (recrutement si en dessous,
 * licenciement si au-dessus). Fonction pure : ne facture rien elle-même,
 * elle retourne les coûts ponctuels pour que l'appelant les intègre au
 * compte de résultat du mois (spec : "coût réel d'une embauche").
 */
export function adjustHeadcount(workforce: WorkforceState, targetHeadcount: number): HeadcountAdjustmentResult {
  if (targetHeadcount < 0) {
    throw new RangeError(`adjustHeadcount: targetHeadcount=${targetHeadcount} doit être >= 0.`);
  }
  const delta = targetHeadcount - workforce.headcount;
  const hired = Math.max(0, delta);
  const fired = Math.max(0, -delta);
  return {
    workforce: { ...workforce, headcount: targetHeadcount },
    hired,
    fired,
    recruitmentCost: hired * workforce.averageMonthlySalary * RECRUITMENT_COST_MONTHS_OF_SALARY,
    severanceCost: fired * workforce.averageMonthlySalary * SEVERANCE_COST_MONTHS_OF_SALARY,
  };
}

/** Masse salariale récurrente du mois (hors coûts ponctuels de recrutement/licenciement). */
export function computePayrollCost(workforce: WorkforceState): number {
  return workforce.headcount * workforce.averageMonthlySalary;
}

function productivityFactor(founderLeadershipSkill0To100: number): number {
  const skillFactor = clamp(founderLeadershipSkill0To100 / 100, 0, 1);
  return 1 + skillFactor * LEADERSHIP_PRODUCTIVITY_MAX_BONUS;
}

/**
 * Heures de production apportées par l'effectif (spec : "productivité",
 * "effet du management/leadership du fondateur"). Un meilleur leadership
 * augmente la production par tête, sans jamais dépasser
 * `1 + LEADERSHIP_PRODUCTIVITY_MAX_BONUS`.
 */
export function computeWorkforceCapacityHours(
  workforce: WorkforceState,
  founderLeadershipSkill0To100: number,
): number {
  return workforce.headcount * HOURS_PER_EMPLOYEE_PER_MONTH * productivityFactor(founderLeadershipSkill0To100);
}

/** Effectif nécessaire pour produire `requiredHours` d'heures de production, compte tenu du leadership du fondateur. */
export function computeRequiredHeadcountForHours(
  requiredHours: number,
  founderLeadershipSkill0To100: number,
): number {
  if (requiredHours < 0) {
    throw new RangeError(`computeRequiredHeadcountForHours: requiredHours=${requiredHours} doit être >= 0.`);
  }
  return requiredHours / (HOURS_PER_EMPLOYEE_PER_MONTH * productivityFactor(founderLeadershipSkill0To100));
}

/**
 * Ratio effectif réel / effectif requis, 0-1+ : < 1 = sous-effectif
 * (capacité insuffisante), > 1 = sur-effectif (masse salariale gaspillée,
 * déjà pénalisée côté comptabilité sans bonus de revenu supplémentaire).
 */
export function computeStaffingRatio(actualHeadcount: number, requiredHeadcount: number): number {
  if (requiredHeadcount <= 0) {
    return actualHeadcount > 0 ? Number.POSITIVE_INFINITY : 1;
  }
  return actualHeadcount / requiredHeadcount;
}
