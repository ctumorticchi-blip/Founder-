import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { StatTile } from "../components/ui/StatTile";
import { Money } from "../components/ui/Money";

export function FinancesScreen() {
  const { state } = useGame();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const gameState = state.gameState;
  if (!gameState) return null;

  const business = gameState.businesses[0] ?? null;
  const statement = business?.lastStatement ?? null;

  return (
    <div className="stack">
      <h1 className="screen-title">Finances</h1>
      <p className="screen-subtitle">Vos chiffres, tels que calculés par le moteur — rien n'est recalculé côté écran.</p>

      <div className="card">
        <div className="section-title">Personnel</div>
        <StatTile label="Cash personnel" value={<Money amount={gameState.character.cash} />} />
      </div>

      {business && statement ? (
        <div className="card stack">
          <div className="row row--between">
            <div className="section-title" style={{ marginBottom: 0 }}>
              {business.id} — dernier mois
            </div>
          </div>
          <div className="grid-2">
            <StatTile label="Chiffre d'affaires" value={<Money amount={statement.revenue} />} />
            <StatTile label="Coûts variables" value={<Money amount={statement.variableCosts} />} />
            <StatTile label="Marge brute" value={<Money amount={statement.grossMargin} />} />
            <StatTile label="EBITDA" value={<Money amount={statement.ebitda} />} tone={statement.ebitda >= 0 ? "positive" : "negative"} />
            <StatTile label="Résultat net" value={<Money amount={statement.netIncome} signed />} tone={statement.netIncome >= 0 ? "positive" : "negative"} />
            <StatTile label="Cash-flow" value={<Money amount={statement.cashFlow} signed />} tone={statement.cashFlow >= 0 ? "positive" : "negative"} />
          </div>

          <button className="btn btn--ghost" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "Masquer le détail comptable" : "Voir le détail comptable"}
          </button>

          {showAdvanced ? (
            <div className="stack stack--tight">
              <hr className="divider" />
              <DetailRow label="Salaires" value={statement.payroll} />
              <DetailRow label="Marketing" value={statement.marketing} />
              <DetailRow label="Loyer" value={statement.rent} />
              <DetailRow label="Administratif" value={statement.admin} />
              <DetailRow label="Amortissements" value={statement.depreciation} />
              <DetailRow label="Intérêts" value={statement.interest} />
              <DetailRow label="Impôts" value={statement.taxes} />
              <DetailRow label="CAPEX" value={statement.capex} />
              <DetailRow label="Variation du BFR" value={statement.workingCapitalChange} />
              <hr className="divider" />
              <DetailRow label="Ligne de crédit tirée" value={business.business.treasury.creditLine.drawn} />
              <DetailRow label="Ligne de crédit disponible" value={business.business.treasury.creditLine.limit} />
              <DetailRow label="Obligations impayées" value={business.business.treasury.unpaidObligations} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="empty-state">
          <p>Pas encore de compte de résultat : créez une entreprise pour voir vos chiffres ici.</p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="row row--between">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-sm" style={{ fontWeight: 600 }}>
        <Money amount={value} />
      </span>
    </div>
  );
}
