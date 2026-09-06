import { SKILL_NAMES } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { SkillBar } from "../components/ui/SkillBar";
import { RangeField } from "../components/ui/RangeField";
import { formatHours } from "../lib/format";
import { remainingHours } from "../state/draft";

const SKILL_LABELS: Record<string, string> = {
  vente: "Vente",
  produit: "Produit",
  marketing: "Marketing",
  finance: "Finance",
  management: "Management",
  leadership: "Leadership",
  negociation: "Négociation",
  operations: "Opérations",
  technologie: "Technologie",
  strategie: "Stratégie",
  reseau: "Réseau",
  influence: "Influence",
};

export function SkillsScreen() {
  const { state, setTimeAllocation } = useGame();
  const gameState = state.gameState;
  if (!gameState) return null;
  const draft = state.draft;

  const maxFor = (category: "apprentissage" | "reseau") => draft.timeAllocation[category] + Math.max(0, remainingHours(draft));

  return (
    <div className="stack">
      <h1 className="screen-title">Talents</h1>
      <p className="screen-subtitle">Vos compétences progressent avec le temps que vous y consacrez.</p>

      <div className="card stack">
        <RangeField
          label="Apprentissage (fait progresser votre technologie)"
          value={draft.timeAllocation.apprentissage}
          max={maxFor("apprentissage")}
          valueLabel={formatHours(draft.timeAllocation.apprentissage)}
          onChange={(value) => setTimeAllocation({ ...draft.timeAllocation, apprentissage: value })}
        />
        <RangeField
          label="Réseau (fait progresser votre réseau)"
          value={draft.timeAllocation.reseau}
          max={maxFor("reseau")}
          valueLabel={formatHours(draft.timeAllocation.reseau)}
          onChange={(value) => setTimeAllocation({ ...draft.timeAllocation, reseau: value })}
        />
      </div>

      <div className="card stack">
        <div className="section-title">Vos compétences (0-100)</div>
        {SKILL_NAMES.map((skill) => (
          <SkillBar key={skill} label={SKILL_LABELS[skill] ?? skill} value={gameState.character.skills[skill]} />
        ))}
      </div>
    </div>
  );
}
