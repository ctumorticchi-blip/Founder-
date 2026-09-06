import { describe, expect, it } from "vitest";
import { simulateMonth } from "../../src/engine/simulation/simulateMonth.js";
import {
  HOSPITALITY_BUSINESS_ID,
  buildHospitalityScenarioActions,
  createHospitalityScenarioInitialState,
} from "../../src/scenarios/hospitality.js";
import type { GameState } from "../../src/engine/simulation/types.js";

const SEED = 20260906;
const MONTHS = 240;

function runScenario(seed: number, months: number): GameState {
  let state = createHospitalityScenarioInitialState(seed);
  for (let i = 0; i < months; i++) {
    state = simulateMonth(state, buildHospitalityScenarioActions(i, state), seed);
  }
  return state;
}

/**
 * Vertical slice "Hospitality" (consolidation, tâche 4) : capital plus
 * élevé (CAPEX d'aménagement), coûts fixes, personnel dès le lancement,
 * risque de liquidité réel. Même moteur que les autres scénarios.
 */
describe("vertical slice — Hospitality", () => {
  it("simule 20 ans sans crash ni valeur invalide", () => {
    const finalState = runScenario(SEED, MONTHS);
    expect(Number.isFinite(finalState.character.cash)).toBe(true);
    for (const business of finalState.businesses) {
      expect(Number.isFinite(business.business.treasury.cash)).toBe(true);
    }
  });

  it("est déterministe sur 20 ans complets", () => {
    const runA = runScenario(SEED, MONTHS);
    const runB = runScenario(SEED, MONTHS);
    expect(runA).toEqual(runB);
  });

  it("le CAPEX de lancement crée un vrai risque de liquidité (recours à la ligne de crédit)", () => {
    let state = createHospitalityScenarioInitialState(SEED);
    let sawCreditDraw = false;
    for (let i = 0; i < 24; i++) {
      state = simulateMonth(state, buildHospitalityScenarioActions(i, state), SEED);
      const business = state.businesses.find((b) => b.id === HOSPITALITY_BUSINESS_ID);
      if (business && business.business.treasury.creditLine.drawn > 0) {
        sawCreditDraw = true;
      }
    }
    expect(sawCreditDraw).toBe(true);
  });

  it("recrute du personnel dès le lancement (activité non solo)", () => {
    let state = createHospitalityScenarioInitialState(SEED);
    for (let i = 0; i < 24; i++) {
      state = simulateMonth(state, buildHospitalityScenarioActions(i, state), SEED);
    }
    const business = state.businesses.find((b) => b.id === HOSPITALITY_BUSINESS_ID);
    expect(business).not.toBeUndefined();
    expect(business!.workforce.headcount).toBeGreaterThan(0);
  });

  it("aboutit à une issue cohérente : établissement solvable, ou faillite signalée", () => {
    const finalState = runScenario(SEED, MONTHS);
    const business = finalState.businesses.find((b) => b.id === HOSPITALITY_BUSINESS_ID);

    if (business) {
      expect(business.business.treasury.isInsolvent).toBe(false);
    } else {
      expect(finalState.memory.some((e) => e.kind === "business-liquidated")).toBe(true);
    }
  });
});
