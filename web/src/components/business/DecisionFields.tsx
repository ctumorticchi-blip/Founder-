import type { BusinessFamilyDecisions } from "@founder/engine";
import { NumberField } from "../ui/NumberField";

/**
 * Décision opérationnelle restante propre à chaque famille économique, hors
 * prix et hors cible commerciale : depuis M11.2 (spec §3.4), le prix vient
 * de l'offre active de l'entreprise (voir `OffersCard`/`OfferScreen`), et
 * depuis M11.2.2 (spec §9), la cible commerciale est calculée par le
 * Customer & Demand Engine à partir des offres/segments/demande — plus une
 * décision du joueur du tout. Seul `retail.stockUnits` reste une décision
 * opérationnelle du mois, indépendante du prix et de la demande.
 */
export function DecisionFields({
  decisions,
  onChange,
  hasLaunchedOffer,
}: {
  readonly decisions: BusinessFamilyDecisions;
  readonly onChange: (decisions: BusinessFamilyDecisions) => void;
  readonly hasLaunchedOffer: boolean;
}) {
  const priceNotice = !hasLaunchedOffer ? (
    <p className="text-sm text-secondary">Construisez et lancez une offre pour fixer votre prix.</p>
  ) : null;

  switch (decisions.family) {
    case "retail":
      return (
        <>
          {priceNotice}
          <NumberField label="Stock disponible" value={decisions.stockUnits} suffix="unités" onChange={(stockUnits) => onChange({ ...decisions, stockUnits })} />
        </>
      );
    case "service":
    case "hospitality":
    case "subscription":
    case "agency":
      return priceNotice;
  }
}
