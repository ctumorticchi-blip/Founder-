/**
 * Emprunt immobilier professionnel amortissable (spec M11.1.5 §4.2).
 * Distinct de `CreditLineState` (ligne de crédit revolving) : mensualité
 * fixe, durée fixe, jamais redessiné.
 */
export interface Mortgage {
  readonly originalPrincipal: number;
  readonly principalRemaining: number;
  readonly monthlyPayment: number;
  readonly interestRateAnnual: number;
  readonly monthsRemaining: number;
}

/**
 * Bien immobilier professionnel possédé (spec M11.1.5 §4.2). `marketValue`
 * reste égale à `purchasePrice` en V1 (pas de simulateur immobilier
 * spéculatif — limite assumée, documentée dans la spec §4.1). `owner` est
 * typé pour l'extensibilité future ; seule la branche `"business"` est
 * exercée en V1.
 */
export interface OwnedProperty {
  readonly id: string;
  readonly purchasePrice: number;
  readonly marketValue: number;
  readonly monthlyMaintenance: number;
  readonly owner: "business" | "personal";
  readonly mortgage: Mortgage | null;
  /**
   * Capacités du bien (spec M11.1.5 §3.1) : purement descriptif, jamais lu
   * par le moteur lui-même — porté pour que le web puisse recalculer la
   * capacité effective d'une entreprise (infrastructure louée OU bien
   * possédé) après un achat, sans avoir à retrouver l'annonce catalogue
   * d'origine.
   */
  readonly headcountCapacity: number;
  readonly storageCapacity: number;
}

/** Spécification d'achat fournie par le web (catalogue résolu en nombres, même pattern que `CreateBusinessSpec`). */
export interface PropertyPurchaseSpec {
  readonly purchasePrice: number;
  readonly monthlyMaintenance: number;
  readonly downPaymentFromPersonalCash: number;
  readonly mortgageTermMonths: number;
  readonly mortgageRateAnnual: number;
  readonly headcountCapacity: number;
  readonly storageCapacity: number;
}
