import { createContext, useContext, useMemo, useReducer, useEffect, type ReactNode } from "react";
import {
  ageInYears,
  createInitialGameState,
  simulateMonth,
  type BusinessFamilyDecisions,
  type GameDate,
  type GameState,
  type TimeCategory,
} from "@founder/engine";
import { OPPORTUNITIES } from "../data/opportunities";
import { generateSeed } from "../lib/seed";
import { loadSave, writeSave, clearSave } from "../lib/storage";
import { TOTAL_MONTHLY_HOURS, buildMonthActions, createEmptyDraft, deriveNextDraft } from "./draft";
import type {
  BusinessDraft,
  BusinessIdentity,
  BusinessMonthSummary,
  JobDraft,
  MonthDraft,
  MonthRecap,
  Purchase,
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

type Action =
  | { type: "NEW_GAME" }
  | { type: "LOAD"; save: SaveGameV1 }
  | { type: "RESET" }
  | { type: "SET_TIME_ALLOCATION"; allocation: Record<TimeCategory, number> }
  | { type: "SET_JOB"; job: JobDraft | null }
  | { type: "START_BUSINESS"; draft: BusinessDraft }
  | { type: "UPDATE_DECISIONS"; decisions: BusinessFamilyDecisions }
  | { type: "SET_MARKETING_BUDGET"; value: number }
  | { type: "SET_INFRASTRUCTURE"; infrastructureId: string }
  | { type: "SET_ADMIN_OPTIONAL_IDS"; adminOptionalIds: readonly string[] }
  | { type: "SET_PURCHASES"; purchases: readonly Purchase[] }
  | { type: "SET_TARGET_HEADCOUNT"; value: number | null }
  | { type: "SET_CAPITAL_INJECTION"; value: number }
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
      // touche pas manuellement au curseur de temps.
      const alreadyAllocated =
        state.draft.timeAllocation.emploi + state.draft.timeAllocation.apprentissage + state.draft.timeAllocation.reseau;
      const availableForBusiness = Math.max(0, TOTAL_MONTHLY_HOURS - alreadyAllocated);
      const identity: BusinessIdentity = {
        displayName: action.draft.name,
        description: action.draft.description,
        activity: action.draft.activity,
        targetCustomers: action.draft.targetCustomers,
        createdAt: state.gameState?.date ?? { year: 0, month: 1 },
      };
      return {
        ...state,
        draft: {
          ...state.draft,
          timeAllocation: { ...state.draft.timeAllocation, business: availableForBusiness },
          business: action.draft,
        },
        businessIdentities: { ...state.businessIdentities, [action.draft.businessId]: identity },
      };
    }
    case "UPDATE_DECISIONS":
      if (!state.draft.business) return state;
      return { ...state, draft: { ...state.draft, business: { ...state.draft.business, decisions: action.decisions } } };
    case "SET_MARKETING_BUDGET":
      if (!state.draft.business) return state;
      return { ...state, draft: { ...state.draft, business: { ...state.draft.business, marketingBudget: action.value } } };
    case "SET_INFRASTRUCTURE":
      if (!state.draft.business) return state;
      return {
        ...state,
        draft: { ...state.draft, business: { ...state.draft.business, infrastructureId: action.infrastructureId } },
      };
    case "SET_ADMIN_OPTIONAL_IDS":
      if (!state.draft.business) return state;
      return {
        ...state,
        draft: { ...state.draft, business: { ...state.draft.business, adminOptionalIds: action.adminOptionalIds } },
      };
    case "SET_PURCHASES":
      if (!state.draft.business) return state;
      return { ...state, draft: { ...state.draft, business: { ...state.draft.business, purchases: action.purchases } } };
    case "SET_TARGET_HEADCOUNT":
      if (!state.draft.business) return state;
      return { ...state, draft: { ...state.draft, business: { ...state.draft.business, targetHeadcount: action.value } } };
    case "SET_CAPITAL_INJECTION":
      if (!state.draft.business) return state;
      return { ...state, draft: { ...state.draft, business: { ...state.draft.business, capitalInjection: action.value } } };
    case "END_MONTH": {
      if (!state.gameState || state.seed === null || !state.birthDate) return state;
      try {
        const actions = buildMonthActions(state.draft);
        const next = simulateMonth(state.gameState, actions, state.seed);
        const recap = computeRecap(state.gameState, next, state.birthDate, state.businessIdentities);
        const nextDraft = deriveNextDraft(state.draft, next);
        return { ...state, gameState: next, draft: nextDraft, lastRecap: recap, error: null };
      } catch (thrown) {
        const message = thrown instanceof Error ? thrown.message : "Une erreur inattendue est survenue.";
        return { ...state, error: message };
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
  readonly updateDecisions: (decisions: BusinessFamilyDecisions) => void;
  readonly setMarketingBudget: (value: number) => void;
  readonly setInfrastructure: (infrastructureId: string) => void;
  readonly setAdminOptionalIds: (adminOptionalIds: readonly string[]) => void;
  readonly setPurchases: (purchases: readonly Purchase[]) => void;
  readonly setTargetHeadcount: (value: number | null) => void;
  readonly setCapitalInjection: (value: number) => void;
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
      updateDecisions: (decisions) => dispatch({ type: "UPDATE_DECISIONS", decisions }),
      setMarketingBudget: (value) => dispatch({ type: "SET_MARKETING_BUDGET", value }),
      setInfrastructure: (infrastructureId) => dispatch({ type: "SET_INFRASTRUCTURE", infrastructureId }),
      setAdminOptionalIds: (adminOptionalIds) => dispatch({ type: "SET_ADMIN_OPTIONAL_IDS", adminOptionalIds }),
      setPurchases: (purchases) => dispatch({ type: "SET_PURCHASES", purchases }),
      setTargetHeadcount: (value) => dispatch({ type: "SET_TARGET_HEADCOUNT", value }),
      setCapitalInjection: (value) => dispatch({ type: "SET_CAPITAL_INJECTION", value }),
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
