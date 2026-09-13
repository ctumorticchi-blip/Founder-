import { computeCompetitorMarketShare, createRng, deriveSeed, projectCompetitorView, projectMarketView } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { competitiveIntensityLabel, competitivePositionLabel, marketShareLevelLabel } from "../data/competitorLabels";
import { formatEstimateRange } from "../data/strategicAccountLabels";

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

  const market = gameState.markets[business.marketId];
  const aggregate = gameState.competitions[business.marketId];
  const marketCompetitors = gameState.competitors[business.marketId] ?? [];
  const skills = { finance: gameState.character.skills.finance, strategie: gameState.character.skills.strategie };
  const skillAverage = (skills.finance + skills.strategie) / 2;

  // La projection bruitée dépend d'un rng — dérivé de la seed de partie et
  // du mois courant (spec §9, information imparfaite) : stable pour un
  // mois donné, se rafraîchit d'un mois sur l'autre comme le reste des
  // estimations de marché.
  const seed = state.seed;
  const displayRng = createRng(deriveSeed(seed, "market-study-view", gameState.date.year, gameState.date.month));
  const marketView = market ? projectMarketView(market, skills, displayRng.fork("market")) : null;
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
      <h1 className="screen-title">Étude de marché</h1>
      <p className="screen-subtitle">Estimation du potentiel du marché et de vos concurrents connus.</p>

      {marketView ? (
        <div className="card stack">
          <div className="section-title">Le marché</div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Potentiel mensuel estimé</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {formatEstimateRange(marketView.sizeMonthlyRevenuePotential, "€")}
            </span>
          </div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Croissance mensuelle estimée</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {formatEstimateRange(
                { value: marketView.growthRateMonthly.value * 100, uncertainty: marketView.growthRateMonthly.uncertainty * 100 },
                "%",
              )}
            </span>
          </div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Intensité concurrentielle</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {competitiveIntensityLabel(marketView.competitiveIntensity.value)}
            </span>
          </div>
        </div>
      ) : null}

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
