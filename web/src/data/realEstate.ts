import type { EconomicFamily } from "@founder/engine";

/**
 * Catalogue « Devenir propriétaire de vos locaux » (spec M11.1.5 §4.4).
 * Mêmes paliers de capacité que l'infrastructure louée (`infrastructure.ts`)
 * mais achetés plutôt que loués : mensualité d'emprunt + entretien au lieu
 * d'un loyer. Financement V1 simple — voir `businessCosts.ts` pour
 * l'agrégation pure et le moteur (`engine/business/realEstate.ts`) pour
 * l'éligibilité et l'amortissement.
 */
export interface PropertyListing {
  readonly id: string;
  readonly label: string;
  readonly purchasePrice: number;
  readonly monthlyMaintenance: number;
  readonly headcountCapacity: number;
  readonly storageCapacity: number;
  readonly mortgageTermMonths: number;
  readonly mortgageRateAnnual: number;
  readonly description: string;
  readonly suitableFamilies?: readonly EconomicFamily[];
}

export const PROPERTY_LISTINGS: readonly PropertyListing[] = [
  {
    id: "local-petit",
    label: "Petit local commercial",
    purchasePrice: 120_000,
    monthlyMaintenance: 150,
    headcountCapacity: 8,
    storageCapacity: 200,
    mortgageTermMonths: 180,
    mortgageRateAnnual: 0.045,
    description: "Équivalent en capacité au petit bureau/local loué, mais possédé plutôt que loué.",
  },
  {
    id: "local-intermediaire",
    label: "Local intermédiaire",
    purchasePrice: 350_000,
    monthlyMaintenance: 400,
    headcountCapacity: 25,
    storageCapacity: 1_000,
    mortgageTermMonths: 240,
    mortgageRateAnnual: 0.045,
    description: "Équivalent en capacité au bureau/local intermédiaire loué, pour une équipe en croissance.",
  },
];

export function findPropertyListing(id: string): PropertyListing | undefined {
  return PROPERTY_LISTINGS.find((listing) => listing.id === id);
}

export function propertyListingsForFamily(family: EconomicFamily): readonly PropertyListing[] {
  return PROPERTY_LISTINGS.filter((listing) => !listing.suitableFamilies || listing.suitableFamilies.includes(family));
}
