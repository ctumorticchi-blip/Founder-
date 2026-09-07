import type { BusinessFamilyDecisions, CreateBusinessSpec, GameDate, GameState, SaleDecision, TimeCategory } from "@founder/engine";

/**
 * Modèle de "brouillon" du mois en cours, côté UI uniquement. Le joueur
 * construit ses décisions écran par écran ; `simulateMonth` (le moteur)
 * n'est appelé qu'au moment de "Terminer le mois", avec un `MonthActions`
 * assemblé à partir de ce brouillon (voir state/draft.ts).
 *
 * Depuis M11.1.5 : `businesses` est un tableau (spec §5.1, portefeuille
 * multi-entreprises), plus une seule entreprise implicite comme en M10/M11.1.
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

/** Achat immobilier envisagé ce mois-ci (spec M11.1.5 §4.4), remis à `null` chaque mois par `deriveNextDraft`. */
export interface PropertyPurchaseDraft {
  readonly listingId: string;
  readonly downPaymentFromPersonalCash: number;
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
  /**
   * Décisions "concrètes" (prix, ticket moyen, stock...) éditées par le
   * joueur via `DecisionFields`. Le champ "cible" qu'elles portent est
   * toujours périmé/ignoré : la vraie cible envoyée au moteur est dérivée
   * de `prospectionHours` par `commercialTranslation.ts::deriveDecisions`
   * (spec M11.1.5 §7 : le joueur ne pilote plus `targetHours` directement).
   */
  readonly decisions: BusinessFamilyDecisions;
  /** Temps de prospection du fondateur pour CETTE entreprise ce mois-ci (spec M11.1.5 §7.2). */
  readonly prospectionHours: number;
  /** Temps de production du fondateur pour CETTE entreprise ce mois-ci (capacité opérationnelle, spec §5.1). */
  readonly founderHoursAllocated: number;
  readonly marketingBudget: number;
  /** Choix catalogue (spec M11.1 §4.2) : remplace l'ancien `rentBudget` saisi librement. */
  readonly infrastructureId: string;
  /** Infrastructure réellement facturée le mois précédent (spec M11.1.5 §3.3) : détecte un changement de local pour facturer le coût de déménagement. */
  readonly committedInfrastructureId: string;
  /** Composants administratifs optionnels cochés (spec §4.3) ; les composants requis sont toujours inclus. */
  readonly adminOptionalIds: readonly string[];
  /** Achats du mois courant uniquement (spec §4.4) : remis à `[]` chaque mois par `deriveNextDraft`. */
  readonly purchases: readonly Purchase[];
  readonly targetHeadcount: number | null;
  readonly capitalInjection: number;
  /** Achat immobilier ce mois-ci (spec M11.1.5 §4.4), remis à `null` chaque mois. */
  readonly propertyPurchase: PropertyPurchaseDraft | null;
  /** Décision de cession ce mois-ci (spec M11.1.5 §6.2), remise à `null` chaque mois. */
  readonly saleDecision: SaleDecision | null;
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
  /** Portefeuille d'entreprises en cours d'édition (spec M11.1.5 §5.1). */
  readonly businesses: readonly BusinessDraft[];
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
