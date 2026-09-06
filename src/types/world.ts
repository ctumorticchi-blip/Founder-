import type { GameDate } from "../engine/time/clock.js";

/**
 * Phase de cycle macroéconomique. Transition modélisée dans
 * `engine/world/world.ts` — pas de logique ici, ce fichier ne contient que
 * des types.
 */
export const MACRO_CYCLE_PHASES = ["expansion", "slowdown", "recession", "recovery"] as const;
export type MacroCyclePhase = (typeof MACRO_CYCLE_PHASES)[number];

/**
 * État macroéconomique du monde (World Engine, spec §16 : "le monde doit
 * continuer à évoluer sans le joueur"). Sert d'input aux marchés et à la
 * concurrence.
 */
export interface MacroState {
  readonly date: GameDate;
  readonly inflationRateAnnual: number;
  readonly gdpGrowthRateAnnual: number;
  readonly referenceInterestRate: number;
  readonly cyclePhase: MacroCyclePhase;
}
