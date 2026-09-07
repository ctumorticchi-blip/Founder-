/**
 * Catalogue « Charges administratives » (spec M11.1 §4.3). Remplace le
 * champ "Administratif" saisi librement : le total facturé au moteur
 * (`adminBudget`) devient explicable, composant par composant (voir
 * `businessCosts.ts::computeAdminMonthlyCost`).
 */
export interface AdminComponent {
  readonly id: string;
  readonly label: string;
  readonly monthlyCost: number;
  /** true = toujours inclus, non désactivable par le joueur. */
  readonly required: boolean;
  readonly description: string;
}

export const ADMIN_COMPONENTS: readonly AdminComponent[] = [
  {
    id: "banque",
    label: "Frais bancaires pro",
    monthlyCost: 25,
    required: true,
    description: "Tenue de compte professionnel, incontournable dès la création.",
  },
  {
    id: "assurance",
    label: "Assurance professionnelle",
    monthlyCost: 45,
    required: true,
    description: "Responsabilité civile professionnelle, exigée pour opérer légalement.",
  },
  {
    id: "comptabilite",
    label: "Comptabilité",
    monthlyCost: 120,
    required: true,
    description: "Tenue des comptes et déclarations, obligatoire pour une entreprise active.",
  },
  {
    id: "logiciels",
    label: "Logiciels & outils",
    monthlyCost: 60,
    required: false,
    description: "Outils de gestion, de facturation ou de productivité au-delà du strict nécessaire.",
  },
  {
    id: "conformite",
    label: "Conformité & licences",
    monthlyCost: 80,
    required: false,
    description: "Licences ou mises en conformité spécifiques à certaines activités réglementées.",
  },
];

export function requiredAdminComponents(): readonly AdminComponent[] {
  return ADMIN_COMPONENTS.filter((component) => component.required);
}

export function optionalAdminComponents(): readonly AdminComponent[] {
  return ADMIN_COMPONENTS.filter((component) => !component.required);
}

export function findAdminComponent(id: string): AdminComponent | undefined {
  return ADMIN_COMPONENTS.find((component) => component.id === id);
}
