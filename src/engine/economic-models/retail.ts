import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Retail" (spec §7) : fleuriste, épicerie, boutique. Le modèle vend
 * des unités de stock. `expectedFootTraffic` est déjà la demande
 * RÉELLEMENT captée par le Demand Engine (`computeOfferDemand` +
 * `computeRepeatDemand`, spec M11.2.2/M11.2.3.1) — malgré son nom hérité
 * (interface publique inchangée, spec M11.2.3.2 §11), ce n'est plus un
 * simple trafic brut à reconvertir : ce moteur ne fait plus que le
 * comparer au stock disponible — aucune seconde conversion commerciale
 * (réputation/bruit) ne doit plus réduire une demande déjà captée avant
 * même la comparaison à la contrainte physique (spec §1, §5). Le stock non
 * vendu n'est pas un coût en P0 (pas de valorisation de stock/dépréciation
 * dédiée) — simplification assumée, à revoir si un jour le P0 modélise
 * l'invendu comme une perte.
 */
export interface RetailEngineState {
  readonly unitPrice: number;
  readonly unitCostOfGoods: number;
  readonly reputationScore: number;
}

export interface RetailEngineDecisions {
  /** Unités disponibles à la vente ce mois (stock acheté/produit). */
  readonly stockUnits: number;
  /** Demande déjà captée par le Demand Engine ce mois (nombre de clients qui veulent réellement acheter). */
  readonly expectedFootTraffic: number;
}

export interface RetailMonthContribution extends EconomicContribution {
  readonly unitsSold: number;
  /** Métrique descriptive (`unitsSold / stockUnits`) — ne pilote plus jamais `unitsSold` (spec M11.2.3.2 §5, §11). */
  readonly conversionRate: number;
}

function computeRetailMonth(
  state: RetailEngineState,
  decisions: RetailEngineDecisions,
  _ctx: EconomicEngineContext,
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

  const unitsSold = Math.min(decisions.expectedFootTraffic, decisions.stockUnits);
  const conversionRate = decisions.stockUnits > 0 ? unitsSold / decisions.stockUnits : 0;

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
