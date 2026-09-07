import { optionalAdminComponents, requiredAdminComponents } from "../../data/adminServices";
import { computeAdminMonthlyCost } from "../../state/businessCosts";
import { formatMoney } from "../../lib/format";

/**
 * « Charges administratives » (spec M11.1 §4.3) : le total facturé au
 * moteur devient explicable, composant par composant, plutôt qu'un nombre
 * saisi librement. Les composants requis sont toujours inclus.
 */
export function AdminBreakdown({
  optionalIds,
  onChange,
}: {
  readonly optionalIds: readonly string[];
  readonly onChange: (optionalIds: readonly string[]) => void;
}) {
  const total = computeAdminMonthlyCost(optionalIds);

  const toggle = (id: string) => {
    onChange(optionalIds.includes(id) ? optionalIds.filter((existing) => existing !== id) : [...optionalIds, id]);
  };

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <div className="section-title" style={{ marginBottom: 0 }}>
          Charges administratives
        </div>
        <span className="text-sm" style={{ fontWeight: 600 }}>
          {formatMoney(total)}/mois
        </span>
      </div>

      {requiredAdminComponents().map((component) => (
        <div className="row row--between" key={component.id}>
          <div>
            <span className="text-sm">{component.label}</span>
            <p className="text-tertiary text-sm" style={{ marginTop: 2 }}>
              {component.description}
            </p>
          </div>
          <span className="text-sm text-secondary">{formatMoney(component.monthlyCost)}</span>
        </div>
      ))}

      {optionalAdminComponents().map((component) => {
        const checked = optionalIds.includes(component.id);
        return (
          <label className="row row--between" key={component.id} style={{ cursor: "pointer" }}>
            <span className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={checked} onChange={() => toggle(component.id)} />
              <span>
                <span className="text-sm">{component.label}</span>
                <p className="text-tertiary text-sm" style={{ marginTop: 2 }}>
                  {component.description}
                </p>
              </span>
            </span>
            <span className="text-sm text-secondary">{formatMoney(component.monthlyCost)}</span>
          </label>
        );
      })}
    </div>
  );
}
