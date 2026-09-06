import type { Rng } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { clamp } from "../util/math.js";
import type { MacroCyclePhase, MacroState } from "../../types/world.js";

const INITIAL_INFLATION_RATE_ANNUAL = 0.02;
const INITIAL_GDP_GROWTH_RATE_ANNUAL = 0.015;
const INITIAL_REFERENCE_INTEREST_RATE = 0.03;

/**
 * Probabilité de transition mensuelle d'une phase de cycle vers chaque autre
 * phase (y compris rester dans la même phase). Simplification volontaire :
 * un vrai modèle macro n'est pas l'objet du P0, seule une dynamique crédible
 * et déterministe (via RNG seedé) est requise (spec §16).
 */
const CYCLE_TRANSITIONS: Readonly<Record<MacroCyclePhase, ReadonlyArray<{ value: MacroCyclePhase; weight: number }>>> = {
  expansion: [
    { value: "expansion", weight: 92 },
    { value: "slowdown", weight: 8 },
  ],
  slowdown: [
    { value: "slowdown", weight: 70 },
    { value: "recession", weight: 15 },
    { value: "expansion", weight: 15 },
  ],
  recession: [
    { value: "recession", weight: 75 },
    { value: "recovery", weight: 25 },
  ],
  recovery: [
    { value: "recovery", weight: 80 },
    { value: "expansion", weight: 20 },
  ],
};

export function createInitialMacroState(date: GameDate): MacroState {
  return {
    date,
    inflationRateAnnual: INITIAL_INFLATION_RATE_ANNUAL,
    gdpGrowthRateAnnual: INITIAL_GDP_GROWTH_RATE_ANNUAL,
    referenceInterestRate: INITIAL_REFERENCE_INTEREST_RATE,
    cyclePhase: "expansion",
  };
}

function cyclePhaseDrift(phase: MacroCyclePhase): number {
  switch (phase) {
    case "expansion":
      return 0.002;
    case "slowdown":
      return -0.001;
    case "recession":
      return -0.004;
    case "recovery":
      return 0.003;
  }
}

/**
 * Avance l'état macro d'un mois. Fonction pure : le seul aléa vient du
 * `rng` fourni explicitement par l'appelant (dérivé de la seed du mois par
 * l'orchestrateur — voir docs/ARCHITECTURE.md §5).
 */
export function advanceMacro(state: MacroState, nextDate: GameDate, rng: Rng): MacroState {
  const cycleRng = rng.fork("world:cycle");
  const nextPhase = cycleRng.pickWeighted(CYCLE_TRANSITIONS[state.cyclePhase]);

  const rateNoiseRng = rng.fork("world:rates");
  const drift = cyclePhaseDrift(nextPhase);

  const gdpGrowthRateAnnual = clamp(
    state.gdpGrowthRateAnnual + drift + rateNoiseRng.nextGaussian(0, 0.0015),
    -0.1,
    0.08,
  );
  const inflationRateAnnual = clamp(
    state.inflationRateAnnual + rateNoiseRng.nextGaussian(0, 0.001),
    -0.02,
    0.15,
  );
  const referenceInterestRate = clamp(
    state.referenceInterestRate + rateNoiseRng.nextGaussian(0, 0.0008),
    0,
    0.2,
  );

  return {
    date: nextDate,
    inflationRateAnnual,
    gdpGrowthRateAnnual,
    referenceInterestRate,
    cyclePhase: nextPhase,
  };
}
