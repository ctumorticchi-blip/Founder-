import { useGame } from "../state/GameProvider";

export function OnboardingScreen() {
  const { newGame } = useGame();

  return (
    <div className="onboarding">
      <div>
        <div className="onboarding__brand">FOUNDER</div>
        <h1 className="onboarding__title">18 ans. 0 €. Aucun diplôme.</h1>
        <p className="onboarding__lede">
          À vous de construire votre trajectoire : petit boulot, premières économies, votre première entreprise —
          jusqu'où irez-vous ?
        </p>
        <div className="onboarding__facts">
          <div className="onboarding__fact">
            <div className="onboarding__fact-value">18</div>
            <div className="onboarding__fact-label">ans</div>
          </div>
          <div className="onboarding__fact">
            <div className="onboarding__fact-value">0 €</div>
            <div className="onboarding__fact-label">en poche</div>
          </div>
          <div className="onboarding__fact">
            <div className="onboarding__fact-value">1 mois</div>
            <div className="onboarding__fact-label">par tour</div>
          </div>
        </div>
      </div>
      <div className="stack">
        <button className="btn btn--primary" onClick={newGame}>
          Commencer ma vie
        </button>
        <p className="text-tertiary text-sm" style={{ textAlign: "center" }}>
          Votre partie est sauvegardée automatiquement sur cet appareil.
        </p>
      </div>
    </div>
  );
}
