import type { DemandSignal, EconomicFamily, OfferBusinessModel, PriceSignal, VisibilityLevel } from "@founder/engine";

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

/**
 * Vocabulaire de l'unité native de la demande par famille (spec M11.2.2
 * §11 : "clients/couverts/commandes/mandats/abonnés selon la famille"),
 * utilisé pour afficher l'entonnoir de demande (`offer.lastDemand`) sans
 * jamais nommer une unité technique ("hoursSold", "wonMandates"...).
 */
const DEMAND_UNIT_LABELS: Readonly<Record<EconomicFamily, string>> = {
  service: "heures",
  hospitality: "couverts",
  subscription: "abonnés",
  retail: "commandes",
  agency: "mandats",
};

export function demandUnitLabel(family: EconomicFamily): string {
  return DEMAND_UNIT_LABELS[family];
}

const DEMAND_SIGNAL_LABELS: Readonly<Record<DemandSignal, string>> = {
  weak: "faible",
  moderate: "moyenne",
  strong: "favorable",
};

export function demandSignalLabel(signal: DemandSignal): string {
  return DEMAND_SIGNAL_LABELS[signal];
}

const PRICE_SIGNAL_LABELS: Readonly<Record<PriceSignal, string>> = {
  low: "semble bas",
  fair: "semble correct",
  high: "semble élevé",
};

export function priceSignalLabel(signal: PriceSignal): string {
  return PRICE_SIGNAL_LABELS[signal];
}

const VISIBILITY_LEVEL_LABELS: Readonly<Record<VisibilityLevel, string>> = {
  low: "connaissance faible",
  medium: "connaissance moyenne",
  high: "connaissance importante",
};

export function visibilityLevelLabel(level: VisibilityLevel): string {
  return VISIBILITY_LEVEL_LABELS[level];
}
