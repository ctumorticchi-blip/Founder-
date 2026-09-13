import type { GameDate } from "../engine/time/clock.js";

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

/** Une piste de grand compte identifiée pour une offre/segment donnés (spec §5). */
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
