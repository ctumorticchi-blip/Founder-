import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Hospitality" (spec §7) : café, restaurant. Capacité exprimée en
 * couverts disponibles sur le mois (places * rotations * jours ouvrés).
 * `expectedDemandCovers` est déjà la demande RÉELLEMENT captée par le
 * Demand Engine (`computeOfferDemand` + `computeRepeatDemand`, spec
 * M11.2.2/M11.2.3.1) : ce moteur ne fait plus que la comparer à la
 * capacité — aucune seconde conversion commerciale (réputation/bruit) ne
 * doit plus réduire une demande déjà captée (spec M11.2.3.2 §1, §3).
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
  /** Métrique descriptive (`coversServed / coversCapacity`) — ne pilote plus jamais `coversServed` (spec M11.2.3.2 §3, §11). */
  readonly fillRate: number;
}

export function computeHospitalityMonth(
  state: HospitalityEngineState,
  decisions: HospitalityEngineDecisions,
  _ctx: EconomicEngineContext,
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

  const coversServed = Math.min(decisions.expectedDemandCovers, decisions.coversCapacity);
  const fillRate = decisions.coversCapacity > 0 ? coversServed / decisions.coversCapacity : 0;

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
