import { detectMarketInefficiency } from "@founder/engine";
import { OPPORTUNITIES } from "../data/opportunities";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";

export function OpportunitiesScreen() {
  const { state } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  if (!gameState) return null;

  const hasBusiness = gameState.businesses.length > 0 || state.draft.business !== null;

  return (
    <div className="stack">
      <h1 className="screen-title">Opportunités</h1>
      <p className="screen-subtitle">
        Le moteur estime en continu l'attractivité de chaque marché. Choisissez une activité à lancer.
      </p>

      {hasBusiness ? (
        <div className="card">
          <p className="text-sm text-secondary">
            Vous gérez déjà une entreprise. Développez-la avant d'en lancer une nouvelle.
          </p>
        </div>
      ) : null}

      <div className="stack">
        {OPPORTUNITIES.map((opportunity) => {
          const competition = gameState.competitions[opportunity.market.id];
          const inefficiency = competition ? detectMarketInefficiency(opportunity.market, competition) : null;
          return (
            <button
              key={opportunity.family}
              className="card card--interactive"
              style={{ textAlign: "left", width: "100%", opacity: hasBusiness ? 0.5 : 1 }}
              disabled={hasBusiness}
              onClick={() => navigate({ screen: "createBusiness", family: opportunity.family })}
            >
              <div className="row row--between">
                <div className="row">
                  <span style={{ fontSize: 28 }}>{opportunity.icon}</span>
                  <strong>{opportunity.title}</strong>
                </div>
                {inefficiency ? <span className="pill pill--accent">Opportunité</span> : null}
              </div>
              <p className="text-secondary text-sm" style={{ marginTop: 8 }}>
                {opportunity.pitch}
              </p>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <span className="pill">Capital {capitalLabel(opportunity.market.capitalIntensity)}</span>
                <span className="pill">Barrières {capitalLabel(opportunity.market.entryBarriers)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function capitalLabel(value: number): string {
  if (value < 0.25) return "faible";
  if (value < 0.5) return "modéré";
  return "élevé";
}
