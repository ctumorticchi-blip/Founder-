import { createContext, useContext, useMemo, useReducer, useEffect, type ReactNode } from "react";
import {
  ageInYears,
  createInitialGameState,
  simulateMonth,
  type BusinessFamilyDecisions,
  type GameDate,
  type GameState,
  type OfferAction,
  type SaleDecision,
  type TimeCategory,
} from "@founder/engine";
import { OPPORTUNITIES } from "../data/opportunities";
import { generateSeed } from "../lib/seed";
import { loadSave, writeSave, clearSave } from "../lib/storage";
import { computeBusinessNarratives } from "./businessNarrative";
import { TOTAL_MONTHLY_HOURS, buildMonthActions, createEmptyDraft, deriveNextDraft } from "./draft";
import { sanitizeEngineError } from "./errorMessages";
import type {
  BusinessDraft,
  BusinessIdentity,
  BusinessMonthSummary,
  JobDraft,
  MonthDraft,
  MonthRecap,
  Purchase,
  PropertyPurchaseDraft,
  SaveGameV1,
} from "./types";

interface AppState {
  readonly seed: number | null;
  readonly birthDate: GameDate | null;
  readonly startDate: GameDate | null;
  readonly gameState: GameState | null;
  readonly draft: MonthDraft;
  readonly lastRecap: MonthRecap | null;
  readonly error: string | null;
  /** Identités commerciales des entreprises (spec M11.1 §3.2), jamais lues via `business.name`/`.id` en UI. */
  readonly businessIdentities: Readonly<Record<string, BusinessIdentity>>;
}

const INITIAL_APP_STATE: AppState = {
  seed: null,
  birthDate: null,
  startDate: null,
  gameState: null,
  draft: createEmptyDraft(),
  lastRecap: null,
  error: null,
  businessIdentities: {},
};

function computeRecap(
  prev: GameState,
  next: GameState,
  birthDate: GameDate,
  businessIdentities: Readonly<Record<string, BusinessIdentity>>,
): MonthRecap {
  const businessSummaries: BusinessMonthSummary[] = next.businesses.map((business) => ({
    id: business.id,
    displayName: businessIdentities[business.id]?.displayName ?? business.business.name,
    family: business.familyState.family,
    revenue: business.lastStatement?.revenue ?? 0,
    netIncome: business.lastStatement?.netIncome ?? 0,
    cashFlow: business.lastStatement?.cashFlow ?? 0,
  }));
  return {
    date: next.date,
    ageYears: ageInYears(birthDate, next.date),
    cashBefore: prev.character.cash,
    cashAfter: next.character.cash,
    events: next.events.map((event) => ({ kind: event.kind, message: event.message })),
    businessSummaries,
    businessNarratives: computeBusinessNarratives(prev, next, businessIdentities),
  };
}

function startNewGame(): AppState {
  const seed = generateSeed();
  const currentYear = new Date().getFullYear();
  const birthDate: GameDate = { year: currentYear - 18, month: 1 };
  const startDate: GameDate = { year: currentYear, month: 1 };
  const gameState = createInitialGameState(
    seed,
    birthDate,
    startDate,
    OPPORTUNITIES.map((opportunity) => opportunity.market),
  );
  return {
    seed,
    birthDate,
    startDate,
    gameState,
    draft: createEmptyDraft(),
    lastRecap: null,
    error: null,
    businessIdentities: {},
  };
}

/** Applique `updater` à l'entreprise `businessId` du portefeuille, no-op si elle n'existe pas dans le brouillon. */
function updateBusinessDraft(
  state: AppState,
  businessId: string,
  updater: (business: BusinessDraft) => BusinessDraft,
): AppState {
  const index = state.draft.businesses.findIndex((b) => b.businessId === businessId);
  if (index === -1) return state;
  const businesses = state.draft.businesses.slice();
  businesses[index] = updater(businesses[index]!);
  return { ...state, draft: { ...state.draft, businesses } };
}

type Action =
  | { type: "NEW_GAME" }
  | { type: "LOAD"; save: SaveGameV1 }
  | { type: "RESET" }
  | { type: "SET_TIME_ALLOCATION"; allocation: Record<TimeCategory, number> }
  | { type: "SET_JOB"; job: JobDraft | null }
  | { type: "START_BUSINESS"; draft: BusinessDraft }
  | { type: "UPDATE_DECISIONS"; businessId: string; decisions: BusinessFamilyDecisions }
  | { type: "SET_MARKETING_BUDGET"; businessId: string; value: number }
  | { type: "SET_INFRASTRUCTURE"; businessId: string; infrastructureId: string }
  | { type: "SET_ADMIN_OPTIONAL_IDS"; businessId: string; adminOptionalIds: readonly string[] }
  | { type: "SET_PURCHASES"; businessId: string; purchases: readonly Purchase[] }
  | { type: "SET_TARGET_HEADCOUNT"; businessId: string; value: number | null }
  | { type: "SET_CAPITAL_INJECTION"; businessId: string; value: number }
  | { type: "SET_PROSPECTION_HOURS"; businessId: string; value: number }
  | { type: "SET_FOUNDER_HOURS"; businessId: string; value: number }
  | { type: "SET_PROPERTY_PURCHASE"; businessId: string; value: PropertyPurchaseDraft | null }
  | { type: "SET_SALE_DECISION"; businessId: string; value: SaleDecision | null }
  | { type: "SET_OFFER_ACTIONS"; businessId: string; value: readonly OfferAction[] }
  | { type: "END_MONTH" }
  | { type: "DISMISS_RECAP" }
  | { type: "CLEAR_ERROR" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "NEW_GAME":
      clearSave();
      return startNewGame();
    case "LOAD":
      return {
        seed: action.save.seed,
        birthDate: action.save.birthDate,
        startDate: action.save.startDate,
        gameState: action.save.gameState,
        draft: action.save.draft,
        lastRecap: action.save.lastRecap,
        error: null,
        businessIdentities: action.save.businessIdentities,
      };
    case "RESET":
      clearSave();
      return INITIAL_APP_STATE;
    case "SET_TIME_ALLOCATION":
      return { ...state, draft: { ...state.draft, timeAllocation: action.allocation } };
    case "SET_JOB":
      return { ...state, draft: { ...state.draft, job: action.job } };
    case "START_BUSINESS": {
      // Alloue par défaut le temps disponible restant à la nouvelle entreprise,
      // pour qu'elle produise dès son premier mois même si le joueur ne
      // touche pas manuellement au curseur de temps. Les entreprises
      // existantes du portefeuille ne sont jamais retirées (spec M11.1.5 §5).
      const alreadyAllocated =
        state.draft.timeAllocation.emploi + state.draft.timeAllocation.apprentissage + state.draft.timeAllocation.reseau;
      const alreadyUsedByOtherBusinesses = state.draft.businesses.reduce((sum, b) => sum + b.founderHoursAllocated + b.prospectionHours, 0);
      // Budget total restant pour CETTE entreprise (production + prospection
      // confondues) : ne jamais dépasser le budget mensuel global, même
      // lorsque le temps de prospection recommandé par l'opportunité ne
      // tient pas dans ce qu'il reste (spec M11.1.5 §5.3, §7.2).
      const remainingForNewBusiness = Math.max(0, TOTAL_MONTHLY_HOURS - alreadyAllocated - alreadyUsedByOtherBusinesses);
      const prospectionHours = Math.min(action.draft.prospectionHours, remainingForNewBusiness);
      const availableForProduction = Math.max(0, remainingForNewBusiness - prospectionHours);
      const identity: BusinessIdentity = {
        displayName: action.draft.name,
        description: action.draft.description,
        activity: action.draft.activity,
        targetCustomers: action.draft.targetCustomers,
        createdAt: state.gameState?.date ?? { year: 0, month: 1 },
      };
      const draftWithHours: BusinessDraft = { ...action.draft, founderHoursAllocated: availableForProduction, prospectionHours };
      return {
        ...state,
        draft: {
          ...state.draft,
          timeAllocation: {
            ...state.draft.timeAllocation,
            business: state.draft.timeAllocation.business + availableForProduction + prospectionHours,
          },
          businesses: [...state.draft.businesses, draftWithHours],
        },
        businessIdentities: { ...state.businessIdentities, [action.draft.businessId]: identity },
      };
    }
    case "UPDATE_DECISIONS":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, decisions: action.decisions }));
    case "SET_MARKETING_BUDGET":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, marketingBudget: action.value }));
    case "SET_INFRASTRUCTURE":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, infrastructureId: action.infrastructureId }));
    case "SET_ADMIN_OPTIONAL_IDS":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, adminOptionalIds: action.adminOptionalIds }));
    case "SET_PURCHASES":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, purchases: action.purchases }));
    case "SET_TARGET_HEADCOUNT":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, targetHeadcount: action.value }));
    case "SET_CAPITAL_INJECTION":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, capitalInjection: action.value }));
    case "SET_PROSPECTION_HOURS":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, prospectionHours: action.value }));
    case "SET_FOUNDER_HOURS":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, founderHoursAllocated: action.value }));
    case "SET_PROPERTY_PURCHASE":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, propertyPurchase: action.value }));
    case "SET_SALE_DECISION":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, saleDecision: action.value }));
    case "SET_OFFER_ACTIONS":
      return updateBusinessDraft(state, action.businessId, (b) => ({ ...b, offerActions: action.value }));
    case "END_MONTH": {
      if (!state.gameState || state.seed === null || !state.birthDate) return state;
      try {
        const actions = buildMonthActions(state.draft, state.gameState);
        const next = simulateMonth(state.gameState, actions, state.seed);
        const recap = computeRecap(state.gameState, next, state.birthDate, state.businessIdentities);
        const nextDraft = deriveNextDraft(state.draft, next);
        return { ...state, gameState: next, draft: nextDraft, lastRecap: recap, error: null };
      } catch (thrown) {
        const message = thrown instanceof Error ? thrown.message : "Une erreur inattendue est survenue.";
        return { ...state, error: sanitizeEngineError(message, state.businessIdentities) };
      }
    }
    case "DISMISS_RECAP":
      return { ...state, lastRecap: null };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
}

function init(): AppState {
  const save = loadSave();
  if (!save) return INITIAL_APP_STATE;
  return {
    seed: save.seed,
    birthDate: save.birthDate,
    startDate: save.startDate,
    gameState: save.gameState,
    draft: save.draft,
    lastRecap: save.lastRecap,
    error: null,
    businessIdentities: save.businessIdentities,
  };
}

interface GameContextValue {
  readonly state: AppState;
  readonly newGame: () => void;
  readonly resetGame: () => void;
  readonly setTimeAllocation: (allocation: Record<TimeCategory, number>) => void;
  readonly setJob: (job: JobDraft | null) => void;
  readonly startBusiness: (draft: BusinessDraft) => void;
  readonly updateDecisions: (businessId: string, decisions: BusinessFamilyDecisions) => void;
  readonly setMarketingBudget: (businessId: string, value: number) => void;
  readonly setInfrastructure: (businessId: string, infrastructureId: string) => void;
  readonly setAdminOptionalIds: (businessId: string, adminOptionalIds: readonly string[]) => void;
  readonly setPurchases: (businessId: string, purchases: readonly Purchase[]) => void;
  readonly setTargetHeadcount: (businessId: string, value: number | null) => void;
  readonly setCapitalInjection: (businessId: string, value: number) => void;
  readonly setProspectionHours: (businessId: string, value: number) => void;
  readonly setFounderHours: (businessId: string, value: number) => void;
  readonly setPropertyPurchase: (businessId: string, value: PropertyPurchaseDraft | null) => void;
  readonly setSaleDecision: (businessId: string, value: SaleDecision | null) => void;
  readonly setOfferActions: (businessId: string, value: readonly OfferAction[]) => void;
  readonly endMonth: () => void;
  readonly dismissRecap: () => void;
  readonly clearError: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  useEffect(() => {
    if (!state.gameState || state.seed === null || !state.birthDate || !state.startDate) return;
    const save: SaveGameV1 = {
      version: 1,
      seed: state.seed,
      birthDate: state.birthDate,
      startDate: state.startDate,
      gameState: state.gameState,
      draft: state.draft,
      lastRecap: state.lastRecap,
      businessIdentities: state.businessIdentities,
    };
    writeSave(save);
  }, [state.gameState, state.draft, state.lastRecap, state.seed, state.birthDate, state.startDate, state.businessIdentities]);

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      newGame: () => dispatch({ type: "NEW_GAME" }),
      resetGame: () => dispatch({ type: "RESET" }),
      setTimeAllocation: (allocation) => dispatch({ type: "SET_TIME_ALLOCATION", allocation }),
      setJob: (job) => dispatch({ type: "SET_JOB", job }),
      startBusiness: (draft) => dispatch({ type: "START_BUSINESS", draft }),
      updateDecisions: (businessId, decisions) => dispatch({ type: "UPDATE_DECISIONS", businessId, decisions }),
      setMarketingBudget: (businessId, value) => dispatch({ type: "SET_MARKETING_BUDGET", businessId, value }),
      setInfrastructure: (businessId, infrastructureId) => dispatch({ type: "SET_INFRASTRUCTURE", businessId, infrastructureId }),
      setAdminOptionalIds: (businessId, adminOptionalIds) => dispatch({ type: "SET_ADMIN_OPTIONAL_IDS", businessId, adminOptionalIds }),
      setPurchases: (businessId, purchases) => dispatch({ type: "SET_PURCHASES", businessId, purchases }),
      setTargetHeadcount: (businessId, value) => dispatch({ type: "SET_TARGET_HEADCOUNT", businessId, value }),
      setCapitalInjection: (businessId, value) => dispatch({ type: "SET_CAPITAL_INJECTION", businessId, value }),
      setProspectionHours: (businessId, value) => dispatch({ type: "SET_PROSPECTION_HOURS", businessId, value }),
      setFounderHours: (businessId, value) => dispatch({ type: "SET_FOUNDER_HOURS", businessId, value }),
      setPropertyPurchase: (businessId, value) => dispatch({ type: "SET_PROPERTY_PURCHASE", businessId, value }),
      setSaleDecision: (businessId, value) => dispatch({ type: "SET_SALE_DECISION", businessId, value }),
      setOfferActions: (businessId, value) => dispatch({ type: "SET_OFFER_ACTIONS", businessId, value }),
      endMonth: () => dispatch({ type: "END_MONTH" }),
      dismissRecap: () => dispatch({ type: "DISMISS_RECAP" }),
      clearError: () => dispatch({ type: "CLEAR_ERROR" }),
    }),
    [state],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame doit être utilisé à l'intérieur de <GameProvider>.");
  return ctx;
}
