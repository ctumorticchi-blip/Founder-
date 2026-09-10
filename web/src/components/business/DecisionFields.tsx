import type { BusinessFamilyDecisions } from "@founder/engine";
import { NumberField } from "../ui/NumberField";

/**
 * Décision opérationnelle restante propre à chaque famille économique,
 * hors prix : depuis M11.2 (spec §3.4), le prix n'est plus un champ libre
 * édité ici — il vient de l'offre active de l'entreprise (voir
 * `OffersCard`/`OfferScreen`). Seul `retail.stockUnits` reste une décision
 * opérationnelle du mois indépendante du prix. Depuis M11.1.5 (spec §7), la
 * cible commerciale (`targetHours`/…) est déjà dérivée du temps de
 * prospection, pas éditée ici non plus.
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
