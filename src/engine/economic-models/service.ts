import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Service" (spec §7) : nettoyage, entretien, sécurité, etc. Le
 * modèle vend des heures de main-d'œuvre. `targetHours` est déjà la
 * demande RÉELLEMENT captée par le Demand Engine (`computeOfferDemand` +
 * `computeRepeatDemand`, spec M11.2.2/M11.2.3.1) : ce moteur ne fait plus
 * que la comparer à la capacité physique — aucune seconde conversion
 * commerciale (réputation/bruit) ne doit plus réduire une demande déjà
 * captée (spec M11.2.3.2 §1-§2).
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
  /** Métrique descriptive (`hoursSold / capacityHours`) — ne pilote plus jamais `hoursSold` (spec M11.2.3.2 §2, §11). */
  readonly utilizationRate: number;
}

export function computeServiceMonth(
  state: ServiceEngineState,
  decisions: ServiceEngineDecisions,
  _ctx: EconomicEngineContext,
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

  const hoursSold = Math.min(decisions.targetHours, decisions.capacityHours);
  const utilizationRate = decisions.capacityHours > 0 ? hoursSold / decisions.capacityHours : 0;

  return {
    revenue: hoursSold * state.hourlyRate,
    variableCosts: hoursSold * state.costPerLaborHour,
    hoursSold,
    utilizationRate,
  };
}

export const ServiceEngine: EconomicEngine<ServiceEngineState, ServiceEngineDecisions, ServiceMonthContribution> = {
  family: "service",
  computeMonth: computeServiceMonth,
};
