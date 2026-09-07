import type { GameDate } from "../time/clock.js";
import type { CharacterState, TimeCategory } from "../../types/character.js";
import type { BusinessState, MonthlyFinancialStatement } from "../../types/business.js";
import type { WorkforceState } from "../../types/employees.js";
import type { Market } from "../../types/market.js";
import type { AggregateCompetition } from "../../types/competition.js";
import type { MacroState } from "../../types/world.js";
import type { GameEvent, MemoryEntry } from "../../types/narrative.js";

/** État persistant propre à chaque famille, en plus de `BusinessState`/`WorkforceState` communs. */
export type BusinessFamilyState =
  | { readonly family: "service"; readonly reputationScore: number; readonly costPerLaborHour: number }
  | { readonly family: "hospitality"; readonly reputationScore: number; readonly foodCostPerCover: number }
  | {
      readonly family: "subscription";
      readonly activeSubscribers: number;
      readonly arpu: number;
      readonly churnRateBase: number;
      readonly cogsRatio: number;
    }
  | { readonly family: "retail"; readonly reputationScore: number; readonly unitCostOfGoods: number }
  | {
      readonly family: "agency";
      readonly reputationScore: number;
      readonly averageMonthlyFeePerMandate: number;
      readonly deliveryCostRatio: number;
    };

/** Décisions mensuelles propres à chaque famille (hors budgets transversaux, communs à toutes). */
export type BusinessFamilyDecisions =
  | { readonly family: "service"; readonly price: number; readonly targetHours: number }
  | { readonly family: "hospitality"; readonly averageTicketPrice: number; readonly expectedDemandCovers: number }
  | { readonly family: "subscription"; readonly newSubscribers: number }
  | { readonly family: "retail"; readonly unitPrice: number; readonly stockUnits: number; readonly expectedFootTraffic: number }
  | { readonly family: "agency"; readonly targetMandates: number };

/** Une entreprise possédée par le joueur (spec §3 : plusieurs entreprises et familles possibles). */
export interface OwnedBusiness {
  readonly id: string;
  readonly business: BusinessState;
  readonly workforce: WorkforceState;
  readonly marketId: string;
  readonly familyState: BusinessFamilyState;
  /**
   * Compte de résultat du dernier mois résolu (spec : l'UI ne calcule rien,
   * elle affiche l'état produit par le moteur — CA/résultat doivent donc
   * être une sortie du moteur, pas recalculés côté consommateur).
   * Absent uniquement à l'instant de la création, avant la première
   * résolution mensuelle (toujours définie dans un `GameState` retourné par
   * `simulateMonth`).
   */
  readonly lastStatement?: MonthlyFinancialStatement;
}

export type CreateBusinessSpec =
  | {
      readonly family: "service";
      /** Nom commercial choisi par le joueur (spec M11.1 : identité réelle, pas un id technique). */
      readonly name: string;
      readonly marketId: string;
      readonly costPerLaborHour: number;
      readonly averageMonthlySalary: number;
      readonly creditLineLimit: number;
      readonly creditLineInterestRateAnnual: number;
    }
  | {
      readonly family: "hospitality";
      readonly name: string;
      readonly marketId: string;
      readonly foodCostPerCover: number;
      readonly averageMonthlySalary: number;
      readonly creditLineLimit: number;
      readonly creditLineInterestRateAnnual: number;
    }
  | {
      readonly family: "subscription";
      readonly name: string;
      readonly marketId: string;
      readonly arpu: number;
      readonly churnRateBase: number;
      readonly cogsRatio: number;
      readonly initialActiveSubscribers: number;
      readonly averageMonthlySalary: number;
      readonly creditLineLimit: number;
      readonly creditLineInterestRateAnnual: number;
    }
  | {
      readonly family: "retail";
      readonly name: string;
      readonly marketId: string;
      readonly unitCostOfGoods: number;
      readonly averageMonthlySalary: number;
      readonly creditLineLimit: number;
      readonly creditLineInterestRateAnnual: number;
    }
  | {
      readonly family: "agency";
      readonly name: string;
      readonly marketId: string;
      readonly averageMonthlyFeePerMandate: number;
      readonly deliveryCostRatio: number;
      readonly averageMonthlySalary: number;
      readonly creditLineLimit: number;
      readonly creditLineInterestRateAnnual: number;
    };

/**
 * Action du joueur pour une entreprise donnée, ce mois-ci. `simulateMonth`
 * exige explicitement une `BusinessAction` pour chaque entreprise non
 * liquidée du portefeuille (jamais de no-op silencieux — spec §4.3).
 */
export interface BusinessAction {
  readonly businessId: string;
  /** Part des heures "business" du fondateur allouées à CETTE entreprise ce mois-ci. */
  readonly founderHoursAllocated: number;
  /** Fourni uniquement le mois de création de cette entreprise. */
  readonly create?: CreateBusinessSpec;
  /** Requis chaque mois où l'entreprise est active (création comprise). */
  readonly decisions?: BusinessFamilyDecisions;
  readonly marketingBudget: number;
  readonly rentBudget: number;
  readonly adminBudget: number;
  /** Investissement ponctuel ce mois-ci (équipement, aménagement...). Omis = 0. */
  readonly capex?: number;
  /** Effectif cible ce mois-ci (recrutement/licenciement vers cette cible). Omis = effectif inchangé. */
  readonly targetHeadcount?: number;
  /** Apport de capital personnel dans cette entreprise ce mois-ci (spec : "sauvé par apport"). */
  readonly capitalInjection?: number;
}

/** État complet du monde simulé (Truth) à une date donnée. */
export interface GameState {
  readonly date: GameDate;
  readonly macro: MacroState;
  readonly markets: Readonly<Record<string, Market>>;
  readonly competitions: Readonly<Record<string, AggregateCompetition>>;
  readonly character: CharacterState;
  readonly job: { readonly hourlyWage: number } | null;
  /** Portefeuille d'entreprises du joueur (spec §3 : plus limité à une seule). */
  readonly businesses: readonly OwnedBusiness[];
  /** Événements du dernier mois résolu uniquement (vue transitoire). */
  readonly events: readonly GameEvent[];
  /** Mémoire longue cumulée sur toute la partie (spec §18). */
  readonly memory: readonly MemoryEntry[];
}

/**
 * Décisions du joueur pour le mois à venir. `simulateMonth` valide ces
 * décisions explicitement (rejet, jamais de clamp silencieux — spec §4.3).
 */
export interface MonthActions {
  readonly timeAllocation: Readonly<Record<TimeCategory, number>>;
  /** `null` = pas d'emploi ce mois-ci. */
  readonly jobHourlyWage: number | null;
  readonly businessActions: readonly BusinessAction[];
}
