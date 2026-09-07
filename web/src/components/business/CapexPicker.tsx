import { CAPEX_ITEMS } from "../../data/capexCatalog";
import { computePurchasesCost } from "../../state/businessCosts";
import { formatMoney } from "../../lib/format";
import type { Purchase } from "../../state/types";

/**
 * « Investissements » (spec M11.1 §4.4) : achats identifiables du mois
 * courant, plutôt qu'un montant CAPEX libre. `purchases` ne contient que
 * les achats de ce mois — remis à `[]` chaque mois par `deriveNextDraft`.
 */
export function CapexPicker({
  purchases,
  onChange,
}: {
  readonly purchases: readonly Purchase[];
  readonly onChange: (purchases: readonly Purchase[]) => void;
}) {
  const total = computePurchasesCost(purchases);
  const quantityFor = (itemId: string) => purchases.find((purchase) => purchase.itemId === itemId)?.quantity ?? 0;

  const setQuantity = (itemId: string, quantity: number) => {
    const clamped = Math.max(0, Math.round(quantity));
    const withoutItem = purchases.filter((purchase) => purchase.itemId !== itemId);
    onChange(clamped > 0 ? [...withoutItem, { itemId, quantity: clamped }] : withoutItem);
  };

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <div className="section-title" style={{ marginBottom: 0 }}>
          Investissements ce mois-ci
        </div>
        {total > 0 ? (
          <span className="text-sm" style={{ fontWeight: 600 }}>
            {formatMoney(total)}
          </span>
        ) : null}
      </div>

      {CAPEX_ITEMS.map((item) => {
        const quantity = quantityFor(item.id);
        return (
          <div className="row row--between" key={item.id}>
            <div>
              <span className="text-sm">{item.label}</span>
              <p className="text-tertiary text-sm" style={{ marginTop: 2 }}>
                {formatMoney(item.unitCost)} / unité — {item.description}
              </p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setQuantity(item.id, quantity - 1)} disabled={quantity <= 0}>
                −
              </button>
              <span className="text-sm" style={{ minWidth: 16, textAlign: "center" }}>
                {quantity}
              </span>
              <button type="button" className="btn btn--ghost" onClick={() => setQuantity(item.id, quantity + 1)}>
                +
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
