import type { BusinessFamilyDecisions, EconomicFamily } from "@founder/engine";

/**
 * Couche de traduction (spec M11.1.5 §7.1) : le joueur ne voit plus jamais
 * `targetHours`/`targetMandates`/`expectedDemandCovers`/`expectedFootTraffic`/
 * `newSubscribers` — abstractions internes du moteur, jamais exposées. Il ne
 * pilote qu'un temps de prospection (heures/mois). Cette fonction dérive la
 * cible commerciale attendue par le moteur à partir de ce temps, SANS
 * changer le moteur lui-même : `BusinessFamilyDecisions` reste strictement
 * identique, seule la manière de LE REMPLIR change côté web.
 *
 * Coefficients calibrés pour qu'un temps de prospection de référence (40h,
 * cohérent avec le budget "business" typique) retrouve les valeurs déjà
 * recommandées par `opportunities.ts` en M11.1 — aucun retuning de
 * l'équilibrage existant.
 */
const PROSPECTION_HOURS_MULTIPLIER: Readonly<Record<EconomicFamily, number>> = {
  service: 10, // 40h -> targetHours 400
  hospitality: 37.5, // 40h -> expectedDemandCovers 1 500
  subscription: 1, // 40h -> newSubscribers 40
  retail: 62.5, // 40h -> expectedFootTraffic 2 500
  agency: 0.5, // 40h -> targetMandates 20
};

function deriveTargetValue(family: EconomicFamily, prospectionHours: number): number {
  return Math.max(0, prospectionHours) * PROSPECTION_HOURS_MULTIPLIER[family];
}

/**
 * Reconstruit les `decisions` complètes envoyées au moteur : le prix
 * (spec M11.2 §3.4) vient désormais de la première offre lancée de
 * l'entreprise (`activeOfferPrice`, calculé par `draft.ts::buildBusinessAction`
 * en lisant `gameState`), jamais d'un champ libre édité côté décisions —
 * `null` (aucune offre lancée) donne un prix de `0` : tant qu'aucune offre
 * n'est lancée, l'entreprise ne vend rien. `concreteFields` ne sert plus
 * que pour `retail.stockUnits`, seule décision opérationnelle restante non
 * liée au prix. Le champ "cible" reste recalculé depuis `prospectionHours`,
 * inchangé depuis M11.1.5.
 */
export function deriveDecisions(
  family: BusinessFamilyDecisions["family"],
  prospectionHours: number,
  concreteFields: BusinessFamilyDecisions,
  activeOfferPrice: number | null,
): BusinessFamilyDecisions {
  const target = deriveTargetValue(family, prospectionHours);
  const price = activeOfferPrice ?? 0;
  switch (family) {
    case "service":
      return { family, price, targetHours: target };
    case "hospitality":
      return { family, averageTicketPrice: price, expectedDemandCovers: target };
    case "subscription":
      return { family, newSubscribers: target };
    case "retail":
      return {
        family,
        unitPrice: price,
        stockUnits: concreteFields.family === "retail" ? concreteFields.stockUnits : 0,
        expectedFootTraffic: target,
      };
    case "agency":
      return { family, targetMandates: target };
  }
}
