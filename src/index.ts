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

export type { HeadcountAdjustmentResult, WorkforceState } from "./types/employees.js";
export {
  HOURS_PER_EMPLOYEE_PER_MONTH,
  adjustHeadcount,
  computePayrollCost,
  computeRequiredHeadcountForHours,
  computeStaffingRatio,
  computeWorkforceCapacityHours,
  createWorkforce,
} from "./engine/employees/employees.js";

export type {
  BusinessState,
  CreditLineState,
  EconomicContribution,
  EconomicFamily,
  MonthlyFinancialStatement,
  MonthlyFinancialStatementInputs,
  TreasuryState,
} from "./types/business.js";
export { ECONOMIC_FAMILIES } from "./types/business.js";
export { computeMonthlyFinancials, consolidateContributions } from "./engine/business/accounting.js";
export {
  INSOLVENCY_THRESHOLD_MONTHS,
  UNPAID_OBLIGATIONS_PENALTY_RATE_MONTHLY,
  applyMonthlyCashFlow,
  computeMonthlyInterest,
  createBusiness,
  injectCapital,
  type ApplyCashFlowResult,
  type CreateBusinessFinancing,
  type FinancingOutcome,
  type FinancingOutcomeKind,
} from "./engine/business/treasury.js";

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
  computeHospitalityMonth,
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
  computeSubscriptionMonth,
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

export type { Mortgage, OwnedProperty, PropertyPurchaseSpec } from "./types/realEstate.js";
export {
  MORTGAGE_DEBT_SERVICE_RATIO,
  applyMortgagePayment,
  computeMortgagePayment,
  computeTotalMaintenance,
  evaluateFinancingEligibility,
  purchaseProperty,
  type FinancingEligibilityInput,
  type FinancingEligibilityResult,
  type MortgagePaymentResult,
} from "./engine/business/realEstate.js";

export type { ValuationFactor, ValuationResult } from "./types/valuation.js";
export { computeValuation } from "./engine/business/valuation.js";

export type { Offer, OfferAction, OfferBusinessModel, OfferCreateSpec, OfferPositioning, OfferStatus } from "./types/offer.js";
export {
  DEVELOPMENT_POINTS_PER_BUDGET_EURO,
  DEVELOPMENT_POINTS_PER_HOUR,
  INITIAL_QUALITY_LEVEL,
  computeLaunchThreshold,
  createOffer,
  developOffer,
  launchOffer,
  updateOfferPricing,
} from "./engine/business/offer.js";

export type { CustomerSegment } from "./types/customerSegment.js";
export type { DemandFunnelResult, DemandSignal, FitBreakdown, PriceSignal, VisibilityLevel } from "./types/demand.js";
export { getMarketSegments } from "./engine/market/segments.js";
export { computeOfferDemand, computeSegmentFit } from "./engine/market/demand.js";

export type { SaleClosing, SaleDecision, SaleOffer, SaleProcessState, SaleStatus } from "./types/sale.js";
export {
  COUNTER_OFFER_ACCEPTANCE_MULTIPLE,
  MIN_MONTHS_LISTED_BEFORE_OFFER,
  TRANSACTION_COST_RATE,
  advanceSaleProcess,
  closeSale,
  resolveSaleDecision,
  startSaleProcess,
} from "./engine/business/sale.js";

export type {
  BusinessAction,
  BusinessFamilyDecisions,
  BusinessFamilyState,
  CreateBusinessSpec,
  GameState,
  MonthActions,
  OwnedBusiness,
} from "./engine/simulation/types.js";
export { createInitialGameState } from "./engine/simulation/game.js";
export { simulateMonth } from "./engine/simulation/simulateMonth.js";
export { createOwnedBusiness, resolveBusinessMonth, type ResolvedBusinessMonth } from "./engine/simulation/businessResolution.js";
