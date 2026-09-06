import { JOB_OFFERS } from "../data/jobs";
import { useGame } from "../state/GameProvider";
import { RangeField } from "../components/ui/RangeField";
import { Money } from "../components/ui/Money";
import { formatHours } from "../lib/format";
import { remainingHours, TOTAL_MONTHLY_HOURS } from "../state/draft";

export function CareerScreen() {
  const { state, setJob, setTimeAllocation } = useGame();
  const draft = state.draft;
  const job = draft.job;

  const maxEmploiHours = draft.timeAllocation.emploi + Math.max(0, remainingHours(draft));

  return (
    <div className="stack">
      <h1 className="screen-title">Carrière</h1>
      <p className="screen-subtitle">Un emploi rapporte du cash immédiat et fait progresser vos compétences opérationnelles.</p>

      {job ? (
        <div className="card stack">
          <div className="row row--between">
            <div>
              <div style={{ fontWeight: 700 }}>{job.label}</div>
              <div className="text-secondary text-sm">
                <Money amount={job.hourlyWage} precise /> / heure
              </div>
            </div>
            <button
              className="btn btn--danger"
              style={{ width: "auto", padding: "8px 14px" }}
              onClick={() => {
                setJob(null);
                setTimeAllocation({ ...draft.timeAllocation, emploi: 0 });
              }}
            >
              Quitter
            </button>
          </div>
          <RangeField
            label="Heures travaillées ce mois"
            value={draft.timeAllocation.emploi}
            max={maxEmploiHours}
            valueLabel={formatHours(draft.timeAllocation.emploi)}
            onChange={(value) => setTimeAllocation({ ...draft.timeAllocation, emploi: value })}
          />
          <p className="text-tertiary text-sm">
            Revenu estimé ce mois-ci : <Money amount={draft.timeAllocation.emploi * job.hourlyWage} />
          </p>
        </div>
      ) : (
        <div className="stack">
          {JOB_OFFERS.map((offer) => (
            <button
              key={offer.id}
              className="card card--interactive"
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => {
                setJob({ offerId: offer.id, label: offer.label, hourlyWage: offer.hourlyWage });
                setTimeAllocation({ ...draft.timeAllocation, emploi: Math.min(120, TOTAL_MONTHLY_HOURS) });
              }}
            >
              <div className="row row--between">
                <strong>{offer.label}</strong>
                <span className="pill pill--accent">
                  <Money amount={offer.hourlyWage} precise />/h
                </span>
              </div>
              <p className="text-secondary text-sm" style={{ marginTop: 6 }}>
                {offer.description}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
