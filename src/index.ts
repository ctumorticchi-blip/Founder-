// Point d'entrée public du moteur FOUNDER.
// Les exports concrets sont ajoutés milestone par milestone
// (voir docs/MILESTONES.md) au fur et à mesure que les modules
// engine/* sont implémentés.
export const FOUNDER_ENGINE_VERSION = "0.0.0";

export type { Rng, WeightedItem } from "./engine/rng/rng.js";
export { createRng, deriveSeed } from "./engine/rng/rng.js";

export type { GameDate } from "./engine/time/clock.js";
export {
  addMonths,
  ageInYears,
  compareGameDates,
  formatGameDate,
  fromMonthIndex,
  monthsBetween,
  toMonthIndex,
} from "./engine/time/clock.js";

export type {
  CharacterState,
  EducationLevel,
  OrgCapacity,
  SkillName,
  Skills,
  TimeBudget,
  TimeCategory,
} from "./types/character.js";
export { SKILL_NAMES, TIME_CATEGORIES } from "./types/character.js";
export {
  MONTHLY_TIME_BUDGET_HOURS,
  TimeBudgetError,
  allocateTime,
  applySkillGain,
  createInitialCharacter,
} from "./engine/character/character.js";
