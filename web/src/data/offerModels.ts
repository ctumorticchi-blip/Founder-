import type { EconomicFamily, OfferBusinessModel } from "@founder/engine";

/**
 * Vocabulaire métier du moteur d'offre universel (spec M11.2 §3.4bis) : le
 * moteur ne connaît que 4 `OfferBusinessModel` génériques, cet écran
 * les traduit en langage compréhensible par famille. Donnée pure, aucune
 * logique économique (même statut que `infrastructure.ts`).
 */
const RECOMMENDED_MODELS: Readonly<Record<EconomicFamily, readonly OfferBusinessModel[]>> = {
  service: ["service-hours", "project"],
  hospitality: ["unit-sale", "project"],
  subscription: ["recurring"],
  retail: ["unit-sale"],
  agency: ["project", "service-hours"],
};

const FAMILY_LABELS: Readonly<Record<EconomicFamily, Partial<Record<OfferBusinessModel, string>>>> = {
  service: { "service-hours": "Prestation à l'heure", project: "Mission forfaitaire" },
  hospitality: { "unit-sale": "Formule à la carte", project: "Prestation événementielle" },
  subscription: { recurring: "Abonnement mensuel" },
  retail: { "unit-sale": "Produit en vente" },
  agency: { project: "Mission client", "service-hours": "Accompagnement continu" },
};

const GENERIC_LABELS: Readonly<Record<OfferBusinessModel, string>> = {
  "service-hours": "Prestation à l'heure",
  project: "Mission au forfait",
  "unit-sale": "Vente à l'unité",
  recurring: "Abonnement récurrent",
};

const QUALITY_LABELS: Readonly<Record<EconomicFamily, string>> = {
  service: "Qualité du service",
  hospitality: "Qualité du menu",
  subscription: "Qualité du produit",
  retail: "Qualité du produit",
  agency: "Qualité des livrables",
};

export function offerModelsForFamily(family: EconomicFamily): readonly OfferBusinessModel[] {
  return RECOMMENDED_MODELS[family];
}

export function offerModelLabel(businessModel: OfferBusinessModel, family: EconomicFamily): string {
  return FAMILY_LABELS[family][businessModel] ?? GENERIC_LABELS[businessModel];
}

export function offerQualityLabel(family: EconomicFamily): string {
  return QUALITY_LABELS[family];
}
