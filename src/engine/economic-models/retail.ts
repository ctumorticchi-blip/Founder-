import { clamp } from "../util/math.js";
import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Retail" (spec §7) : fleuriste, épicerie, boutique. Le modèle vend
 * des unités de stock ; la demande captée dépend du trafic et d'un taux de
 * conversion piloté par la réputation. Le stock non vendu n'est pas un coût
 * en P0 (pas de valorisation de stock/dépréciation dédiée) — simplification
 * assumée, à revoir si un jour le P0 modélise l'invendu comme une perte.
 */
export interface RetailEngineState {
  readonly unitPrice: number;
  readonly unitCostOfGoods: number;
  readonly reputationScore: number;
}

export interface RetailEngineDecisions {
  /** Unités disponibles à la vente ce mois (stock acheté/produit). */
  readonly stockUnits: number;
  /** Trafic attendu (nombre de clients potentiels ce mois). */
  readonly expectedFootTraffic: number;
}

export interface RetailMonthContribution extends EconomicContribution {
  readonly unitsSold: number;
  readonly conversionRate: number;
}

const BASE_CONVERSION_RATE = 0.2;
const REPUTATION_CONVERSION_BONUS = 0.3;
const CONVERSION_NOISE_STD_DEV = 0.03;

function computeRetailMonth(
  state: RetailEngineState,
  decisions: RetailEngineDecisions,
  ctx: EconomicEngineContext,
): RetailMonthContribution {
  if (decisions.stockUnits < 0) {
    throw new RangeError(`RetailEngine: stockUnits=${decisions.stockUnits} doit être >= 0.`);
  }
  if (decisions.expectedFootTraffic < 0) {
    throw new RangeError(
      `RetailEngine: expectedFootTraffic=${decisions.expectedFootTraffic} doit être >= 0.`,
    );
  }
  if (state.reputationScore < 0 || state.reputationScore > 1) {
    throw new RangeError(`RetailEngine: reputationScore=${state.reputationScore} doit être dans [0, 1].`);
  }

  const baseConversion = BASE_CONVERSION_RATE + state.reputationScore * REPUTATION_CONVERSION_BONUS;
  const noise = ctx.rng.nextGaussian(0, CONVERSION_NOISE_STD_DEV);
  const conversionRate = clamp(baseConversion + noise, 0, 1);
  const demand = decisions.expectedFootTraffic * conversionRate;
  const unitsSold = Math.min(demand, decisions.stockUnits);

  return {
    revenue: unitsSold * state.unitPrice,
    variableCosts: unitsSold * state.unitCostOfGoods,
    unitsSold,
    conversionRate,
  };
}

export const RetailEngine: EconomicEngine<RetailEngineState, RetailEngineDecisions, RetailMonthContribution> = {
  family: "retail",
  computeMonth: computeRetailMonth,
};
