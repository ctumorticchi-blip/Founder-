import type { EconomicFamily } from "@founder/engine";

/**
 * Catalogue « Lieu de travail » (spec M11.1 §4.2). Remplace le champ
 * "Loyer" saisi librement : le joueur choisit un lieu de travail concret,
 * l'engine reçoit un `rentBudget` calculé à partir de ce choix (voir
 * `businessCosts.ts`). Donnée de produit, pas de simulation immobilière —
 * `capacityDescription` est informatif uniquement en M11.1 (spec §4.2).
 */
export interface InfrastructureOption {
  readonly id: string;
  readonly label: string;
  readonly monthlyCost: number;
  /** Facturé une seule fois, à la création ET à chaque changement de local (spec M11.1.5 §3.3). */
  readonly setupCost: number;
  readonly capacityDescription: string;
  /** Effectif salarié maximal (spec M11.1.5 §3.1) : contrainte réelle, appliquée par le moteur. */
  readonly headcountCapacity: number;
  /** Stock maximal pertinent pour `retail` (spec M11.1.5 §3.1) : contrainte réelle, appliquée par le moteur. */
  readonly storageCapacity: number;
  readonly pros: readonly string[];
  readonly cons: readonly string[];
  /** Absent = adapté à toutes les familles. */
  readonly suitableFamilies?: readonly EconomicFamily[];
}

export const INFRASTRUCTURE_OPTIONS: readonly InfrastructureOption[] = [
  {
    id: "domicile",
    label: "Domicile",
    monthlyCost: 0,
    setupCost: 0,
    capacityDescription: "Convient à une activité solo, sans accueil de public régulier.",
    headcountCapacity: 0,
    storageCapacity: 0,
    pros: ["Aucun coût fixe", "Aucun engagement"],
    cons: ["Pas d'image professionnelle", "Espace limité pour une équipe"],
    suitableFamilies: ["service", "subscription", "retail", "agency"],
  },
  {
    id: "coworking",
    label: "Coworking",
    monthlyCost: 250,
    setupCost: 0,
    capacityDescription: "Convient à une petite équipe (jusqu'à 3 personnes), sans stock ni matériel lourd.",
    headcountCapacity: 3,
    storageCapacity: 0,
    pros: ["Adresse professionnelle", "Flexible, sans engagement long"],
    cons: ["Coût mensuel dès le premier mois", "Pas d'espace dédié pour recevoir du public en volume"],
    suitableFamilies: ["service", "subscription", "retail", "agency"],
  },
  {
    id: "petit-bureau",
    label: "Petit bureau / local",
    monthlyCost: 900,
    setupCost: 2_000,
    capacityDescription: "Convient à une équipe jusqu'à 8 personnes ou un local commercial de taille modeste.",
    headcountCapacity: 8,
    storageCapacity: 200,
    pros: ["Espace dédié et stable", "Peut accueillir du public/stock"],
    cons: ["Engagement mensuel plus lourd", "Coût d'installation au démarrage"],
  },
  {
    id: "bureau-intermediaire",
    label: "Bureau / local intermédiaire",
    monthlyCost: 2_500,
    setupCost: 8_000,
    capacityDescription: "Convient à une équipe en croissance jusqu'à 25 personnes (PME) ou un local commercial plus grand.",
    headcountCapacity: 25,
    storageCapacity: 1_000,
    pros: ["Capacité pour une équipe en croissance", "Bonne image professionnelle"],
    cons: ["Charge fixe importante", "Coût d'installation élevé"],
  },
];

export function findInfrastructureOption(id: string): InfrastructureOption | undefined {
  return INFRASTRUCTURE_OPTIONS.find((option) => option.id === id);
}

export function infrastructureOptionsForFamily(family: EconomicFamily): readonly InfrastructureOption[] {
  return INFRASTRUCTURE_OPTIONS.filter((option) => !option.suitableFamilies || option.suitableFamilies.includes(family));
}
