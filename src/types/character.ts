import type { GameDate } from "../engine/time/clock.js";

/**
 * Compétences du personnage (spec P0 §4.2). Échelle 0-100.
 * Liste figée pour le P0 ; toute compétence supplémentaire doit être ajoutée
 * ici pour rester exhaustive (le type `Skills` ci-dessous force à fournir
 * une valeur pour chacune).
 */
export const SKILL_NAMES = [
  "vente",
  "produit",
  "marketing",
  "finance",
  "management",
  "leadership",
  "negociation",
  "operations",
  "technologie",
  "strategie",
  "reseau",
  "influence",
] as const;

export type SkillName = (typeof SKILL_NAMES)[number];

/** Chaque compétence est bornée à [0, 100] ; l'invariant est vérifié à la création et au gain. */
export type Skills = Readonly<Record<SkillName, number>>;

/**
 * Niveau d'éducation. Le P0 démarre systématiquement à "aucun" (spec §4.1) ;
 * les niveaux supérieurs sont réservés à une future mécanique de formation,
 * pas de logique active dessus en P0.
 */
export type EducationLevel =
  | "aucun"
  | "secondaire"
  | "bac"
  | "bac+2"
  | "bac+3"
  | "bac+5"
  | "doctorat";

export const TIME_CATEGORIES = ["emploi", "apprentissage", "business", "reseau"] as const;
export type TimeCategory = (typeof TIME_CATEGORIES)[number];

/** Répartition du temps mensuel du joueur (spec §4.3). Somme <= totalHoursPerMonth. */
export interface TimeBudget {
  readonly totalHoursPerMonth: number;
  readonly allocation: Readonly<Record<TimeCategory, number>>;
}

/**
 * Capacité organisationnelle apportée par les employés/managers, distincte
 * de la capacité personnelle du joueur (spec §4.3). Reste minimal en P0.
 */
export interface OrgCapacity {
  readonly delegatedHoursPerMonth: number;
}

export interface CharacterState {
  readonly birthDate: GameDate;
  readonly skills: Skills;
  readonly cash: number;
  readonly education: EducationLevel;
  readonly timeBudget: TimeBudget;
  readonly orgCapacity: OrgCapacity;
}
