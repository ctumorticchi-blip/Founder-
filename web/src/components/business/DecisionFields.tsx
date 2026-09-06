import type { BusinessFamilyDecisions } from "@founder/engine";
import { NumberField } from "../ui/NumberField";

/**
 * Formulaire de décisions propre à chaque famille économique. Les champs
 * édités correspondent exactement aux `BusinessFamilyDecisions` du moteur
 * (aucune transformation, aucun calcul ajouté ici).
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
      return (
        <>
          <NumberField label="Prix facturé" value={decisions.price} suffix="€/h" onChange={(price) => onChange({ ...decisions, price })} />
          <NumberField label="Effort commercial visé" value={decisions.targetHours} suffix="h/mois" onChange={(targetHours) => onChange({ ...decisions, targetHours })} />
        </>
      );
    case "hospitality":
      return (
        <>
          <NumberField label="Prix moyen du ticket" value={decisions.averageTicketPrice} suffix="€" onChange={(averageTicketPrice) => onChange({ ...decisions, averageTicketPrice })} />
          <NumberField label="Couverts visés" value={decisions.expectedDemandCovers} suffix="/mois" onChange={(expectedDemandCovers) => onChange({ ...decisions, expectedDemandCovers })} />
        </>
      );
    case "subscription":
      return <NumberField label="Nouveaux abonnés visés" value={decisions.newSubscribers} suffix="/mois" onChange={(newSubscribers) => onChange({ ...decisions, newSubscribers })} />;
    case "retail":
      return (
        <>
          <NumberField label="Prix de vente unitaire" value={decisions.unitPrice} suffix="€" onChange={(unitPrice) => onChange({ ...decisions, unitPrice })} />
          <NumberField label="Stock disponible" value={decisions.stockUnits} suffix="unités" onChange={(stockUnits) => onChange({ ...decisions, stockUnits })} />
          <NumberField label="Trafic client attendu" value={decisions.expectedFootTraffic} suffix="/mois" onChange={(expectedFootTraffic) => onChange({ ...decisions, expectedFootTraffic })} />
        </>
      );
    case "agency":
      return <NumberField label="Mandats visés" value={decisions.targetMandates} suffix="/mois" onChange={(targetMandates) => onChange({ ...decisions, targetMandates })} />;
  }
}
