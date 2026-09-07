import type { BusinessFamilyDecisions } from "@founder/engine";
import { NumberField } from "../ui/NumberField";

/**
 * Formulaire de décisions "concrètes" propre à chaque famille économique :
 * prix, ticket moyen, stock. Depuis M11.1.5 (spec §7), la cible commerciale
 * (`targetHours`/`expectedDemandCovers`/`expectedFootTraffic`/
 * `newSubscribers`/`targetMandates`) n'est plus un champ édité ici — elle
 * est dérivée du temps de prospection du fondateur (voir
 * `commercialTranslation.ts`, `TimeAllocationPanel`). Le joueur n'a plus
 * besoin de connaître ces noms de champs internes au moteur.
 */
export function DecisionFields({
  decisions,
  onChange,
}: {
  readonly decisions: BusinessFamilyDecisions;
  readonly onChange: (decisions: BusinessFamilyDecisions) => void;
}) {
  switch (decisions.family) {
    case "service":
      return <NumberField label="Prix facturé" value={decisions.price} suffix="€/h" onChange={(price) => onChange({ ...decisions, price })} />;
    case "hospitality":
      return (
        <NumberField
          label="Prix moyen du ticket"
          value={decisions.averageTicketPrice}
          suffix="€"
          onChange={(averageTicketPrice) => onChange({ ...decisions, averageTicketPrice })}
        />
      );
    case "subscription":
      return null;
    case "retail":
      return (
        <>
          <NumberField label="Prix de vente unitaire" value={decisions.unitPrice} suffix="€" onChange={(unitPrice) => onChange({ ...decisions, unitPrice })} />
          <NumberField label="Stock disponible" value={decisions.stockUnits} suffix="unités" onChange={(stockUnits) => onChange({ ...decisions, stockUnits })} />
        </>
      );
    case "agency":
      return null;
  }
}
