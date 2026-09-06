import type { BusinessFamilyDecisions, CreateBusinessSpec, GameDate, GameState, TimeCategory } from "@founder/engine";

/**
 * Modèle de "brouillon" du mois en cours, côté UI uniquement. Le joueur
 * construit ses décisions écran par écran ; `simulateMonth` (le moteur)
 * n'est appelé qu'au moment de "Terminer le mois", avec un `MonthActions`
 * assemblé à partir de ce brouillon (voir state/actions.ts).
 *
 * Portée volontaire du M10 : au plus une entreprise active à la fois côté
 * UI (le moteur supporte déjà le multi-entreprise, voir docs/ARCHITECTURE.md
 * §2.1 ; l'interface pourra l'exposer dans un futur milestone).
 */
export interface JobDraft {
  readonly offerId: string;
  readonly label: string;
  readonly hourlyWage: number;
}

export interface BusinessDraft {
  readonly businessId: string;
  readonly family: CreateBusinessSpec["family"];
  readonly isNew: boolean;
  readonly createSpec: CreateBusinessSpec | null;
  readonly decisions: BusinessFamilyDecisions;
  readonly marketingBudget: number;
  readonly rentBudget: number;
  readonly adminBudget: number;
  readonly capex: number;
  readonly targetHeadcount: number | null;
  readonly capitalInjection: number;
}

export interface MonthDraft {
  readonly timeAllocation: Record<TimeCategory, number>;
  readonly job: JobDraft | null;
  readonly business: BusinessDraft | null;
}

export interface BusinessMonthSummary {
  readonly id: string;
  readonly family: string;
  readonly revenue: number;
  readonly netIncome: number;
  readonly cashFlow: number;
}

export interface MonthRecap {
  readonly date: GameDate;
  readonly ageYears: number;
  readonly cashBefore: number;
  readonly cashAfter: number;
  readonly events: ReadonlyArray<{ readonly kind: string; readonly message: string }>;
  readonly businessSummaries: readonly BusinessMonthSummary[];
}

export interface SaveGameV1 {
  readonly version: 1;
  readonly seed: number;
  readonly birthDate: GameDate;
  readonly startDate: GameDate;
  readonly gameState: GameState;
  readonly draft: MonthDraft;
  readonly lastRecap: MonthRecap | null;
}
