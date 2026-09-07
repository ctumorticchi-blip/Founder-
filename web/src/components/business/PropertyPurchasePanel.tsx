import type { EconomicFamily, OwnedProperty } from "@founder/engine";
import { computeMortgagePayment } from "@founder/engine";
import { propertyListingsForFamily } from "../../data/realEstate";
import { formatMoney } from "../../lib/format";
import { NumberField } from "../ui/NumberField";
import { Money } from "../ui/Money";
import type { PropertyPurchaseDraft } from "../../state/types";

/**
 * « Devenir propriétaire de vos locaux » (spec M11.1.5 §4.4) : location vs
 * propriété. Volontairement replié/simple — pas un simulateur immobilier
 * complet. Un bien déjà possédé (`ownedProperties`) reste affiché même
 * après un changement d'infrastructure louée (spec §4.1 : le patrimoine ne
 * disparaît jamais).
 */
export function PropertyPurchasePanel({
  family,
  ownedProperties,
  propertyPurchase,
  personalCash,
  onSelect,
  onDownPaymentChange,
  onClear,
}: {
  readonly family: EconomicFamily;
  readonly ownedProperties: readonly OwnedProperty[];
  readonly propertyPurchase: PropertyPurchaseDraft | null;
  readonly personalCash: number;
  readonly onSelect: (listingId: string) => void;
  readonly onDownPaymentChange: (value: number) => void;
  readonly onClear: () => void;
}) {
  const listings = propertyListingsForFamily(family);

  return (
    <div className="stack stack--tight">
      <div className="section-title">Devenir propriétaire de vos locaux</div>
      <p className="text-tertiary text-sm">
        Acheter immobilise du capital mais élimine le loyer au profit d'une mensualité d'emprunt. Un bien acheté
        reste à vous même si vous changez d'infrastructure louée par ailleurs.
      </p>

      {ownedProperties.map((property) => (
        <div className="row row--between" key={property.id}>
          <span className="text-sm">Bien possédé — {formatMoney(property.purchasePrice)}</span>
          <span className="text-sm text-secondary">
            {property.mortgage ? `${formatMoney(property.mortgage.principalRemaining)} restant dû` : "Sans emprunt"}
          </span>
        </div>
      ))}

      {listings.map((listing) => {
        const selected = propertyPurchase?.listingId === listing.id;
        const downPayment = selected ? propertyPurchase!.downPaymentFromPersonalCash : 0;
        const mortgagePrincipal = Math.max(0, listing.purchasePrice - downPayment);
        const estimatedPayment =
          mortgagePrincipal > 0 ? computeMortgagePayment(mortgagePrincipal, listing.mortgageRateAnnual, listing.mortgageTermMonths) : 0;
        return (
          <div
            key={listing.id}
            className="card"
            style={{ border: selected ? "1px solid var(--accent)" : undefined, background: selected ? "var(--accent-soft)" : undefined }}
          >
            <div className="row row--between">
              <strong>{listing.label}</strong>
              <span className="text-sm">{formatMoney(listing.purchasePrice)}</span>
            </div>
            <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
              {listing.description} Entretien {formatMoney(listing.monthlyMaintenance)}/mois.
            </p>
            {!selected ? (
              <button className="btn btn--secondary" style={{ marginTop: 8 }} onClick={() => onSelect(listing.id)}>
                Envisager cet achat
              </button>
            ) : (
              <div className="stack stack--tight" style={{ marginTop: 8 }}>
                <NumberField
                  label="Apport personnel"
                  value={downPayment}
                  suffix="€"
                  max={Math.max(personalCash, listing.purchasePrice)}
                  onChange={onDownPaymentChange}
                  hint={`Cash personnel disponible : ${formatMoney(personalCash)}`}
                />
                <p className="text-sm">
                  Mensualité estimée : <Money amount={estimatedPayment} />/mois sur {listing.mortgageTermMonths} mois
                  {mortgagePrincipal <= 0 ? " (achat comptant, aucun emprunt)" : ""}
                </p>
                <button className="btn btn--ghost" onClick={onClear}>
                  Annuler cet achat
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
