import type { EconomicFamily } from "@founder/engine";
import { infrastructureOptionsForFamily } from "../../data/infrastructure";
import { formatMoney } from "../../lib/format";

/**
 * « Lieu de travail » (spec M11.1 §4.2) : le joueur choisit une
 * infrastructure concrète dans un catalogue, jamais un loyer saisi
 * librement. `isNew` affiche le coût d'installation (facturé une seule
 * fois, au mois de création — spec §4.2.1).
 */
export function InfrastructurePicker({
  family,
  selectedId,
  isNew,
  onChange,
}: {
  readonly family: EconomicFamily;
  readonly selectedId: string;
  readonly isNew: boolean;
  readonly onChange: (infrastructureId: string) => void;
}) {
  const options = infrastructureOptionsForFamily(family);

  return (
    <div className="stack stack--tight">
      <div className="section-title">Lieu de travail</div>
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            className="card card--interactive"
            style={{
              textAlign: "left",
              width: "100%",
              border: selected ? "1px solid var(--accent)" : undefined,
              background: selected ? "var(--accent-soft)" : undefined,
            }}
            onClick={() => onChange(option.id)}
          >
            <div className="row row--between">
              <strong>{option.label}</strong>
              <span className="text-sm">
                {option.monthlyCost > 0 ? `${formatMoney(option.monthlyCost)}/mois` : "Gratuit"}
              </span>
            </div>
            <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
              {option.capacityDescription}
            </p>
            {isNew && option.setupCost > 0 ? (
              <p className="text-tertiary text-sm" style={{ marginTop: 4 }}>
                + {formatMoney(option.setupCost)} d'installation au démarrage
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
