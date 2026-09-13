import type { GameDate } from "../engine/time/clock.js";
import type { Estimate } from "./intelligence.js";
import type { SatisfactionDiagnosis } from "./satisfaction.js";

/**
 * Source d'une opportunité de compte stratégique (spec M11.2.4 §5,
 * principe 1) — cinq canaux distincts, jamais un pourcentage de réussite
 * caché (spec §7, §13).
 */
export type StrategicAccountOpportunitySource = "prospecting" | "network" | "referral" | "inbound" | "tender";

/**
 * Statut d'une opportunité (spec M11.2.4 §5). M11.2.4.1 (Core) ne produit
 * jamais autre chose que `"researching"` — les transitions vers
 * `"negotiating"`/`"won"`/`"lost"`/`"declined-by-player"` sont la
 * responsabilité de M11.2.4.2, pas de ce jalon.
 */
export type StrategicAccountOpportunityStatus = "researching" | "negotiating" | "won" | "lost" | "declined-by-player";

/**
 * Une proposition contractuelle échangée pendant une négociation (spec
 * §8) — objet extensible, jamais une union figée de scalaires
 * positionnels (un futur champ, ex. clause d'exclusivité, s'ajoutera
 * sans rupture).
 */
export interface AccountProposal {
  readonly price: number;
  readonly volume: number;
  readonly qualityCommitment: number;
  readonly durationMonths: number;
}

/**
 * Décision du joueur pendant une négociation (spec §8). La résolution
 * d'une décision donnée est TOUJOURS déterministe (`resolveAccountNegotiationDecision`,
 * `strategicAccounts.ts`) — seule l'ARRIVÉE d'une opportunité reste
 * stochastique-seedée (M11.2.4.1), jamais l'issue d'une négociation déjà
 * engagée.
 */
export type AccountNegotiationDecision =
  | { readonly action: "propose"; readonly proposal: AccountProposal }
  | { readonly action: "accept" }
  | { readonly action: "counter"; readonly proposal: AccountProposal }
  | { readonly action: "withdraw" };

/**
 * Contrat signé (spec §5, §8) — "papier" tant que M11.2.4.3 n'existe pas :
 * aucun effet sur `businessResolution.ts` avant ce jalon (spec §15).
 */
export interface AccountContract {
  readonly price: number;
  readonly volume: number;
  readonly qualityCommitment: number;
  readonly durationMonths: number;
  readonly monthsRemaining: number;
  readonly signedAt: GameDate;
  /** Volume RÉELLEMENT livré/perdu le mois dernier (spec M11.2.4.3 §5) — `0` par défaut à la signature, jamais mesuré avant l'intégration économique (M11.2.4.3). */
  readonly lastMonthServedVolume: number;
  readonly lastMonthUnservedVolume: number;
  /**
   * Proposition de renouvellement du CLIENT en attente (spec M11.2.4.5
   * §11-§12) — `null` hors renouvellement. Posée par le moteur quand
   * `monthsRemaining` atteint 0 (c'est le client qui ouvre le
   * renouvellement, jamais le joueur en premier).
   */
  readonly renewalProposal: AccountProposal | null;
  /** Compte à rebours avant départ automatique si le renouvellement n'est pas résolu (spec §12) — `null` hors renouvellement. */
  readonly renewalDeadlineMonthsRemaining: number | null;
}

/**
 * Satisfaction individuelle du compte (spec M11.2.4.4 §9) — distincte de
 * `SegmentCustomerMemory` (clients anonymes) : alimentée par le triplet
 * qualité/prix habituel ET par la sous-livraison contractuelle du mois.
 * `scoreThisMonth: null` signifie qu'aucun mois n'a encore été résolu
 * sous contrat (aucune mesure possible).
 */
export interface AccountSatisfactionState {
  readonly scoreThisMonth: number | null;
  /** Lissée (EWMA, même alpha que `SegmentCustomerMemory.smoothedSatisfactionScore`). */
  readonly smoothedScore: number;
  readonly diagnosisThisMonth: SatisfactionDiagnosis | null;
}

/**
 * Instantané mensuel append-only (spec §5, §11 — utilisé par M11.2.4.5
 * pour le rapport de force) : jamais réécrit, une entrée de plus par mois
 * résolu sous contrat.
 */
export interface AccountHistoryEntry {
  readonly date: GameDate;
  readonly servedVolume: number;
  readonly unservedVolume: number;
  readonly satisfactionScore: number | null;
  readonly trust: number;
}

/**
 * Relation dynamique compte/offre (spec §9) — `null` tant qu'aucun mois
 * n'a été résolu sous contrat (opportunité tout juste gagnée). `trust`
 * (0-1) évolue plus lentement que `satisfaction` (spec §9 : "la confiance
 * évolue plus lentement"), alimentée par deux sources distinctes
 * (satisfaction ET fréquence de rupture contractuelle, jamais fusionnées).
 */
export interface AccountRelationshipState {
  readonly satisfaction: AccountSatisfactionState;
  readonly trust: number;
  /** Taux de sous-livraison lissé (EWMA), 0-1 — même patron que `availabilityFrustration` (M11.2.3.1 §5), jamais fusionné avec la satisfaction. */
  readonly breachFrustration: number;
  readonly history: readonly AccountHistoryEntry[];
}

/** Action du joueur sur une opportunité de compte stratégique, ce mois-ci (spec §6, §8). */
export type StrategicAccountAction =
  | { readonly kind: "invest-time"; readonly opportunityId: string; readonly hours: number }
  | { readonly kind: "propose"; readonly opportunityId: string; readonly proposal: AccountProposal }
  | { readonly kind: "accept"; readonly opportunityId: string }
  | { readonly kind: "counter"; readonly opportunityId: string; readonly proposal: AccountProposal }
  | { readonly kind: "withdraw"; readonly opportunityId: string };

/**
 * Une piste de grand compte identifiée pour une offre/segment donnés
 * (spec §5). `"lost"` n'est produit par aucune fonction de M11.2.4.1/
 * M11.2.4.2 — réservé à une future issue (ex. abandon du compte après
 * une négociation dans l'impasse), rien ne le lit ni ne l'écrit encore.
 */
export interface StrategicAccountOpportunity {
  readonly id: string;
  readonly businessId: string;
  readonly offerId: string;
  readonly segmentId: string;
  /** Identité réelle, jamais un id technique (invariant transverse). */
  readonly companyName: string;
  readonly contactName: string;
  readonly contactRole: string;
  readonly source: StrategicAccountOpportunitySource;
  readonly discoveredAt: GameDate;
  readonly status: StrategicAccountOpportunityStatus;
  /** Heures cumulées investies à étudier cette opportunité (spec §6) — réduit `budgetEstimate.uncertainty`. */
  readonly researchHoursInvested: number;
  /** Vue imparfaite du budget/attentes réels du compte (spec §7) — jamais la vérité brute, toujours une fourchette. */
  readonly budgetEstimate: {
    readonly price: Estimate;
    readonly volume: Estimate;
    readonly qualityCommitment: Estimate;
  };
  /** Dernière contre-proposition émise par le compte, `null` hors négociation active. */
  readonly lastAccountProposal: AccountProposal | null;
  /** Rempli uniquement quand `status === "won"`. */
  readonly contract: AccountContract | null;
  /** Rempli au premier mois résolu sous contrat (spec M11.2.4.4 §9) — `null` tant qu'aucun mois n'a encore été exécuté. */
  readonly relationship: AccountRelationshipState | null;
}

/**
 * Relation entre un compte stratégique confirmé et une offre précise
 * (spec §5). M11.2.4.1 ne crée jamais d'instance de ce type (aucune
 * opportunité ne devient encore un compte confirmé) — le type existe
 * pour que `StrategicAccount.relationships` soit correctement formé dès
 * maintenant, sans migration future. `contract`/`satisfaction`/`trust`/
 * `history` seront ajoutés de façon additive par M11.2.4.3/M11.2.4.4
 * (spec §5, §9), jamais posés ici par anticipation.
 */
export interface AccountOfferRelationship {
  readonly offerId: string;
  readonly segmentId: string;
  readonly status: "active" | "lapsed" | "lost";
}

/** Identité STABLE d'un compte stratégique confirmé, une fois par entreprise cliente (spec §5). */
export interface StrategicAccount {
  readonly id: string;
  /** L'entreprise DU JOUEUR, pas celle du client. */
  readonly businessId: string;
  readonly companyName: string;
  readonly contactName: string;
  readonly contactRole: string;
  readonly source: StrategicAccountOpportunitySource;
  readonly relationshipStartedAt: GameDate;
  /** Une entrée par offre en relation active ou passée — jamais peuplé par M11.2.4.1. */
  readonly relationships: readonly AccountOfferRelationship[];
}
