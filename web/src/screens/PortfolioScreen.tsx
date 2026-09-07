import { ageInYears, computeValuation } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { Money } from "../components/ui/Money";
import { StatTile } from "../components/ui/StatTile";

const FAMILY_LABELS: Record<string, string> = {
  service: "Société de service",
  hospitality: "Café / restaurant",
  subscription: "Abonnement SaaS",
  retail: "Boutique",
  agency: "Agence de conseil",
};

/**
 * « Mes entreprises » (spec M11.1.5 §5.2) : expose le portefeuille
 * multi-entreprises déjà supporté par le moteur. Le fondateur reste une
 * seule personne — voir `TimeAllocationPanel` dans `BusinessScreen` pour
 * la répartition du temps entre entreprises.
 */
export function PortfolioScreen() {
  const { state } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  if (!gameState) return null;

  return (
    <div className="stack">
      <h1 className="screen-title">Mes entreprises</h1>
      <p className="screen-subtitle">
        Votre temps de fondateur est partagé entre toutes vos entreprises, votre emploi, votre réseau et votre
        apprentissage.
      </p>

      <div className="stack">
        {gameState.businesses.map((business) => {
          const identity = state.businessIdentities[business.id];
          const valuation = business.lastStatement ? computeValuation(business.business, business.lastStatement, business.workforce) : null;
          const age = identity ? ageInYears(identity.createdAt, gameState.date) : 0;
          const isInsolvent = business.business.treasury.isInsolvent;
          const hasUnpaid = business.business.treasury.unpaidObligations > 0;
          return (
            <button
              key={business.id}
              className="card card--interactive"
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => navigate({ screen: "business", businessId: business.id })}
            >
              <div className="row row--between">
                <strong>{identity?.displayName ?? "Mon entreprise"}</strong>
                {isInsolvent ? (
                  <span className="pill pill--danger">Insolvable</span>
                ) : hasUnpaid ? (
                  <span className="pill pill--warning">Impayés</span>
                ) : (
                  <span className="pill">Sain</span>
                )}
              </div>
              <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                {FAMILY_LABELS[business.familyState.family] ?? business.familyState.family}
                {identity ? ` · ${age} an${age > 1 ? "s" : ""}` : ""}
              </p>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <StatTile label="Chiffre d'affaires" value={<Money amount={business.lastStatement?.revenue ?? 0} />} />
                <StatTile
                  label="Résultat net"
                  value={<Money amount={business.lastStatement?.netIncome ?? 0} signed />}
                  tone={(business.lastStatement?.netIncome ?? 0) >= 0 ? "positive" : "negative"}
                />
                <StatTile label="Trésorerie" value={<Money amount={business.business.treasury.cash} />} />
                <StatTile label="Salariés" value={business.workforce.headcount.toFixed(0)} />
              </div>
              {valuation ? (
                <p className="text-tertiary text-sm" style={{ marginTop: 8 }}>
                  Valorisation indicative : <Money amount={valuation.low} /> – <Money amount={valuation.high} />
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <button className="btn btn--secondary" onClick={() => navigate({ screen: "opportunities" })}>
        + Nouvelle entreprise
      </button>
    </div>
  );
}
