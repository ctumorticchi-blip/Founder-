import type { GameDate } from "../time/clock.js";
import type { CharacterState, TimeCategory } from "../../types/character.js";
import type { BusinessState, MonthlyFinancialStatement } from "../../types/business.js";
import type { WorkforceState } from "../../types/employees.js";
import type { Market } from "../../types/market.js";
import type { AggregateCompetition } from "../../types/competition.js";
import type { MacroState } from "../../types/world.js";
import type { GameEvent, MemoryEntry } from "../../types/narrative.js";
import type { PropertyPurchaseSpec } from "../../types/realEstate.js";
import type { SaleDecision, SaleProcessState } from "../../types/sale.js";
import type { OfferAction } from "../../types/offer.js";

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
  /** Processus de cession en cours (spec M11.1.5 §6.2). `null` = aucune cession en cours. */
  readonly saleProcess: SaleProcessState | null;
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
  /** Part des heures "business" du fondateur allouées à CETTE entreprise ce mois-ci (capacité de production). */
  readonly founderHoursAllocated: number;
  /**
   * Heures de prospection du fondateur pour CETTE entreprise ce mois-ci
   * (spec M11.1.5 §7.2). Compte contre le même budget global que
   * `founderHoursAllocated` (voir `validateActions`) : la prospection n'est
   * jamais un levier gratuit. Traduites en cible commerciale interne
   * (`targetHours`/`targetMandates`/...) par le web avant l'appel, pas par
   * le joueur directement (couche de traduction, spec §7.1).
   */
  readonly founderProspectionHoursAllocated: number;
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
  /** Effectif salarié maximal permis par l'infrastructure choisie (spec M11.1.5 §3.2), calculé par le web. */
  readonly headcountCapacity: number;
  /** Stock maximal permis par l'infrastructure choisie (pertinent pour `retail`, spec M11.1.5 §3.2), calculé par le web. */
  readonly storageCapacity: number;
  /** Apport de capital personnel dans cette entreprise ce mois-ci (spec : "sauvé par apport"). */
  readonly capitalInjection?: number;
  /** Achat d'un bien immobilier professionnel ce mois-ci (spec M11.1.5 §4.3). */
  readonly propertyPurchase?: PropertyPurchaseSpec;
  /** Décision du joueur sur un processus de cession en cours, ou lancement d'un nouveau (spec M11.1.5 §6.2). */
  readonly saleDecision?: SaleDecision;
  /**
   * Actions du joueur sur une ou plusieurs offres de cette entreprise ce
   * mois-ci (spec M11.2 §3.2-3.3). Les heures des actions `"develop"`
   * comptent contre le même budget de temps fondateur global que
   * `founderHoursAllocated`/`founderProspectionHoursAllocated` (voir
   * `validateActions`).
   */
  readonly offerActions?: readonly OfferAction[];
  /**
   * Texte libre relayé verbatim comme `GameEvent` de type `business-note`
   * (spec M11.1.5 §3.3) : passe-plat narratif générique, le moteur ne
   * l'interprète jamais.
   */
  readonly note?: string;
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
