/**
 * Effectif agrégé d'une entreprise (spec P0 : "les salariés ordinaires
 * peuvent être agrégés, pas de simulation individuelle complète en P0").
 * `headcount` reste un nombre réel (pas nécessairement entier) : c'est une
 * simplification volontaire d'équivalent temps plein agrégé, pas un
 * registre nominatif d'employés.
 */
export interface WorkforceState {
  readonly headcount: number;
  /** Coût mensuel total chargé par employé (salaire + charges). */
  readonly averageMonthlySalary: number;
}

/** Résultat d'un ajustement d'effectif (recrutement et/ou licenciement) sur un mois. */
export interface HeadcountAdjustmentResult {
  readonly workforce: WorkforceState;
  readonly hired: number;
  readonly fired: number;
  /** Coût ponctuel de recrutement (sourcing, formation...), imputé le mois de l'embauche. */
  readonly recruitmentCost: number;
  /** Coût ponctuel de licenciement (indemnités...), imputé le mois du licenciement. */
  readonly severanceCost: number;
}
