import { describe, expect, it } from "vitest";
import { simulateMonth } from "../../src/engine/simulation/simulateMonth.js";
import {
  SERVICE_BUSINESS_ID,
  buildServiceScenarioActions,
  createServiceScenarioInitialState,
} from "../../src/scenarios/service.js";
import type { GameState } from "../../src/engine/simulation/types.js";

const SEED = 20260906;
const MONTHS = 240; // 20 ans

function runScenario(seed: number, months: number): GameState {
  let state = createServiceScenarioInitialState(seed);
  for (let i = 0; i < months; i++) {
    state = simulateMonth(state, buildServiceScenarioActions(i, state), seed);
  }
  return state;
}

/**
 * Vertical slice "Service" (consolidation, tâche 4) : 18 ans -> petit
 * boulot -> activité seule -> recrutement -> croissance -> PME ou faillite.
 * `buildServiceScenarioActions` ne fait que produire des décisions ;
 * `simulateMonth` est EXACTEMENT le même moteur que tous les autres tests —
 * aucune branche n'existe pour garantir un résultat particulier.
 */
describe("vertical slice — Service", () => {
  it("simule 20 ans sans crash ni valeur invalide", () => {
    const finalState = runScenario(SEED, MONTHS);
    expect(Number.isFinite(finalState.character.cash)).toBe(true);
    for (const business of finalState.businesses) {
      expect(Number.isFinite(business.business.treasury.cash)).toBe(true);
      expect(Number.isFinite(business.workforce.headcount)).toBe(true);
    }
  });

  it("est déterministe sur 20 ans complets", () => {
    const runA = runScenario(SEED, MONTHS);
    const runB = runScenario(SEED, MONTHS);
    expect(runA).toEqual(runB);
  });

  it("traverse bien les étapes : emploi -> création -> recrutement", () => {
    let state = createServiceScenarioInitialState(SEED);
    let sawJobStarted = false;
    let sawBusinessCreated = false;
    let sawHiring = false;
    let previousHeadcount = 0;

    for (let i = 0; i < MONTHS; i++) {
      state = simulateMonth(state, buildServiceScenarioActions(i, state), SEED);
      if (state.events.some((e) => e.kind === "job-started")) sawJobStarted = true;
      if (state.events.some((e) => e.kind === "business-created")) sawBusinessCreated = true;
      const business = state.businesses.find((b) => b.id === SERVICE_BUSINESS_ID);
      if (business && business.workforce.headcount > previousHeadcount) sawHiring = true;
      previousHeadcount = business?.workforce.headcount ?? 0;
    }

    expect(sawJobStarted).toBe(true);
    expect(sawBusinessCreated).toBe(true);
    expect(sawHiring).toBe(true);
  });

  it("aboutit à une issue cohérente : PME solvable en croissance, ou faillite signalée", () => {
    const finalState = runScenario(SEED, MONTHS);
    const business = finalState.businesses.find((b) => b.id === SERVICE_BUSINESS_ID);

    if (business) {
      expect(business.business.treasury.isInsolvent).toBe(false);
      expect(business.business.treasury.cash).toBeGreaterThan(0);
    } else {
      expect(finalState.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
      expect(finalState.memory.some((e) => e.kind === "cash-crisis-warning")).toBe(true);
    }
  });
});
