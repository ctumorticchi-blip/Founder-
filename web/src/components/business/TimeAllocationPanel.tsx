import { RangeField } from "../ui/RangeField";
import { formatHours } from "../../lib/format";

/**
 * « Ton temps ce mois-ci » (spec M11.1.5 §7.3, §C) : Production (capacité
 * opérationnelle, `founderHoursAllocated`) et Prospection
 * (`prospectionHours`, remplace « Effort commercial visé ») pour UNE
 * entreprise du portefeuille. Les deux comptent contre le même budget de
 * temps professionnel global, partagé entre toutes les entreprises — les
 * bornes `*Max` sont calculées par l'appelant (`BusinessScreen`), qui
 * connaît le budget restant sur l'ensemble du portefeuille.
 */
export function TimeAllocationPanel({
  founderHoursAllocated,
  prospectionHours,
  founderHoursMax,
  prospectionHoursMax,
  onFounderHoursChange,
  onProspectionHoursChange,
}: {
  readonly founderHoursAllocated: number;
  readonly prospectionHours: number;
  readonly founderHoursMax: number;
  readonly prospectionHoursMax: number;
  readonly onFounderHoursChange: (value: number) => void;
  readonly onProspectionHoursChange: (value: number) => void;
}) {
  return (
    <div className="stack stack--tight">
      <div className="section-title">Ton temps ce mois-ci</div>
      <RangeField
        label="Production"
        value={founderHoursAllocated}
        max={Math.max(founderHoursAllocated, founderHoursMax)}
        valueLabel={formatHours(founderHoursAllocated)}
        onChange={onFounderHoursChange}
      />
      <RangeField
        label="Prospection"
        value={prospectionHours}
        max={Math.max(prospectionHours, prospectionHoursMax)}
        valueLabel={formatHours(prospectionHours)}
        onChange={onProspectionHoursChange}
      />
      {founderHoursAllocated <= 0 ? (
        <p className="text-sm" style={{ color: "var(--warning)" }}>
          ⚠️ Sans temps de production (ni salariés), l'entreprise ne produira rien ce mois-ci.
        </p>
      ) : null}
    </div>
  );
}
