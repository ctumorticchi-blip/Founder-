import type { BusinessFamilyDecisions } from "@founder/engine";

/**
 * Couche de traduction (spec M11.2.2 §9) : depuis le Customer & Demand
 * Engine, ni la cible commerciale (`targetHours`/`targetMandates`/
 * `expectedDemandCovers`/`expectedFootTraffic`/`newSubscribers`) ni le prix
 * (`price`/`averageTicketPrice`/`unitPrice`) ne sont plus des décisions
 * mensuelles : la demande est calculée par le moteur à partir des offres
 * lancées, des segments du marché et de la demande captée, et le prix vient
 * de `offer.price` (ajusté via l'action `"update-pricing"` sur l'offre).
 * `concreteFields` ne sert donc plus que pour `retail.stockUnits`, seule
 * décision opérationnelle restante indépendante du prix et de la demande.
 */
export function deriveDecisions(family: BusinessFamilyDecisions["family"], concreteFields: BusinessFamilyDecisions): BusinessFamilyDecisions {
  switch (family) {
    case "service":
      return { family };
    case "hospitality":
      return { family };
    case "subscription":
      return { family };
    case "retail":
      return { family, stockUnits: concreteFields.family === "retail" ? concreteFields.stockUnits : 0 };
    case "agency":
      return { family };
  }
}
