import { useState } from "react";
import { useGame } from "../state/GameProvider";
import { StatTile } from "../components/ui/StatTile";
import { Money } from "../components/ui/Money";
import { findInfrastructureOption } from "../data/infrastructure";
import { ADMIN_COMPONENTS, requiredAdminComponents } from "../data/adminServices";

export function FinancesScreen({ businessId }: { readonly businessId?: string }) {
  const { state } = useGame();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const gameState = state.gameState;
  if (!gameState) return null;

  const business = (businessId ? gameState.businesses.find((b) => b.id === businessId) : gameState.businesses[0]) ?? null;
  const statement = business?.lastStatement ?? null;
  const identity = business ? state.businessIdentities[business.id] : undefined;
  const draftBusiness = business ? state.draft.businesses.find((b) => b.businessId === business.id) ?? null : null;
  const infrastructure = draftBusiness ? findInfrastructureOption(draftBusiness.infrastructureId) : undefined;
  const includedAdminComponents = draftBusiness
    ? [...requiredAdminComponents(), ...ADMIN_COMPONENTS.filter((c) => draftBusiness.adminOptionalIds.includes(c.id))]
    : [];
  const properties = business?.business.properties ?? [];

  return (
    <div className="stack">
      <h1 className="screen-title">Finances</h1>
      <p className="screen-subtitle">Vos chiffres, tels que calculés par le moteur — rien n'est recalculé côté écran.</p>

      <div className="card">
        <div className="section-title">Personnel</div>
        <StatTile label="Cash personnel" value={<Money amount={gameState.character.cash} />} />
      </div>

      {gameState.businesses.length > 1 ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {gameState.businesses.map((b) => (
            <span key={b.id} className={`pill${b.id === business?.id ? " pill--accent" : ""}`}>
              {state.businessIdentities[b.id]?.displayName ?? "Entreprise"}
            </span>
          ))}
        </div>
      ) : null}

      {business && statement ? (
        <div className="card stack">
          <div className="row row--between">
            <div className="section-title" style={{ marginBottom: 0 }}>
              {identity?.displayName ?? "Mon entreprise"} — dernier mois
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
              <DetailRow label={infrastructure ? `Loyer — ${infrastructure.label}` : "Loyer"} value={statement.rent} />
              <DetailRow
                label={includedAdminComponents.length > 0 ? `Administratif — ${includedAdminComponents.map((c) => c.label).join(", ")}` : "Administratif"}
                value={statement.admin}
              />
              <DetailRow label="Amortissements" value={statement.depreciation} />
              <DetailRow label="Intérêts" value={statement.interest} />
              <DetailRow label="Impôts" value={statement.taxes} />
              <DetailRow label="CAPEX" value={statement.capex} />
              <DetailRow label="Variation du BFR" value={statement.workingCapitalChange} />
              <hr className="divider" />
              <DetailRow label="Ligne de crédit tirée" value={business.business.treasury.creditLine.drawn} />
              <DetailRow label="Ligne de crédit disponible" value={business.business.treasury.creditLine.limit} />
              <DetailRow label="Obligations impayées" value={business.business.treasury.unpaidObligations} />
              {properties.length > 0 ? (
                <>
                  <hr className="divider" />
                  {properties.map((property) => (
                    <div className="stack stack--tight" key={property.id}>
                      <DetailRow label="Bien immobilier — valeur" value={property.marketValue} />
                      <DetailRow label="Bien immobilier — entretien mensuel" value={property.monthlyMaintenance} />
                      {property.mortgage ? <DetailRow label="Emprunt immobilier restant dû" value={property.mortgage.principalRemaining} /> : null}
                    </div>
                  ))}
                </>
              ) : null}
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
