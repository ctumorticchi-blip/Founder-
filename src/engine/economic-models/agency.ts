import { clamp } from "../util/math.js";
import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Agency/B2B" (spec §7) : marketing, recrutement, conseil. Revenus
 * par mandats plutôt qu'à l'unité produite ; le taux de transformation des
 * mandats visés dépend fortement de la réputation et de la compétence de
 * l'équipe (`skillFactor`, 0-1 — reflet des compétences du personnage,
 * fournies par l'appelant tant que le Character Engine n'est pas branché
 * directement au moteur économique).
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
  readonly winRate: number;
}

const BASE_WIN_RATE = 0.3;
const REPUTATION_WIN_RATE_BONUS = 0.25;
const SKILL_WIN_RATE_BONUS = 0.25;
const WIN_RATE_NOISE_STD_DEV = 0.05;

function computeAgencyMonth(
  state: AgencyEngineState,
  decisions: AgencyEngineDecisions,
  ctx: EconomicEngineContext,
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

  const demandCap = Math.min(decisions.targetMandates, decisions.capacityMandates);
  const baseWinRate =
    BASE_WIN_RATE + state.reputationScore * REPUTATION_WIN_RATE_BONUS + state.skillFactor * SKILL_WIN_RATE_BONUS;
  const noise = ctx.rng.nextGaussian(0, WIN_RATE_NOISE_STD_DEV);
  const winRate = clamp(baseWinRate + noise, 0, 1);
  const wonMandates = demandCap * winRate;
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
