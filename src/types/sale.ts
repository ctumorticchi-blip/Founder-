/** Statut d'un processus de cession (spec M11.1.5 §6.2). */
export type SaleStatus = "listed" | "offer-pending" | "closed" | "withdrawn";

/** Offre d'un acquéreur, générée de façon seedée/déterministe (jamais `Math.random`). */
export interface SaleOffer {
  readonly amount: number;
  /** 0-1 : qualité perçue de l'acheteur/de l'offre, influence l'issue d'une contre-offre. */
  readonly buyerQuality: number;
}

/**
 * État persistant d'un processus de cession, porté par `OwnedBusiness`
 * (spec M11.1.5 §6.2). `null` = aucune cession en cours. Une société de
 * mauvaise qualité peut rester `"listed"` indéfiniment sans jamais recevoir
 * d'offre — pas de plancher artificiel garantissant une vente.
 */
export interface SaleProcessState {
  readonly status: SaleStatus;
  readonly monthsListed: number;
  readonly currentOffer: SaleOffer | null;
}

/** Décision du joueur sur un processus de cession en cours (spec M11.1.5 §6.2). */
export interface SaleDecision {
  readonly action: "list" | "withdraw" | "accept" | "reject" | "counter";
  /** Requis uniquement pour `action: "counter"`. */
  readonly counterAmount?: number;
}

/** Résultat de la clôture d'une vente acceptée (spec M11.1.5 §6.2). */
export interface SaleClosing {
  readonly grossAmount: number;
  readonly debtRepaid: number;
  readonly transactionCosts: number;
  readonly netProceeds: number;
}
