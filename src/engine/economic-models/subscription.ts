import { clamp } from "../util/math.js";
import type { EconomicEngine, EconomicEngineContext } from "./economic-engine.js";
import type { EconomicContribution } from "../../types/business.js";

/**
 * Famille "Subscription" (spec §7) : SaaS, abonnement. Contrairement aux
 * autres familles, cette famille a une vraie dynamique inter-mois (churn) :
 * `computeMonth` reste pure (ne mute rien) mais retourne `endingSubscribers`,
 * que l'appelant doit reporter dans `activeSubscribers` du `state` du mois
 * suivant. C'est l'appelant (Business Engine / orchestrateur, milestone M5)
 * qui possède la persistance de l'état, jamais le moteur lui-même.
 */
export interface SubscriptionEngineState {
  readonly activeSubscribers: number;
  /** Revenu moyen par abonné et par mois (ARPU). */
  readonly arpu: number;
  /** Taux de résiliation mensuel de base, 0-1 (avant bruit). */
  readonly churnRate: number;
  /** Part du revenu consommée par les coûts variables (hébergement, support...), 0-1. */
  readonly cogsRatio: number;
}

export interface SubscriptionEngineDecisions {
  /** Nouveaux abonnés acquis ce mois (résultat de l'effort d'acquisition / CAC en amont). */
  readonly newSubscribers: number;
}

export interface SubscriptionMonthContribution extends EconomicContribution {
  readonly churnedSubscribers: number;
  readonly endingSubscribers: number;
}

const CHURN_NOISE_STD_DEV = 0.01;

function computeSubscriptionMonth(
  state: SubscriptionEngineState,
  decisions: SubscriptionEngineDecisions,
  ctx: EconomicEngineContext,
): SubscriptionMonthContribution {
  if (state.activeSubscribers < 0) {
    throw new RangeError(`SubscriptionEngine: activeSubscribers=${state.activeSubscribers} doit être >= 0.`);
  }
  if (decisions.newSubscribers < 0) {
    throw new RangeError(`SubscriptionEngine: newSubscribers=${decisions.newSubscribers} doit être >= 0.`);
  }
  if (state.churnRate < 0 || state.churnRate > 1) {
    throw new RangeError(`SubscriptionEngine: churnRate=${state.churnRate} doit être dans [0, 1].`);
  }
  if (state.cogsRatio < 0 || state.cogsRatio > 1) {
    throw new RangeError(`SubscriptionEngine: cogsRatio=${state.cogsRatio} doit être dans [0, 1].`);
  }

  const noise = ctx.rng.nextGaussian(0, CHURN_NOISE_STD_DEV);
  const effectiveChurnRate = clamp(state.churnRate + noise, 0, 1);
  const churnedSubscribers = state.activeSubscribers * effectiveChurnRate;
  const endingSubscribers = Math.max(
    0,
    state.activeSubscribers - churnedSubscribers + decisions.newSubscribers,
  );
  const revenue = state.activeSubscribers * state.arpu;

  return {
    revenue,
    variableCosts: revenue * state.cogsRatio,
    churnedSubscribers,
    endingSubscribers,
  };
}

export const SubscriptionEngine: EconomicEngine<SubscriptionEngineState, SubscriptionEngineDecisions> = {
  family: "subscription",
  computeMonth: computeSubscriptionMonth,
};
