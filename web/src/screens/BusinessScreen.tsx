import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { DecisionFields } from "../components/business/DecisionFields";
import { NumberField } from "../components/ui/NumberField";
import { RangeField } from "../components/ui/RangeField";
import { StatTile } from "../components/ui/StatTile";
import { Money } from "../components/ui/Money";
import { formatHours } from "../lib/format";
import { remainingHours } from "../state/draft";

const FAMILY_LABELS: Record<string, string> = {
  service: "Société de service",
  hospitality: "Café / restaurant",
  subscription: "Abonnement SaaS",
  retail: "Boutique",
  agency: "Agence de conseil",
};

export function BusinessScreen() {
  const { state, updateDecisions, updateBudgets, setCapitalInjection, setTimeAllocation } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  if (!gameState) return null;

  const draftBusiness = state.draft.business;
  const business = draftBusiness ? gameState.businesses.find((b) => b.id === draftBusiness.businessId) ?? null : null;

  if (!draftBusiness) {
    return (
      <div className="stack">
        <h1 className="screen-title">Entreprise</h1>
        <div className="empty-state">
          <div className="empty-state__icon">🏢</div>
          <p>Vous n'avez pas encore d'entreprise.</p>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => navigate({ screen: "opportunities" })}>
            Explorer les opportunités
          </button>
        </div>
      </div>
    );
  }

  const treasury = business?.business.treasury ?? null;

  return (
    <div className="stack">
      <div className="row row--between">
        <h1 className="screen-title" style={{ marginBottom: 0 }}>
          {FAMILY_LABELS[draftBusiness.family] ?? draftBusiness.family}
        </h1>
        {treasury?.isInsolvent ? <span className="pill pill--danger">Insolvable</span> : null}
      </div>
      <p className="screen-subtitle">{draftBusiness.businessId}</p>

      {!business ? (
        <div className="card">
          <p className="text-sm text-secondary">
            🚀 Cette entreprise sera officiellement lancée à la fin de ce mois. Vérifiez vos paramètres ci-dessous puis
            terminez le mois.
          </p>
        </div>
      ) : null}

      <div className="card">
        <RangeField
          label="Votre temps consacré à l'entreprise ce mois-ci"
          value={state.draft.timeAllocation.business}
          max={state.draft.timeAllocation.business + Math.max(0, remainingHours(state.draft))}
          valueLabel={formatHours(state.draft.timeAllocation.business)}
          onChange={(business) => setTimeAllocation({ ...state.draft.timeAllocation, business })}
        />
        {state.draft.timeAllocation.business <= 0 ? (
          <p className="text-sm" style={{ color: "var(--warning)", marginTop: 8 }}>
            ⚠️ Sans votre temps (ni salariés), l'entreprise ne produira rien ce mois-ci.
          </p>
        ) : null}
      </div>

      {treasury ? (
        <div className="card">
          <div className="section-title">Trésorerie</div>
          <div className="grid-2">
            <StatTile label="Cash disponible" value={<Money amount={treasury.cash} />} />
            <StatTile label="Ligne de crédit utilisée" value={<Money amount={treasury.creditLine.drawn} />} tone={treasury.creditLine.drawn > 0 ? "negative" : undefined} />
          </div>
          {treasury.unpaidObligations > 0 ? (
            <div className="pill pill--warning" style={{ marginTop: 10 }}>
              ⚠️ Impayés : <Money amount={treasury.unpaidObligations} />
            </div>
          ) : null}
        </div>
      ) : null}

      {business?.lastStatement ? (
        <div className="card card--interactive" onClick={() => navigate({ screen: "finances" })}>
          <div className="row row--between">
            <div className="section-title" style={{ marginBottom: 0 }}>
              Dernier mois
            </div>
            <span className="text-sm text-secondary">Voir le détail →</span>
          </div>
          <div className="grid-2" style={{ marginTop: 8 }}>
            <StatTile label="Chiffre d'affaires" value={<Money amount={business.lastStatement.revenue} />} />
            <StatTile
              label="Résultat net"
              value={<Money amount={business.lastStatement.netIncome} signed />}
              tone={business.lastStatement.netIncome >= 0 ? "positive" : "negative"}
            />
          </div>
        </div>
      ) : null}

      {business ? (
        <div className="card card--interactive" onClick={() => navigate({ screen: "workforce" })}>
          <div className="row row--between">
            <div>
              <div className="section-title" style={{ marginBottom: 0 }}>
                Équipe
              </div>
              <p className="text-sm text-secondary" style={{ marginTop: 4 }}>
                {business.workforce.headcount.toFixed(0)} salarié(s)
              </p>
            </div>
            <span className="text-sm text-secondary">Gérer →</span>
          </div>
        </div>
      ) : null}

      <div className="card stack">
        <div className="section-title">Décisions du mois</div>
        <DecisionFields decisions={draftBusiness.decisions} onChange={updateDecisions} />
        <NumberField label="Budget marketing" value={draftBusiness.marketingBudget} suffix="€/mois" onChange={(marketingBudget) => updateBudgets({ marketingBudget })} />
        <NumberField label="Loyer" value={draftBusiness.rentBudget} suffix="€/mois" onChange={(rentBudget) => updateBudgets({ rentBudget })} />
        <NumberField label="Administratif" value={draftBusiness.adminBudget} suffix="€/mois" onChange={(adminBudget) => updateBudgets({ adminBudget })} />
        <NumberField label="Investissement ponctuel" value={draftBusiness.capex} suffix="€" onChange={(capex) => updateBudgets({ capex })} />
      </div>

      <div className="card stack">
        <div className="section-title">Apport de capital personnel</div>
        <p className="text-sm text-secondary">
          Cash personnel disponible : <Money amount={gameState.character.cash} />
        </p>
        <NumberField
          label="Apporter à l'entreprise ce mois-ci"
          value={draftBusiness.capitalInjection}
          suffix="€"
          max={gameState.character.cash}
          onChange={setCapitalInjection}
        />
      </div>
    </div>
  );
}
