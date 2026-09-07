import type { EconomicFamily } from "@founder/engine";
import { findInfrastructureOption, infrastructureOptionsForFamily } from "../../data/infrastructure";
import { formatMoney } from "../../lib/format";

/**
 * « Lieu de travail » (spec M11.1 §4.2, étendu M11.1.5 §3) : le joueur
 * choisit une infrastructure concrète dans un catalogue, jamais un loyer
 * saisi librement. Affiche désormais la capacité réelle (effectif/stock)
 * — contrainte appliquée par le moteur, pas un simple texte informatif.
 * `isNew` affiche le coût d'installation (facturé au démarrage) ;
 * `committedInfrastructureId` (entreprise existante) déclenche un
 * avertissement de coût de déménagement quand la sélection diffère de
 * l'infrastructure réellement facturée le mois précédent (spec §3.3).
 */
export function InfrastructurePicker({
  family,
  selectedId,
  isNew,
  committedInfrastructureId,
  currentHeadcount,
  onChange,
}: {
  readonly family: EconomicFamily;
  readonly selectedId: string;
  readonly isNew: boolean;
  readonly committedInfrastructureId?: string;
  readonly currentHeadcount?: number;
  readonly onChange: (infrastructureId: string) => void;
}) {
  const options = infrastructureOptionsForFamily(family);
  const isMoving = !isNew && committedInfrastructureId !== undefined && selectedId !== committedInfrastructureId;
  const selectedOption = findInfrastructureOption(selectedId);

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
            <p className="text-tertiary text-sm" style={{ marginTop: 4 }}>
              Capacité : {option.headcountCapacity} poste{option.headcountCapacity > 1 ? "s" : ""}
              {currentHeadcount !== undefined && selected ? ` (${currentHeadcount}/${option.headcountCapacity} utilisés)` : ""}
              {option.storageCapacity > 0 ? ` · stock ${option.storageCapacity}` : ""}
            </p>
            {(isNew || (isMoving && selected)) && option.setupCost > 0 ? (
              <p className="text-tertiary text-sm" style={{ marginTop: 4 }}>
                + {formatMoney(option.setupCost)} d'installation {isNew ? "au démarrage" : "ce mois-ci"}
              </p>
            ) : null}
          </button>
        );
      })}

      {isMoving ? (
        <div className="pill pill--warning" style={{ marginTop: 4 }}>
          ⚠️ Déménagement vers « {selectedOption?.label ?? selectedId} » : {formatMoney(selectedOption?.setupCost ?? 0)} d'installation
          seront facturés ce mois-ci, en plus du nouveau loyer. Sélectionnez à nouveau votre local actuel pour annuler.
        </div>
      ) : null}
    </div>
  );
}
