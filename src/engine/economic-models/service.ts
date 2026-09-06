import { clamp } from "../util/math.js";
import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Service" (spec §7) : nettoyage, entretien, sécurité, etc. Le
 * modèle vend des heures de main-d'œuvre. Tant que le Market Engine et le
 * Competition Engine ne sont pas branchés (milestone M4), le taux de
 * remplissage de la capacité est un modèle simplifié piloté par la
 * réputation + un bruit RNG — il sera remplacé par une vraie résolution de
 * demande de marché en M4/M5, sans changer la forme de cette interface.
 */
export interface ServiceEngineState {
  /** Prix facturé par heure de service. */
  readonly hourlyRate: number;
  /** Coût variable (matériel/consommables) par heure travaillée. */
  readonly costPerLaborHour: number;
  /** Réputation de l'activité, 0-1. Améliore le taux de remplissage de la capacité. */
  readonly reputationScore: number;
}

export interface ServiceEngineDecisions {
  /** Heures de main-d'œuvre disponibles ce mois (temps du joueur + employés). */
  readonly capacityHours: number;
  /** Heures que le joueur cherche à vendre ce mois (démarchage commercial). */
  readonly targetHours: number;
}

export interface ServiceMonthContribution extends EconomicContribution {
  readonly hoursSold: number;
  readonly utilizationRate: number;
}

const BASE_UTILIZATION = 0.5;
const REPUTATION_UTILIZATION_BONUS = 0.4;
const UTILIZATION_NOISE_STD_DEV = 0.05;

export function computeServiceMonth(
  state: ServiceEngineState,
  decisions: ServiceEngineDecisions,
  ctx: EconomicEngineContext,
): ServiceMonthContribution {
  if (decisions.capacityHours < 0) {
    throw new RangeError(`ServiceEngine: capacityHours=${decisions.capacityHours} doit être >= 0.`);
  }
  if (decisions.targetHours < 0) {
    throw new RangeError(`ServiceEngine: targetHours=${decisions.targetHours} doit être >= 0.`);
  }
  if (state.reputationScore < 0 || state.reputationScore > 1) {
    throw new RangeError(`ServiceEngine: reputationScore=${state.reputationScore} doit être dans [0, 1].`);
  }

  const demandCap = Math.min(decisions.targetHours, decisions.capacityHours);
  const baseUtilization = BASE_UTILIZATION + state.reputationScore * REPUTATION_UTILIZATION_BONUS;
  const noise = ctx.rng.nextGaussian(0, UTILIZATION_NOISE_STD_DEV);
  const utilizationRate = clamp(baseUtilization + noise, 0, 1);
  const hoursSold = demandCap * utilizationRate;

  return {
    revenue: hoursSold * state.hourlyRate,
    variableCosts: hoursSold * state.costPerLaborHour,
    hoursSold,
    utilizationRate,
  };
}

export const ServiceEngine: EconomicEngine<ServiceEngineState, ServiceEngineDecisions> = {
  family: "service",
  computeMonth: computeServiceMonth,
};
