import type { GameDate } from "../engine/time/clock.js";
import type { DemandFunnelResult } from "./demand.js";

/**
 * Modèle économique de l'offre (spec M11.2 §3.2) — vocabulaire universel
 * côté moteur, traduit en langage métier côté web
 * (`web/src/data/offerModels.ts`). Union de chaînes, extensible sans
 * rupture de migration future.
 */
export type OfferBusinessModel = "service-hours" | "project" | "unit-sale" | "recurring";

/**
 * Positionnement de l'offre — un seul vocabulaire, déjà compréhensible
 * sans traduction par famille (spec M11.1.5 §G, divulgation progressive).
 */
export type OfferPositioning = "economy" | "standard" | "premium";

/**
 * `"in-development"`/`"launched"` couvrent M11.2.1. Des statuts futurs
 * (ex. `"retired"`) pourront s'ajouter sans changer la forme du type.
 */
export type OfferStatus = "in-development" | "launched";

/** Spécification de création d'une offre (spec M11.2 §3.2). */
export interface OfferCreateSpec {
  /** Pré-généré côté web, même motif que `businessId` — jamais affiché au joueur. */
  readonly id: string;
  readonly name: string;
  readonly businessModel: OfferBusinessModel;
  readonly positioning: OfferPositioning;
  /**
   * Cible textuelle libre (spec M11.2 §3.6) : non structurée en M11.2.1 —
   * M11.2.2 pourra la faire évoluer vers un `CustomerSegment` structuré
   * sans rupture (une chaîne existante devient un segment "libre" par
   * défaut).
   */
  readonly targetSegment: string;
  readonly price: number;
}

/**
 * Une offre construite par le joueur pour une entreprise (spec M11.2
 * §3.2). Fait réel de la partie simulée (comme `BusinessState.name`) :
 * `name`/`targetSegment` ne sont jamais des ids techniques.
 */
export interface Offer {
  readonly id: string;
  readonly name: string;
  readonly businessModel: OfferBusinessModel;
  readonly positioning: OfferPositioning;
  readonly targetSegment: string;
  readonly price: number;
  readonly status: OfferStatus;
  /**
   * Développement avant lancement, 0-100 (spec §3.2-3.3). Gèle sa valeur
   * au lancement : `developOffer` n'incrémente plus jamais ce champ une
   * fois `status === "launched"`.
   */
  readonly maturity: number;
  /**
   * Attribut de qualité UNIVERSEL, 0-100 (spec : « moteur d'offre
   * universel à composants, UX traduite dans le vocabulaire du métier »).
   * Input préparé pour M11.2.2/M11.2.3 (demande, satisfaction) — non
   * encore consommé par aucun calcul économique en M11.2.1 (limite
   * assumée, spec §3.6).
   */
  readonly qualityLevel: number;
  /** Cumuls informatifs/traçabilité, jamais réinitialisés. */
  readonly developmentHoursInvested: number;
  readonly developmentBudgetInvested: number;
  readonly createdAt: GameDate;
  readonly launchedAt: GameDate | null;
  /**
   * Dernier entonnoir de demande calculé pour cette offre (spec M11.2.2
   * §10) — `null` avant le premier mois résolu après lancement (ou pour
   * une offre encore en développement). Persisté pour que l'écran affiche
   * "ce mois-ci" sans recalcul côté web (spec §13 : pas de duplication du
   * calcul de demande dans le web).
   */
  readonly lastDemand: DemandFunnelResult | null;
}

/**
 * Action du joueur sur une offre d'une entreprise, ce mois-ci. Union
 * extensible : une future action (ex. `"retire"`) s'ajoute sans changer
 * les variantes existantes ni casser une sauvegarde (les actions ne sont
 * jamais persistées, seul leur résultat — `Offer` — l'est).
 */
export type OfferAction =
  | { readonly kind: "create"; readonly spec: OfferCreateSpec }
  | { readonly kind: "develop"; readonly offerId: string; readonly hours: number; readonly budget: number }
  | { readonly kind: "launch"; readonly offerId: string }
  | {
      readonly kind: "update-pricing";
      readonly offerId: string;
      readonly price: number;
      readonly positioning: OfferPositioning;
    };
