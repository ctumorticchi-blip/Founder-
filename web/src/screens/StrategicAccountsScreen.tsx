import { useState } from "react";
import { computeAccountConcentration, type AccountProposal, type EconomicFamily, type StrategicAccountAction, type StrategicAccountOpportunity } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { getPublicSegmentOptions } from "../data/publicSegments";
import { demandUnitLabel } from "../data/offerModels";
import {
  accountSatisfactionLabel,
  concentrationRiskLabel,
  formatEstimateRange,
  strategicAccountSourceLabel,
  trustLevelLabel,
} from "../data/strategicAccountLabels";
import { NumberField } from "../components/ui/NumberField";

/** Remplace toute action antérieure du même type sur la même opportunité par la nouvelle (évite d'empiler deux "invest-time" le même mois). */
function replaceStrategicAccountAction(
  actions: readonly StrategicAccountAction[],
  opportunityId: string,
  next: StrategicAccountAction,
): readonly StrategicAccountAction[] {
  return [...actions.filter((a) => !(a.opportunityId === opportunityId && a.kind === next.kind)), next];
}

function ProposalForm({
  unit,
  initial,
  submitLabel,
  onSubmit,
}: {
  readonly unit: string;
  readonly initial: AccountProposal;
  readonly submitLabel: string;
  readonly onSubmit: (proposal: AccountProposal) => void;
}) {
  const [price, setPrice] = useState(Math.round(initial.price));
  const [volume, setVolume] = useState(Math.round(initial.volume));
  const [qualityCommitment, setQualityCommitment] = useState(Math.round(initial.qualityCommitment));
  const [durationMonths, setDurationMonths] = useState(initial.durationMonths);

  return (
    <div className="stack">
      <NumberField label="Prix proposé" value={price} suffix="€" onChange={setPrice} />
      <NumberField label="Volume engagé" value={volume} suffix={unit} onChange={setVolume} />
      <NumberField label="Engagement de qualité" value={qualityCommitment} min={0} max={100} suffix="/100" onChange={setQualityCommitment} />
      <NumberField label="Durée" value={durationMonths} min={1} suffix="mois" onChange={setDurationMonths} />
      <button className="btn btn--primary" onClick={() => onSubmit({ price, volume, qualityCommitment, durationMonths })}>
        {submitLabel}
      </button>
    </div>
  );
}

function OpportunityCard({
  opportunity,
  family,
  businessRevenueThisMonth,
  onInvestTime,
  onNegotiate,
}: {
  readonly opportunity: StrategicAccountOpportunity;
  readonly family: EconomicFamily;
  readonly businessRevenueThisMonth: number;
  readonly onInvestTime: (hours: number) => void;
  readonly onNegotiate: (action: Extract<StrategicAccountAction, { kind: "propose" | "accept" | "counter" | "withdraw" }>) => void;
}) {
  const [investHours, setInvestHours] = useState(5);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const segmentOptions = getPublicSegmentOptions(family);
  const segmentLabel = segmentOptions.find((s) => s.id === opportunity.segmentId)?.label ?? opportunity.segmentId;
  const unit = demandUnitLabel(family);

  return (
    <div className="card stack">
      <div className="section-title">{opportunity.companyName}</div>
      <div className="row row--between">
        <span className="text-sm text-secondary">Interlocuteur</span>
        <span className="text-sm" style={{ fontWeight: 700 }}>
          {opportunity.contactName} — {opportunity.contactRole}
        </span>
      </div>
      <div className="row row--between">
        <span className="text-sm text-secondary">Segment</span>
        <span className="text-sm" style={{ fontWeight: 700 }}>
          {segmentLabel}
        </span>
      </div>
      <div className="row row--between">
        <span className="text-sm text-secondary">Origine</span>
        <span className="text-sm" style={{ fontWeight: 700 }}>
          {strategicAccountSourceLabel(opportunity.source)}
        </span>
      </div>

      {opportunity.status === "won" && opportunity.contract ? (
        <>
          <div className="row row--between">
            <span className="text-sm text-secondary">Statut</span>
            <span className="pill pill--accent">Contrat signé</span>
          </div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Montant</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {Math.round(opportunity.contract.price).toLocaleString("fr-FR")} € · {Math.round(opportunity.contract.volume)} {unit}
            </span>
          </div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Durée</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {opportunity.contract.durationMonths} mois
            </span>
          </div>
          {opportunity.relationship ? (
            <>
              <div className="row row--between">
                <span className="text-sm text-secondary">Satisfaction</span>
                <span className="text-sm" style={{ fontWeight: 700 }}>
                  {accountSatisfactionLabel(opportunity.relationship.satisfaction.smoothedScore)}
                </span>
              </div>
              <div className="row row--between">
                <span className="text-sm text-secondary">Confiance</span>
                <span className="text-sm" style={{ fontWeight: 700 }}>
                  {trustLevelLabel(opportunity.relationship.trust)}
                </span>
              </div>
              <div className="row row--between">
                <span className="text-sm text-secondary">Concentration</span>
                <span className="text-sm" style={{ fontWeight: 700 }}>
                  {Math.round(
                    computeAccountConcentration(opportunity.contract.lastMonthServedVolume * opportunity.contract.price, businessRevenueThisMonth) * 100,
                  )}
                  % du CA · {concentrationRiskLabel(computeAccountConcentration(opportunity.contract.lastMonthServedVolume * opportunity.contract.price, businessRevenueThisMonth))}
                </span>
              </div>
            </>
          ) : (
            <div className="row row--between">
              <span className="text-sm text-secondary">Satisfaction</span>
              <span className="text-sm text-secondary">Pas encore d'historique de livraison</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="row row--between">
            <span className="text-sm text-secondary">Statut</span>
            <span className="pill">{opportunity.status === "negotiating" ? "En négociation" : "À l'étude"}</span>
          </div>

          <div className="row row--between">
            <span className="text-sm text-secondary">Temps de recherche investi</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {Math.round(opportunity.researchHoursInvested)} h
            </span>
          </div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Budget estimé</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {formatEstimateRange(opportunity.budgetEstimate.price, "€")}
            </span>
          </div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Volume attendu</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {formatEstimateRange(opportunity.budgetEstimate.volume, unit)}
            </span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
            <NumberField label="Investir du temps" value={investHours} min={1} suffix="h" onChange={setInvestHours} />
            <button className="btn btn--secondary" onClick={() => onInvestTime(investHours)}>
              Investir
            </button>
          </div>

          {opportunity.status === "negotiating" && opportunity.lastAccountProposal ? (
            <div className="stack" style={{ marginTop: 8 }}>
              <div className="text-sm text-secondary">Dernière proposition du compte</div>
              <div className="row row--between">
                <span className="text-sm text-secondary">Prix</span>
                <span className="text-sm" style={{ fontWeight: 700 }}>
                  {Math.round(opportunity.lastAccountProposal.price).toLocaleString("fr-FR")} €
                </span>
              </div>
              <div className="row row--between">
                <span className="text-sm text-secondary">Volume</span>
                <span className="text-sm" style={{ fontWeight: 700 }}>
                  {Math.round(opportunity.lastAccountProposal.volume)} {unit}
                </span>
              </div>
              <button className="btn btn--primary" onClick={() => onNegotiate({ kind: "accept", opportunityId: opportunity.id })}>
                Accepter
              </button>
            </div>
          ) : null}

          {showProposalForm ? (
            <ProposalForm
              unit={unit}
              submitLabel={opportunity.status === "negotiating" ? "Contre-proposer" : "Proposer"}
              initial={
                opportunity.lastAccountProposal ?? {
                  price: Math.round(opportunity.budgetEstimate.price.value),
                  volume: Math.round(opportunity.budgetEstimate.volume.value),
                  qualityCommitment: Math.round(opportunity.budgetEstimate.qualityCommitment.value),
                  durationMonths: 6,
                }
              }
              onSubmit={(proposal) => {
                onNegotiate(
                  opportunity.status === "negotiating"
                    ? { kind: "counter", opportunityId: opportunity.id, proposal }
                    : { kind: "propose", opportunityId: opportunity.id, proposal },
                );
                setShowProposalForm(false);
              }}
            />
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn--ghost" onClick={() => setShowProposalForm(true)}>
                {opportunity.status === "negotiating" ? "Contre-proposer" : "Proposer un contrat"}
              </button>
              <button className="btn btn--ghost" onClick={() => onNegotiate({ kind: "withdraw", opportunityId: opportunity.id })}>
                Abandonner
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Écran des comptes stratégiques (spec M11.2.4.1 §13, étendu M11.2.4.2) :
 * consultation + négociation (temps investi, proposition, acceptation
 * d'une contre-proposition, abandon). N'affiche jamais d'id technique ni
 * la valeur brute de `status`/`uncertainty`.
 */
export function StrategicAccountsScreen({ businessId }: { readonly businessId: string }) {
  const { state, setStrategicAccountActions } = useGame();
  const { navigate } = useNavigation();
  const business = state.gameState?.businesses.find((b) => b.id === businessId) ?? null;
  const draftBusiness = state.draft.businesses.find((b) => b.businessId === businessId) ?? null;

  if (!business || !draftBusiness) {
    return (
      <div className="empty-state">
        <p>Aucun compte stratégique à afficher.</p>
      </div>
    );
  }

  const queueAction = (action: StrategicAccountAction) => {
    setStrategicAccountActions(businessId, replaceStrategicAccountAction(draftBusiness.strategicAccountActions, action.opportunityId, action));
  };

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "business", businessId })}>
        ← Entreprise
      </button>
      <h1 className="screen-title">Comptes stratégiques</h1>
      <p className="screen-subtitle">Opportunités de grands comptes en cours d'étude.</p>

      {business.strategicAccountOpportunities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🤝</div>
          <p>Aucune opportunité pour l'instant. Une démarche commerciale ciblée peut en faire émerger une.</p>
        </div>
      ) : (
        business.strategicAccountOpportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            family={draftBusiness.family}
            businessRevenueThisMonth={business.lastStatement?.revenue ?? 0}
            onInvestTime={(hours) => queueAction({ kind: "invest-time", opportunityId: opportunity.id, hours })}
            onNegotiate={queueAction}
          />
        ))
      )}
    </div>
  );
}
