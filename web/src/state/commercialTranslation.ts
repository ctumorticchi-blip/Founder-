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
 * Reconstruit les `decisions` complètes envoyées au moteur : les champs
 * concrets (prix, ticket moyen, stock...) viennent tels quels de
 * `concreteFields` (édités par le joueur via `DecisionFields`), le champ
 * "cible" est toujours recalculé depuis `prospectionHours`, jamais lu
 * depuis `concreteFields` même s'il y est présent (évite qu'une valeur
 * périmée s'y glisse).
 */
export function deriveDecisions(
  family: BusinessFamilyDecisions["family"],
  prospectionHours: number,
  concreteFields: BusinessFamilyDecisions,
): BusinessFamilyDecisions {
  const target = deriveTargetValue(family, prospectionHours);
  switch (family) {
    case "service":
      return { family, price: concreteFields.family === "service" ? concreteFields.price : 0, targetHours: target };
    case "hospitality":
      return {
        family,
        averageTicketPrice: concreteFields.family === "hospitality" ? concreteFields.averageTicketPrice : 0,
        expectedDemandCovers: target,
      };
    case "subscription":
      return { family, newSubscribers: target };
    case "retail":
      return {
        family,
        unitPrice: concreteFields.family === "retail" ? concreteFields.unitPrice : 0,
        stockUnits: concreteFields.family === "retail" ? concreteFields.stockUnits : 0,
        expectedFootTraffic: target,
      };
    case "agency":
      return { family, targetMandates: target };
  }
}
