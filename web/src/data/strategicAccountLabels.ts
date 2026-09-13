import type { Estimate, StrategicAccountOpportunitySource } from "@founder/engine";

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
