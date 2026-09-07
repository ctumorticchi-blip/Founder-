/**
 * Catalogue « Investissements » (spec M11.1 §4.4). Remplace le champ
 * "Investissement ponctuel" saisi librement : le joueur achète des items
 * identifiables, le moteur reçoit un `capex` calculé (voir
 * `businessCosts.ts::computePurchasesCost`).
 */
export interface CapexItem {
  readonly id: string;
  readonly label: string;
  readonly unitCost: number;
  readonly description: string;
  /**
   * Ids d'infrastructure où cet item ne peut pas être acheté (spec
   * M11.1.5 §3.1 : "équipement incompatible refusé"). Filtrage pur,
   * data-driven — pas une nouvelle mécanique de capacité numérique.
   * Absent = compatible partout.
   */
  readonly incompatibleWithInfrastructureIds?: readonly string[];
}

export const CAPEX_ITEMS: readonly CapexItem[] = [
  {
    id: "ordinateur",
    label: "Ordinateur professionnel",
    unitCost: 1_200,
    description: "Poste de travail pour le fondateur ou un employé.",
  },
  {
    id: "mobilier",
    label: "Mobilier",
    unitCost: 600,
    description: "Bureaux, chaises, rangements pour équiper un espace de travail.",
  },
  {
    id: "materiel-pro",
    label: "Matériel professionnel",
    unitCost: 2_500,
    description: "Équipement spécifique à l'activité (outillage, machines, matériel de service).",
  },
  {
    id: "amenagement",
    label: "Aménagement des locaux",
    unitCost: 5_000,
    description: "Travaux et agencement pour rendre un local opérationnel.",
    incompatibleWithInfrastructureIds: ["domicile", "coworking"],
  },
];

export function findCapexItem(id: string): CapexItem | undefined {
  return CAPEX_ITEMS.find((item) => item.id === id);
}

export function capexItemsForInfrastructure(infrastructureId: string): readonly CapexItem[] {
  return CAPEX_ITEMS.filter((item) => !item.incompatibleWithInfrastructureIds?.includes(infrastructureId));
}
