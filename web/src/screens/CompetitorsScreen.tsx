import { computeCompetitorMarketShare, createRng, deriveSeed, projectCompetitorView } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { competitivePositionLabel, marketShareLevelLabel } from "../data/competitorLabels";

export function CompetitorsScreen({ businessId }: { readonly businessId: string }) {
  const { state } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  const business = gameState?.businesses.find((b) => b.id === businessId) ?? null;

  if (!gameState || !business || state.seed === null) {
    return (
      <div className="empty-state">
        <p>Aucun concurrent à afficher.</p>
      </div>
    );
  }

  const aggregate = gameState.competitions[business.marketId];
  const marketCompetitors = gameState.competitors[business.marketId] ?? [];
  const skillAverage = (gameState.character.skills.finance + gameState.character.skills.strategie) / 2;

  // La projection bruitée dépend d'un rng — dérivé de la seed de partie et
  // du mois courant (spec §9, information imparfaite) : stable pour un
  // mois donné, se rafraîchit d'un mois sur l'autre comme le reste des
  // estimations de marché.
  const seed = state.seed;
  const displayRng = createRng(deriveSeed(seed, "competitors-view", gameState.date.year, gameState.date.month));
  const views =
    aggregate && marketCompetitors.length > 0
      ? marketCompetitors.map((competitor) => {
          const marketShare = computeCompetitorMarketShare(competitor, marketCompetitors, aggregate);
          return projectCompetitorView(competitor, marketShare, skillAverage, displayRng.fork(competitor.id));
        })
      : [];

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "business", businessId })}>
        ← Entreprise
      </button>
      <h1 className="screen-title">Concurrents identifiés</h1>
      <p className="screen-subtitle">Estimation du positionnement et de la part de marché de vos concurrents connus.</p>

      {views.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🔍</div>
          <p>Aucun concurrent identifié pour l'instant sur ce marché.</p>
        </div>
      ) : (
        views.map((view) => (
          <div className="card stack" key={view.id}>
            <div className="section-title">{view.name}</div>
            <div className="row row--between">
              <span className="text-sm text-secondary">Positionnement estimé</span>
              <span className="text-sm" style={{ fontWeight: 700 }}>
                {competitivePositionLabel(view.positionLevel)}
              </span>
            </div>
            <div className="row row--between">
              <span className="text-sm text-secondary">Part de marché estimée</span>
              <span className="text-sm" style={{ fontWeight: 700 }}>
                {marketShareLevelLabel(view.shareLevel)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
