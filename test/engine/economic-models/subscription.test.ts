import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  SubscriptionEngine,
  type SubscriptionEngineState,
} from "../../../src/engine/economic-models/subscription.js";

const STATE: SubscriptionEngineState = {
  activeSubscribers: 1_000,
  arpu: 29,
  churnRate: 0.05,
  cogsRatio: 0.2,
};

describe("SubscriptionEngine", () => {
  it("expose la famille 'subscription'", () => {
    expect(SubscriptionEngine.family).toBe("subscription");
  });

  it("revenue est basé sur les abonnés en début de mois (MRR)", () => {
    const rng = createRng(1);
    const result = SubscriptionEngine.computeMonth(STATE, { newSubscribers: 0 }, { rng });
    expect(result.revenue).toBeCloseTo(STATE.activeSubscribers * STATE.arpu);
  });

  it("le churn réduit les abonnés en fin de mois sans nouvelle acquisition", () => {
    const rng = createRng(2);
    const result = SubscriptionEngine.computeMonth(STATE, { newSubscribers: 0 }, { rng });
    expect(result.churnedSubscribers).toBeGreaterThan(0);
    expect(result.endingSubscribers).toBeLessThan(STATE.activeSubscribers);
  });

  it("l'acquisition de nouveaux abonnés peut compenser le churn", () => {
    const rng = createRng(3);
    const result = SubscriptionEngine.computeMonth(STATE, { newSubscribers: 200 }, { rng });
    expect(result.endingSubscribers).toBeGreaterThan(STATE.activeSubscribers);
  });

  it("endingSubscribers ne descend jamais sous 0", () => {
    const rng = createRng(4);
    const result = SubscriptionEngine.computeMonth(
      { ...STATE, activeSubscribers: 1, churnRate: 1 },
      { newSubscribers: 0 },
      { rng },
    );
    expect(result.endingSubscribers).toBeGreaterThanOrEqual(0);
  });

  it("variableCosts = revenue * cogsRatio", () => {
    const rng = createRng(5);
    const result = SubscriptionEngine.computeMonth(STATE, { newSubscribers: 50 }, { rng });
    expect(result.variableCosts).toBeCloseTo(result.revenue * STATE.cogsRatio);
  });

  it("la dynamique de churn se reporte correctement mois après mois (état porté par l'appelant)", () => {
    const rng = createRng(6);
    let state = STATE;
    let subscriberHistory = [state.activeSubscribers];
    for (let month = 0; month < 12; month++) {
      const result = SubscriptionEngine.computeMonth(state, { newSubscribers: 50 }, { rng: rng.fork(`m${month}`) });
      state = { ...state, activeSubscribers: result.endingSubscribers };
      subscriberHistory.push(state.activeSubscribers);
    }
    expect(subscriberHistory).toHaveLength(13);
    expect(subscriberHistory.every((n) => n >= 0)).toBe(true);
  });

  it("GEL M11.2.3.2 : newSubscribers transmis sans second filtre (aucun double comptage détecté à l'inspection)", () => {
    const rng = createRng(1);
    const result = SubscriptionEngine.computeMonth(
      { ...STATE, activeSubscribers: 0, churnRate: 0 },
      { newSubscribers: 250 },
      { rng },
    );
    // Base à 0, churn à 0 : endingSubscribers doit être EXACTEMENT newSubscribers, sans réduction.
    expect(result.endingSubscribers).toBe(250);
  });

  it("rejette des paramètres invalides", () => {
    const rng = createRng(1);
    expect(() =>
      SubscriptionEngine.computeMonth({ ...STATE, activeSubscribers: -1 }, { newSubscribers: 0 }, { rng }),
    ).toThrow(RangeError);
    expect(() =>
      SubscriptionEngine.computeMonth(STATE, { newSubscribers: -1 }, { rng }),
    ).toThrow(RangeError);
    expect(() =>
      SubscriptionEngine.computeMonth({ ...STATE, churnRate: 1.5 }, { newSubscribers: 0 }, { rng }),
    ).toThrow(RangeError);
  });
});
