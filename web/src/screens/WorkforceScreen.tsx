import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { NumberField } from "../components/ui/NumberField";
import { StatTile } from "../components/ui/StatTile";
import { Money } from "../components/ui/Money";

export function WorkforceScreen() {
  const { state, setTargetHeadcount } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  const business = gameState?.businesses.find((b) => b.id === state.draft.business?.businessId) ?? null;

  if (!gameState || !business || !state.draft.business) {
    return (
      <div className="empty-state">
        <p>Aucune entreprise à gérer.</p>
      </div>
    );
  }

  const targetHeadcount = state.draft.business.targetHeadcount ?? business.workforce.headcount;
  const delta = targetHeadcount - business.workforce.headcount;

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "business" })}>
        ← Entreprise
      </button>
      <h1 className="screen-title">Équipe</h1>
      <p className="screen-subtitle">Un effectif agrégé : recruter augmente votre capacité de production, mais coûte un salaire chaque mois et un coût de recrutement le mois de l'embauche.</p>

      <div className="card">
        <div className="grid-2">
          <StatTile label="Salariés actuels" value={business.workforce.headcount.toFixed(0)} />
          <StatTile label="Salaire moyen" value={<Money amount={business.workforce.averageMonthlySalary} />} />
        </div>
      </div>

      <div className="card stack">
        <NumberField label="Effectif cible pour ce mois" value={targetHeadcount} min={0} onChange={setTargetHeadcount} />
        {delta !== 0 ? (
          <p className="text-sm text-secondary">
            {delta > 0 ? `Recrutement de ${delta} personne(s)` : `Licenciement de ${Math.abs(delta)} personne(s)`} — le coût réel sera visible dans le résultat du mois.
          </p>
        ) : (
          <p className="text-sm text-tertiary">Effectif inchangé ce mois-ci.</p>
        )}
      </div>
    </div>
  );
}
