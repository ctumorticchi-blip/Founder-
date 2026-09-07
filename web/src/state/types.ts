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

/** Un achat d'investissement (spec M11.1 §4.4) : un item du catalogue `capexCatalog.ts`, en quantité. */
export interface Purchase {
  readonly itemId: string;
  readonly quantity: number;
}

export interface BusinessDraft {
  readonly businessId: string;
  readonly family: CreateBusinessSpec["family"];
  readonly isNew: boolean;
  readonly createSpec: CreateBusinessSpec | null;
  /** Identité (spec M11.1 §3.2) : renseignée à la création, portée par le brouillon jusqu'à `START_BUSINESS`. */
  readonly name: string;
  readonly description: string;
  readonly activity: string;
  readonly targetCustomers: string;
  readonly decisions: BusinessFamilyDecisions;
  readonly marketingBudget: number;
  /** Choix catalogue (spec M11.1 §4.2) : remplace l'ancien `rentBudget` saisi librement. */
  readonly infrastructureId: string;
  /** Composants administratifs optionnels cochés (spec §4.3) ; les composants requis sont toujours inclus. */
  readonly adminOptionalIds: readonly string[];
  /** Achats du mois courant uniquement (spec §4.4) : remis à `[]` chaque mois par `deriveNextDraft`. */
  readonly purchases: readonly Purchase[];
  readonly targetHeadcount: number | null;
  readonly capitalInjection: number;
}

/** Identité commerciale d'une entreprise (spec M11.1 §3.2), séparée du fait moteur `BusinessState.name`. */
export interface BusinessIdentity {
  /** Dupliqué depuis `business.name` à la création, pour un affichage offline-safe même après migration (spec §3.2). */
  readonly displayName: string;
  readonly description: string;
  readonly activity: string;
  readonly targetCustomers: string;
  readonly createdAt: GameDate;
}

export interface MonthDraft {
  readonly timeAllocation: Record<TimeCategory, number>;
  readonly job: JobDraft | null;
  readonly business: BusinessDraft | null;
}

export interface BusinessMonthSummary {
  readonly id: string;
  /** Nom commercial affiché (spec M11.1 I1) : calculé une fois dans `computeRecap`, jamais relu à l'affichage. */
  readonly displayName: string;
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
  /** Identités commerciales des entreprises (spec M11.1 §3.2, §6.2), absentes d'une sauvegarde M10 migrée. */
  readonly businessIdentities: Readonly<Record<string, BusinessIdentity>>;
}
