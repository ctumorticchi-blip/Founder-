import { ageInYears } from "@founder/engine";
import { useGame } from "../../state/GameProvider";
import { useNavigation } from "../../state/Navigation";
import { formatMonthLabel, formatMoney } from "../../lib/format";

export function StatusBar() {
  const { state } = useGame();
  const { navigate } = useNavigation();
  if (!state.gameState || !state.birthDate) return null;

  const eventCount = state.gameState.events.length;
  const age = ageInYears(state.birthDate, state.gameState.date);

  return (
    <header className="status-bar">
      <div className="status-bar__row">
        <div>
          <div className="status-bar__date">{formatMonthLabel(state.gameState.date)}</div>
          <div className="status-bar__age">{age} ans</div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="status-bar__cash">{formatMoney(state.gameState.character.cash)}</span>
          <button className="status-bar__bell" onClick={() => navigate({ screen: "news" })} aria-label="Actualités">
            🔔
            {eventCount > 0 ? <span className="status-bar__badge">{eventCount}</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}
