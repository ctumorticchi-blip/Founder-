import { useGame } from "../../state/GameProvider";
import { useNavigation } from "../../state/Navigation";

export function BottomNav() {
  const { route, navigate } = useNavigation();
  const { state, endMonth } = useGame();
  const businesses = state.draft.businesses;

  // Progressive disclosure (spec M11.1.5 §G) : une seule entreprise -> accès
  // direct à sa fiche, plusieurs -> portefeuille, aucune -> opportunités.
  const goToBusiness = () => {
    if (businesses.length === 0) navigate({ screen: "opportunities" });
    else if (businesses.length === 1) navigate({ screen: "business", businessId: businesses[0]!.businessId });
    else navigate({ screen: "portfolio" });
  };
  const goToFinances = () => navigate({ screen: "finances" });

  const businessActive = route.screen === "business" || route.screen === "portfolio" || route.screen === "workforce";

  return (
    <nav className="bottom-nav">
      <NavItem tab={{ label: "Accueil", icon: "🏠" }} active={route.screen === "dashboard"} onClick={() => navigate({ screen: "dashboard" })} />
      <NavItem tab={{ label: "Carrière", icon: "💼" }} active={route.screen === "career"} onClick={() => navigate({ screen: "career" })} />
      <button className="bottom-nav__end-month" onClick={endMonth} aria-label="Terminer le mois">
        <span className="bottom-nav__end-month-icon">▶</span>
        <span>Fin de mois</span>
      </button>
      <NavItem tab={{ label: "Talents", icon: "🎯" }} active={route.screen === "skills"} onClick={() => navigate({ screen: "skills" })} />
      <NavItem tab={{ label: "Entreprise", icon: "🏢" }} active={businessActive} onClick={goToBusiness} />
      <NavItem tab={{ label: "Finances", icon: "📊" }} active={route.screen === "finances"} onClick={goToFinances} />
    </nav>
  );
}

function NavItem({
  tab,
  active,
  onClick,
}: {
  readonly tab: { readonly label: string; readonly icon: string };
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button className={`bottom-nav__item${active ? " bottom-nav__item--active" : ""}`} onClick={onClick}>
      <span className="bottom-nav__item-icon">{tab.icon}</span>
      <span>{tab.label}</span>
    </button>
  );
}
