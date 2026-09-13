import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { getPublicSegmentOptions } from "../data/publicSegments";
import { strategicAccountSourceLabel } from "../data/strategicAccountLabels";

/**
 * Écran consultatif des comptes stratégiques (spec M11.2.4.1 §13) :
 * lecture seule, aucune action de négociation (M11.2.4.2). N'affiche
 * jamais d'id technique ni la valeur brute de `status` (toujours
 * "researching" dans ce jalon, traduit en "À l'étude").
 */
export function StrategicAccountsScreen({ businessId }: { readonly businessId: string }) {
  const { state } = useGame();
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

  const segmentOptions = getPublicSegmentOptions(draftBusiness.family);
  const segmentLabel = (segmentId: string) => segmentOptions.find((s) => s.id === segmentId)?.label ?? segmentId;

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
          <div className="card stack" key={opportunity.id}>
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
                {segmentLabel(opportunity.segmentId)}
              </span>
            </div>
            <div className="row row--between">
              <span className="text-sm text-secondary">Origine</span>
              <span className="text-sm" style={{ fontWeight: 700 }}>
                {strategicAccountSourceLabel(opportunity.source)}
              </span>
            </div>
            <div className="row row--between">
              <span className="text-sm text-secondary">Statut</span>
              <span className="pill">À l'étude</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
