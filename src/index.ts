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

export type {
  BusinessState,
  EconomicContribution,
  EconomicFamily,
  MonthlyFinancialStatement,
  MonthlyFinancialStatementInputs,
} from "./types/business.js";
export { ECONOMIC_FAMILIES } from "./types/business.js";
export { computeMonthlyFinancials, consolidateContributions } from "./engine/business/accounting.js";
export { applyCashFlow, createBusiness } from "./engine/business/cash.js";

export type { EconomicEngine, EconomicEngineContext } from "./engine/economic-models/economic-engine.js";
export {
  ServiceEngine,
  computeServiceMonth,
  type ServiceEngineDecisions,
  type ServiceEngineState,
  type ServiceMonthContribution,
} from "./engine/economic-models/service.js";
export {
  RetailEngine,
  type RetailEngineDecisions,
  type RetailEngineState,
  type RetailMonthContribution,
} from "./engine/economic-models/retail.js";
export {
  HospitalityEngine,
  type HospitalityEngineDecisions,
  type HospitalityEngineState,
  type HospitalityMonthContribution,
} from "./engine/economic-models/hospitality.js";
export {
  AgencyEngine,
  type AgencyEngineDecisions,
  type AgencyEngineState,
  type AgencyMonthContribution,
} from "./engine/economic-models/agency.js";
export {
  SubscriptionEngine,
  type SubscriptionEngineDecisions,
  type SubscriptionEngineState,
  type SubscriptionMonthContribution,
} from "./engine/economic-models/subscription.js";

export type { MacroCyclePhase, MacroState } from "./types/world.js";
export { MACRO_CYCLE_PHASES } from "./types/world.js";
export { advanceMacro, createInitialMacroState } from "./engine/world/world.js";

export type { Market, MarketInefficiency } from "./types/market.js";
export { advanceMarket, detectMarketInefficiency } from "./engine/market/market.js";

export type { AggregateCompetition, Competitor, CompetitorTier } from "./types/competition.js";
export {
  advanceAggregateCompetition,
  availableDemandShare,
  createAggregateCompetition,
} from "./engine/competition/competition.js";

export type { Estimate, MarketEstimate } from "./types/intelligence.js";
export { type IntelligenceSkills, projectMarketView } from "./engine/intelligence/intelligence.js";

export type { GameEvent, GameEventKind, MemoryEntry } from "./types/narrative.js";
export { appendToMemory } from "./engine/narrative/narrative.js";

export type {
  BusinessDecisionsAction,
  CreateBusinessAction,
  GameState,
  MonthActions,
  PlayerBusinessState,
} from "./engine/simulation/types.js";
export { createInitialGameState } from "./engine/simulation/game.js";
export { simulateMonth } from "./engine/simulation/simulateMonth.js";
