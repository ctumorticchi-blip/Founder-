import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Agency/B2B" (spec §7) : marketing, recrutement, conseil. Revenus
 * par mandats plutôt qu'à l'unité produite. `targetMandates` est déjà la
 * demande RÉELLEMENT captée par le Demand Engine (`computeOfferDemand` +
 * `computeRepeatDemand`, spec M11.2.2/M11.2.3.1) : ce moteur ne fait plus
 * que la comparer à la capacité livrable — aucune seconde probabilité
 * commerciale (réputation/compétence/bruit) ne doit plus réduire une
 * demande déjà captée (spec M11.2.3.2 §1, §4). `skillFactor` (0-1 —
 * reflet des compétences du personnage, fournies par l'appelant tant que
 * le Character Engine n'est pas branché directement au moteur économique)
 * reste dans l'état pour un futur rôle (négociation, Strategic Accounts,
 * hors scope M11.2.4) mais ne pilote plus l'exécution ici.
 */
export interface AgencyEngineState {
  readonly averageMonthlyFeePerMandate: number;
  /** Part du fee qui est un coût variable de livraison (sous-traitance, etc.), 0-1. */
  readonly deliveryCostRatio: number;
  readonly reputationScore: number;
  readonly skillFactor: number;
}

export interface AgencyEngineDecisions {
  /** Nombre de mandats livrables ce mois (fonction des heures de l'équipe). */
  readonly capacityMandates: number;
  /** Nombre de mandats visés par le développement commercial ce mois. */
  readonly targetMandates: number;
}

export interface AgencyMonthContribution extends EconomicContribution {
  readonly wonMandates: number;
  /** Métrique descriptive (`wonMandates / capacityMandates`) — ne pilote plus jamais `wonMandates` (spec M11.2.3.2 §4, §11). */
  readonly winRate: number;
}

function computeAgencyMonth(
  state: AgencyEngineState,
  decisions: AgencyEngineDecisions,
  _ctx: EconomicEngineContext,
): AgencyMonthContribution {
  if (decisions.capacityMandates < 0) {
    throw new RangeError(`AgencyEngine: capacityMandates=${decisions.capacityMandates} doit être >= 0.`);
  }
  if (decisions.targetMandates < 0) {
    throw new RangeError(`AgencyEngine: targetMandates=${decisions.targetMandates} doit être >= 0.`);
  }
  if (state.reputationScore < 0 || state.reputationScore > 1) {
    throw new RangeError(`AgencyEngine: reputationScore=${state.reputationScore} doit être dans [0, 1].`);
  }
  if (state.skillFactor < 0 || state.skillFactor > 1) {
    throw new RangeError(`AgencyEngine: skillFactor=${state.skillFactor} doit être dans [0, 1].`);
  }
  if (state.deliveryCostRatio < 0 || state.deliveryCostRatio > 1) {
    throw new RangeError(
      `AgencyEngine: deliveryCostRatio=${state.deliveryCostRatio} doit être dans [0, 1].`,
    );
  }

  const wonMandates = Math.min(decisions.targetMandates, decisions.capacityMandates);
  const winRate = decisions.capacityMandates > 0 ? wonMandates / decisions.capacityMandates : 0;
  const revenue = wonMandates * state.averageMonthlyFeePerMandate;

  return {
    revenue,
    variableCosts: revenue * state.deliveryCostRatio,
    wonMandates,
    winRate,
  };
}

export const AgencyEngine: EconomicEngine<AgencyEngineState, AgencyEngineDecisions, AgencyMonthContribution> = {
  family: "agency",
  computeMonth: computeAgencyMonth,
};
