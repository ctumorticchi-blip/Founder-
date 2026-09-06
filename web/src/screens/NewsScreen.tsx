import { useGame } from "../state/GameProvider";
import { formatMonthLabel, prettifyEventMessage } from "../lib/format";

const EVENT_ICONS: Record<string, string> = {
  "job-started": "💼",
  "business-created": "🚀",
  "business-liquidated": "⚠️",
  "cash-crisis-warning": "🔶",
  "capital-injected": "💶",
  "market-opportunity-detected": "✨",
};

export function NewsScreen() {
  const { state } = useGame();
  const gameState = state.gameState;
  if (!gameState) return null;

  return (
    <div className="stack">
      <h1 className="screen-title">Actualités</h1>
      <p className="screen-subtitle">Ce qui s'est passé, mois après mois.</p>

      {gameState.events.length > 0 ? (
        <div className="card stack">
          <div className="section-title">Ce mois-ci</div>
          {gameState.events.map((event, index) => (
            <div className="row" key={`${event.kind}-${index}`}>
              <span>{EVENT_ICONS[event.kind] ?? "•"}</span>
              <span className="text-sm">{prettifyEventMessage(event.message)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card stack">
        <div className="section-title">Mémoire de la partie</div>
        {gameState.memory.length === 0 ? (
          <p className="text-sm text-secondary">Rien de marquant pour l'instant.</p>
        ) : (
          [...gameState.memory]
            .reverse()
            .map((entry, index) => (
              <div className="row row--between" key={`${entry.kind}-${index}`}>
                <span className="text-sm">
                  {EVENT_ICONS[entry.kind] ?? "•"} {prettifyEventMessage(entry.message)}
                </span>
                <span className="text-tertiary text-sm">{formatMonthLabel(entry.date)}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
