import type { GameDate } from "../time/clock.js";
import type { CharacterState, TimeCategory } from "../../types/character.js";
import type { BusinessState } from "../../types/business.js";
import type { Market } from "../../types/market.js";
import type { AggregateCompetition } from "../../types/competition.js";
import type { MacroState } from "../../types/world.js";
import type { GameEvent, MemoryEntry } from "../../types/narrative.js";

/**
 * État de l'entreprise du joueur pour la tranche verticale du P0 : une seule
 * entreprise active, famille "service" (spec §7). Composer plusieurs
 * familles ou plusieurs entreprises est déjà supporté par le Business
 * Engine (M2, `consolidateContributions`) mais reste hors périmètre de cet
 * orchestrateur — voir docs/MILESTONES.md (post-P0).
 */
export interface PlayerBusinessState {
  readonly business: BusinessState;
  readonly reputationScore: number;
  readonly costPerLaborHour: number;
}

/** État complet du monde simulé (Truth) à une date donnée. */
export interface GameState {
  readonly date: GameDate;
  readonly macro: MacroState;
  readonly market: Market;
  readonly competition: AggregateCompetition;
  readonly character: CharacterState;
  readonly job: { readonly hourlyWage: number } | null;
  readonly playerBusiness: PlayerBusinessState | null;
  /** Événements du dernier mois résolu uniquement (vue transitoire). */
  readonly events: readonly GameEvent[];
  /** Mémoire longue cumulée sur toute la partie (spec §18). */
  readonly memory: readonly MemoryEntry[];
}

export interface CreateBusinessAction {
  readonly costPerLaborHour: number;
}

export interface BusinessDecisionsAction {
  readonly price: number;
  readonly targetHours: number;
  readonly marketingBudget: number;
  readonly rentBudget: number;
  readonly adminBudget: number;
  readonly payrollBudget: number;
}

/**
 * Décisions du joueur pour le mois à venir. `simulateMonth` valide ces
 * décisions explicitement (rejet, jamais de clamp silencieux — spec §4.3).
 */
export interface MonthActions {
  readonly timeAllocation: Readonly<Record<TimeCategory, number>>;
  /** `null` = pas d'emploi ce mois-ci. */
  readonly jobHourlyWage: number | null;
  /** Fourni uniquement le mois où le joueur crée son entreprise. */
  readonly createBusiness?: CreateBusinessAction;
  /** Requis chaque mois où une entreprise est active. */
  readonly businessDecisions?: BusinessDecisionsAction;
}
