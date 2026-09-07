import type { GameDate } from "../engine/time/clock.js";

/**
 * Types d'événements produits par le Narrative Engine. Dérivés de l'état
 * (spec §3.17-18), jamais scriptés à l'avance. Liste volontairement réduite
 * en P0 ; chaque nouvel événement doit rester la conséquence observable d'un
 * changement d'état réel (pas un texte gratuit).
 */
export type GameEventKind =
  | "job-started"
  | "business-created"
  | "business-liquidated"
  | "cash-crisis-warning"
  | "capital-injected"
  | "market-opportunity-detected"
  /** Passe-plat narratif générique (spec M11.1.5 §3.3) : le moteur relaie `BusinessAction.note` verbatim, sans l'interpréter. */
  | "business-note"
  | "property-purchased"
  | "business-listed-for-sale"
  | "sale-offer-received"
  | "business-sold";

/** Événement du mois courant (transitoire : renvoyé par simulateMonth, pas nécessairement mémorisé). */
export interface GameEvent {
  readonly kind: GameEventKind;
  readonly date: GameDate;
  readonly message: string;
}

/**
 * Entrée persistée dans la mémoire longue (spec §18 : "les décisions
 * importantes doivent pouvoir être mémorisées et revenir plusieurs années
 * plus tard"). Sous-ensemble des événements jugés mémorables.
 */
export interface MemoryEntry {
  readonly date: GameDate;
  readonly kind: GameEventKind;
  readonly message: string;
}
