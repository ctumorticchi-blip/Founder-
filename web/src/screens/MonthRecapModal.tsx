import { useGame } from "../state/GameProvider";
import { Money } from "../components/ui/Money";
import { formatMonthLabel, prettifyEventMessage } from "../lib/format";
import type { MonthRecap } from "../state/types";

export function MonthRecapModal({ recap }: { readonly recap: MonthRecap }) {
  const { dismissRecap } = useGame();
  const delta = recap.cashAfter - recap.cashBefore;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-sheet stack">
        <div>
          <div className="text-tertiary text-sm">Mois terminé</div>
          <h2 className="screen-title" style={{ marginTop: 4 }}>
            {formatMonthLabel(recap.date)} ({recap.ageYears} ans)
          </h2>
        </div>

        <div className="card">
          <div className="row row--between">
            <span className="text-sm text-secondary">Cash personnel</span>
            <span style={{ fontWeight: 700 }}>
              <Money amount={recap.cashAfter} /> <span className="text-secondary text-sm">(<Money amount={delta} signed />)</span>
            </span>
          </div>
        </div>

        {recap.businessSummaries.length > 0 ? (
          <div className="card stack">
            <div className="section-title">Entreprises</div>
            {recap.businessSummaries.map((summary) => (
              <div className="row row--between" key={summary.id}>
                <span className="text-sm">{summary.id}</span>
                <span className="text-sm">
                  CA <Money amount={summary.revenue} /> · résultat <Money amount={summary.netIncome} signed />
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {recap.events.length > 0 ? (
          <div className="card stack">
            <div className="section-title">Événements</div>
            {recap.events.map((event, index) => (
              <p className="text-sm" key={`${event.kind}-${index}`}>
                {prettifyEventMessage(event.message)}
              </p>
            ))}
          </div>
        ) : null}

        <button className="btn btn--primary" onClick={dismissRecap}>
          Continuer
        </button>
      </div>
    </div>
  );
}
