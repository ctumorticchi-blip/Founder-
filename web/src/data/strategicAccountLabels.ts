import { bucketSatisfactionLevel, type Estimate, type SatisfactionLevel, type StrategicAccountOpportunitySource } from "@founder/engine";

/**
 * Traduction métier de l'origine d'une opportunité (spec M11.2.4 §13) —
 * jamais la valeur brute de l'union affichée au joueur.
 */
const SOURCE_LABELS: Record<StrategicAccountOpportunitySource, string> = {
  prospecting: "Prospection directe",
  network: "Réseau",
  referral: "Recommandation",
  inbound: "Contact entrant",
  tender: "Appel d'offres",
};

export function strategicAccountSourceLabel(source: StrategicAccountOpportunitySource): string {
  return SOURCE_LABELS[source];
}

/**
 * Formate une estimation (spec M11.2.4.2 §7) en fourchette lisible —
 * jamais la valeur brute ni `uncertainty` affichés directement (principe
 * 13 : une VALEUR/fourchette, jamais un pourcentage de réussite).
 */
export function formatEstimateRange(estimate: Estimate, unit: string): string {
  const low = Math.max(0, estimate.value - estimate.uncertainty);
  const high = estimate.value + estimate.uncertainty;
  const formatNumber = (n: number) => Math.round(n).toLocaleString("fr-FR");
  return `${formatNumber(low)} - ${formatNumber(high)} ${unit}`;
}

/**
 * Vocabulaire (accord singulier, un seul compte) réutilisant EXACTEMENT
 * le bucketing `bucketSatisfactionLevel` du moteur (spec M11.2.4.4 §9,
 * §13) — jamais un score brut affiché, jamais une nouvelle fonction de
 * catégorisation.
 */
const ACCOUNT_SATISFACTION_LABELS: Readonly<Record<SatisfactionLevel, string>> = {
  "very-positive": "Très satisfait",
  positive: "Satisfait",
  mixed: "Mitigé",
  negative: "Déçu",
  "very-negative": "Très déçu",
};

export function accountSatisfactionLabel(smoothedScore: number): string {
  return ACCOUNT_SATISFACTION_LABELS[bucketSatisfactionLevel(smoothedScore)];
}

/**
 * Traduction qualitative de la confiance (0-1, spec §9, §13) — jamais le
 * scalaire brut affiché.
 */
export function trustLevelLabel(trust: number): string {
  if (trust >= 0.75) return "Confiance solide";
  if (trust >= 0.5) return "Confiance correcte";
  if (trust >= 0.25) return "Confiance fragile";
  return "Confiance rompue";
}

/**
 * Traduction qualitative du risque de dépendance (concentration, spec
 * §10, §13) — accompagne, sans jamais remplacer, le pourcentage réel du
 * CA (principe 10 : la concentration réelle doit rester visible, jamais
 * masquée derrière une seule catégorie).
 */
export function concentrationRiskLabel(concentration: number): string {
  if (concentration >= 0.5) return "Dépendance critique";
  if (concentration >= 0.3) return "Dépendance élevée";
  if (concentration >= 0.15) return "Dépendance modérée";
  return "Dépendance faible";
}
