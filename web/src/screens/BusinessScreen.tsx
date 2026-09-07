import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { DecisionFields } from "../components/business/DecisionFields";
import { InfrastructurePicker } from "../components/business/InfrastructurePicker";
import { AdminBreakdown } from "../components/business/AdminBreakdown";
import { CapexPicker } from "../components/business/CapexPicker";
import { TimeAllocationPanel } from "../components/business/TimeAllocationPanel";
import { PropertyPurchasePanel } from "../components/business/PropertyPurchasePanel";
import { SalePanel } from "../components/business/SalePanel";
import { NumberField } from "../components/ui/NumberField";
import { StatTile } from "../components/ui/StatTile";
import { Money } from "../components/ui/Money";
import { totalFounderBusinessHours } from "../state/draft";
import { computeValuation } from "@founder/engine";

const FAMILY_LABELS: Record<string, string> = {
  service: "Société de service",
  hospitality: "Café / restaurant",
  subscription: "Abonnement SaaS",
  retail: "Boutique",
  agency: "Agence de conseil",
};

export function BusinessScreen({ businessId }: { readonly businessId: string }) {
  const {
    state,
    updateDecisions,
    setMarketingBudget,
    setInfrastructure,
    setAdminOptionalIds,
    setPurchases,
    setCapitalInjection,
    setProspectionHours,
    setFounderHours,
    setPropertyPurchase,
    setSaleDecision,
  } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  if (!gameState) return null;

  const draftBusiness = state.draft.businesses.find((b) => b.businessId === businessId) ?? null;
  const business = gameState.businesses.find((b) => b.id === businessId) ?? null;

  if (!draftBusiness) {
    return (
      <div className="stack">
        <h1 className="screen-title">Entreprise</h1>
        <div className="empty-state">
          <div className="empty-state__icon">🏢</div>
          <p>Cette entreprise n'existe plus.</p>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => navigate({ screen: "opportunities" })}>
            Explorer les opportunités
          </button>
        </div>
      </div>
    );
  }

  const treasury = business?.business.treasury ?? null;
  const identity = state.businessIdentities[draftBusiness.businessId];

  // Bornes de temps (spec M11.1.5 §5.3, §7.2) : le budget "business" est
  // partagé entre TOUTES les entreprises — jamais un dédoublement de temps.
  const usedByOtherBusinesses = totalFounderBusinessHours(state.draft) - draftBusiness.founderHoursAllocated - draftBusiness.prospectionHours;
  const budgetRemainingForThisBusiness = Math.max(0, state.draft.timeAllocation.business - usedByOtherBusinesses);
  const founderHoursMax = Math.max(0, budgetRemainingForThisBusiness - draftBusiness.prospectionHours);
  const prospectionHoursMax = Math.max(0, budgetRemainingForThisBusiness - draftBusiness.founderHoursAllocated);

  const valuation = business?.lastStatement ? computeValuation(business.business, business.lastStatement, business.workforce) : null;

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "portfolio" })}>
        ← Mes entreprises
      </button>
      <div className="row row--between">
        <h1 className="screen-title" style={{ marginBottom: 0 }}>
          {identity?.displayName ?? "Mon entreprise"}
        </h1>
        {treasury?.isInsolvent ? <span className="pill pill--danger">Insolvable</span> : null}
      </div>
      <p className="screen-subtitle">{FAMILY_LABELS[draftBusiness.family] ?? draftBusiness.family}</p>

      {!business ? (
        <div className="card">
          <p className="text-sm text-secondary">
            🚀 Cette entreprise sera officiellement lancée à la fin de ce mois. Vérifiez vos paramètres ci-dessous puis
            terminez le mois.
          </p>
        </div>
      ) : null}

      <div className="card">
        <TimeAllocationPanel
          founderHoursAllocated={draftBusiness.founderHoursAllocated}
          prospectionHours={draftBusiness.prospectionHours}
          founderHoursMax={founderHoursMax}
          prospectionHoursMax={prospectionHoursMax}
          onFounderHoursChange={(value) => setFounderHours(draftBusiness.businessId, value)}
          onProspectionHoursChange={(value) => setProspectionHours(draftBusiness.businessId, value)}
        />
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
        <div className="card card--interactive" onClick={() => navigate({ screen: "finances", businessId: draftBusiness.businessId })}>
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
        <div className="card card--interactive" onClick={() => navigate({ screen: "workforce", businessId: draftBusiness.businessId })}>
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
        <DecisionFields decisions={draftBusiness.decisions} onChange={(decisions) => updateDecisions(draftBusiness.businessId, decisions)} />
        <NumberField
          label="Budget marketing"
          value={draftBusiness.marketingBudget}
          suffix="€/mois"
          onChange={(value) => setMarketingBudget(draftBusiness.businessId, value)}
        />
      </div>

      <div className="card">
        <InfrastructurePicker
          family={draftBusiness.family}
          selectedId={draftBusiness.infrastructureId}
          isNew={draftBusiness.isNew}
          committedInfrastructureId={draftBusiness.committedInfrastructureId}
          currentHeadcount={business?.workforce.headcount}
          onChange={(infrastructureId) => setInfrastructure(draftBusiness.businessId, infrastructureId)}
        />
      </div>

      <div className="card">
        <AdminBreakdown optionalIds={draftBusiness.adminOptionalIds} onChange={(ids) => setAdminOptionalIds(draftBusiness.businessId, ids)} />
      </div>

      <div className="card">
        <CapexPicker purchases={draftBusiness.purchases} onChange={(purchases) => setPurchases(draftBusiness.businessId, purchases)} />
      </div>

      {business && draftBusiness.infrastructureId !== "domicile" ? (
        <div className="card">
          <PropertyPurchasePanel
            family={draftBusiness.family}
            ownedProperties={business.business.properties}
            propertyPurchase={draftBusiness.propertyPurchase}
            personalCash={gameState.character.cash}
            onSelect={(listingId) => setPropertyPurchase(draftBusiness.businessId, { listingId, downPaymentFromPersonalCash: 0 })}
            onDownPaymentChange={(value) =>
              draftBusiness.propertyPurchase &&
              setPropertyPurchase(draftBusiness.businessId, { ...draftBusiness.propertyPurchase, downPaymentFromPersonalCash: value })
            }
            onClear={() => setPropertyPurchase(draftBusiness.businessId, null)}
          />
        </div>
      ) : null}

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
          onChange={(value) => setCapitalInjection(draftBusiness.businessId, value)}
        />
      </div>

      {business && valuation ? (
        <div className="card">
          <SalePanel
            valuation={valuation}
            saleProcess={business.saleProcess}
            hasPendingDecision={draftBusiness.saleDecision !== null}
            onList={() => setSaleDecision(draftBusiness.businessId, { action: "list" })}
            onWithdraw={() => setSaleDecision(draftBusiness.businessId, { action: "withdraw" })}
            onAccept={() => setSaleDecision(draftBusiness.businessId, { action: "accept" })}
            onReject={() => setSaleDecision(draftBusiness.businessId, { action: "reject" })}
            onCounter={(amount) => setSaleDecision(draftBusiness.businessId, { action: "counter", counterAmount: amount })}
          />
        </div>
      ) : null}
    </div>
  );
}
