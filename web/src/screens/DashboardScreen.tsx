import { SKILL_NAMES, detectMarketInefficiency } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { StatTile } from "../components/ui/StatTile";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Money } from "../components/ui/Money";
import { remainingHours, totalAllocatedHours, TOTAL_MONTHLY_HOURS } from "../state/draft";
import { formatHours } from "../lib/format";

const CYCLE_LABELS: Record<string, string> = {
  expansion: "Économie en expansion",
  slowdown: "Ralentissement économique",
  recession: "Récession",
  recovery: "Reprise économique",
};

const FAMILY_LABELS: Record<string, string> = {
  service: "Société de service",
  hospitality: "Café / restaurant",
  subscription: "Abonnement SaaS",
  retail: "Boutique",
  agency: "Agence de conseil",
};

export function DashboardScreen() {
  const { state } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  if (!gameState) return null;

  const allocated = totalAllocatedHours(state.draft);
  const remaining = remainingHours(state.draft);
  const topSkills = [...SKILL_NAMES].sort((a, b) => gameState.character.skills[b] - gameState.character.skills[a]).slice(0, 3);
  const business = gameState.businesses[0] ?? null;
  const businessIdentity = business ? state.businessIdentities[business.id] : undefined;
  const opportunityMarketIds = Object.entries(gameState.markets)
    .filter(([marketId, market]) => detectMarketInefficiency(market, gameState.competitions[marketId]!))
    .map(([marketId]) => marketId);

  return (
    <div className="stack">
      <div className="card">
        <div className="section-title">Votre situation</div>
        <div className="grid-2">
          <StatTile label="Cash personnel" value={<Money amount={gameState.character.cash} />} />
          <StatTile label="Emploi" value={gameState.job ? "En poste" : "Sans emploi"} tone={gameState.job ? "positive" : undefined} />
        </div>
      </div>

      <div className="card card--interactive" onClick={() => navigate({ screen: "career" })}>
        <div className="row row--between">
          <div className="section-title" style={{ marginBottom: 0 }}>
            Temps disponible ce mois-ci
          </div>
          <span className="text-sm text-secondary">{formatHours(remaining)} libres</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <ProgressBar fraction={allocated / TOTAL_MONTHLY_HOURS} tone={remaining < 0 ? "danger" : "default"} />
        </div>
      </div>

      <div className="card card--interactive" onClick={() => navigate({ screen: "skills" })}>
        <div className="section-title">Vos points forts</div>
        <div className="stack stack--tight">
          {topSkills.map((skill) => (
            <div className="row row--between" key={skill}>
              <span className="text-sm" style={{ textTransform: "capitalize" }}>
                {skill}
              </span>
              <span className="text-sm text-secondary">{Math.round(gameState.character.skills[skill])}/100</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="card card--interactive"
        onClick={() => {
          if (gameState.businesses.length > 1) navigate({ screen: "portfolio" });
          else if (business) navigate({ screen: "business", businessId: business.id });
          else navigate({ screen: "opportunities" });
        }}
      >
        <div className="section-title">Entreprise</div>
        {business ? (
          <div className="stack stack--tight">
            <div className="row row--between">
              <strong>{businessIdentity?.displayName ?? FAMILY_LABELS[business.familyState.family] ?? business.familyState.family}</strong>
              {business.business.treasury.isInsolvent ? <span className="pill pill--danger">Insolvable</span> : null}
            </div>
            <div className="grid-2">
              <StatTile label="Trésorerie" value={<Money amount={business.business.treasury.cash} />} />
              <StatTile label="Salariés" value={business.workforce.headcount.toFixed(0)} />
            </div>
          </div>
        ) : (
          <p className="text-secondary text-sm">
            Vous n'avez pas encore d'entreprise. Explorez les opportunités pour vous lancer.
          </p>
        )}
      </div>

      <div className="card">
        <div className="section-title">Le monde</div>
        <p className="text-sm">{CYCLE_LABELS[gameState.macro.cyclePhase] ?? gameState.macro.cyclePhase}</p>
        {opportunityMarketIds.length > 0 ? (
          <button className="pill pill--accent" style={{ marginTop: 8 }} onClick={() => navigate({ screen: "opportunities" })}>
            ✨ {opportunityMarketIds.length} opportunité{opportunityMarketIds.length > 1 ? "s" : ""} détectée{opportunityMarketIds.length > 1 ? "s" : ""}
          </button>
        ) : null}
      </div>

      {gameState.events.length > 0 ? (
        <div className="card card--interactive" onClick={() => navigate({ screen: "news" })}>
          <div className="section-title">Dernières actualités</div>
          <p className="text-sm">{gameState.events[gameState.events.length - 1]!.message}</p>
        </div>
      ) : null}
    </div>
  );
}
