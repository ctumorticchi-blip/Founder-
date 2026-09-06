import { clamp } from "../util/math.js";
import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Hospitality" (spec §7) : café, restaurant. Capacité exprimée en
 * couverts disponibles sur le mois (places * rotations * jours ouvrés) ;
 * la demande captée dépend de la réputation, comme pour Retail/Service.
 */
export interface HospitalityEngineState {
  readonly averageTicketPrice: number;
  readonly foodCostPerCover: number;
  readonly reputationScore: number;
}

export interface HospitalityEngineDecisions {
  /** Couverts servables ce mois (places * rotations * jours ouvrés). */
  readonly coversCapacity: number;
  /** Couverts attendus si la capacité n'était pas contrainte. */
  readonly expectedDemandCovers: number;
}

export interface HospitalityMonthContribution extends EconomicContribution {
  readonly coversServed: number;
  readonly fillRate: number;
}

const BASE_FILL_RATE = 0.45;
const REPUTATION_FILL_RATE_BONUS = 0.4;
const FILL_RATE_NOISE_STD_DEV = 0.05;

export function computeHospitalityMonth(
  state: HospitalityEngineState,
  decisions: HospitalityEngineDecisions,
  ctx: EconomicEngineContext,
): HospitalityMonthContribution {
  if (decisions.coversCapacity < 0) {
    throw new RangeError(`HospitalityEngine: coversCapacity=${decisions.coversCapacity} doit être >= 0.`);
  }
  if (decisions.expectedDemandCovers < 0) {
    throw new RangeError(
      `HospitalityEngine: expectedDemandCovers=${decisions.expectedDemandCovers} doit être >= 0.`,
    );
  }
  if (state.reputationScore < 0 || state.reputationScore > 1) {
    throw new RangeError(
      `HospitalityEngine: reputationScore=${state.reputationScore} doit être dans [0, 1].`,
    );
  }

  const demandCap = Math.min(decisions.expectedDemandCovers, decisions.coversCapacity);
  const baseFillRate = BASE_FILL_RATE + state.reputationScore * REPUTATION_FILL_RATE_BONUS;
  const noise = ctx.rng.nextGaussian(0, FILL_RATE_NOISE_STD_DEV);
  const fillRate = clamp(baseFillRate + noise, 0, 1);
  const coversServed = demandCap * fillRate;

  return {
    revenue: coversServed * state.averageTicketPrice,
    variableCosts: coversServed * state.foodCostPerCover,
    coversServed,
    fillRate,
  };
}

export const HospitalityEngine: EconomicEngine<HospitalityEngineState, HospitalityEngineDecisions, HospitalityMonthContribution> = {
  family: "hospitality",
  computeMonth: computeHospitalityMonth,
};
