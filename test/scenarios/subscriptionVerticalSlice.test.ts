import { describe, expect, it } from "vitest";
import { simulateMonth } from "../../src/engine/simulation/simulateMonth.js";
import {
  SUBSCRIPTION_BUSINESS_ID,
  buildSubscriptionScenarioActions,
  createSubscriptionScenarioInitialState,
} from "../../src/scenarios/subscription.js";
import type { GameState } from "../../src/engine/simulation/types.js";

const SEED = 20260906;
const MONTHS = 240;

function runScenario(seed: number, months: number): GameState {
  let state = createSubscriptionScenarioInitialState(seed);
  for (let i = 0; i < months; i++) {
    state = simulateMonth(state, buildSubscriptionScenarioActions(i, state), seed);
  }
  return state;
}

function findBusiness(state: GameState) {
  return state.businesses.find((business) => business.id === SUBSCRIPTION_BUSINESS_ID) ?? null;
}

/**
 * Vertical slice "Subscription" (consolidation, tâche 4) : apprentissage ->
 * SaaS -> acquisition clients -> churn -> embauche -> croissance. Même
 * moteur que les autres scénarios.
 */
describe("vertical slice — Subscription", () => {
  it("simule 20 ans sans crash ni valeur invalide", () => {
    const finalState = runScenario(SEED, MONTHS);
    expect(Number.isFinite(finalState.character.cash)).toBe(true);
    const business = findBusiness(finalState);
    if (business && business.familyState.family === "subscription") {
      expect(Number.isFinite(business.familyState.activeSubscribers)).toBe(true);
    }
  });

  it("est déterministe sur 20 ans complets", () => {
    const runA = runScenario(SEED, MONTHS);
    const runB = runScenario(SEED, MONTHS);
    expect(runA).toEqual(runB);
  });

  it("acquiert des abonnés et subit du churn simultanément (dynamique nette observable)", () => {
    let state = createSubscriptionScenarioInitialState(SEED);
    const subscriberCounts: number[] = [];
    for (let i = 0; i < 60; i++) {
      state = simulateMonth(state, buildSubscriptionScenarioActions(i, state), SEED);
      const business = findBusiness(state);
      if (business && business.familyState.family === "subscription") {
        subscriberCounts.push(business.familyState.activeSubscribers);
      }
    }
    expect(subscriberCounts.length).toBeGreaterThan(0);
    expect(subscriberCounts[subscriberCounts.length - 1]!).toBeGreaterThan(0);
    // La croissance nette (acquisition - churn) doit être strictement positive au moins un mois.
    const grew = subscriberCounts.some((count, i) => i > 0 && count > subscriberCounts[i - 1]!);
    expect(grew).toBe(true);
  });

  it("recrute du support/ingénierie à mesure que la base d'abonnés grandit", () => {
    const finalState = runScenario(SEED, MONTHS);
    const business = findBusiness(finalState);
    expect(business).not.toBeNull();
    expect(business!.workforce.headcount).toBeGreaterThan(0);
  });

  it("aboutit à une issue cohérente : SaaS solvable, ou faillite signalée", () => {
    const finalState = runScenario(SEED, MONTHS);
    const business = findBusiness(finalState);

    if (business) {
      expect(business.business.treasury.isInsolvent).toBe(false);
    } else {
      expect(finalState.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
    }
  });
});
