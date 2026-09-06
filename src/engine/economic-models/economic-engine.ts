import type { Rng } from "../rng/rng.js";
import type { EconomicContribution, EconomicFamily } from "../../types/business.js";

/** Contexte fourni à chaque moteur économique pour un mois donné. */
export interface EconomicEngineContext {
  /** RNG déjà dérivé (voir engine/rng deriveSeed/fork) pour ce mois et cette entreprise. */
  readonly rng: Rng;
}

/**
 * Interface commune à toutes les familles économiques (spec §7). Chaque
 * implémentation ne connaît que son propre état et ses propres décisions ;
 * elle ne produit que `revenue`/`variableCosts` (spec §3.9 : les lignes
 * transversales sont ajoutées une seule fois, au niveau du Business Engine).
 */
export interface EconomicEngine<TState, TDecisions> {
  readonly family: EconomicFamily;
  computeMonth(state: TState, decisions: TDecisions, ctx: EconomicEngineContext): EconomicContribution;
}
