import { useGame } from "../../state/GameProvider";
import { useNavigation, type Route } from "../../state/Navigation";

const TABS: ReadonlyArray<{ readonly screen: Route["screen"]; readonly label: string; readonly icon: string }> = [
  { screen: "dashboard", label: "Accueil", icon: "🏠" },
  { screen: "career", label: "Carrière", icon: "💼" },
  { screen: "skills", label: "Talents", icon: "🎯" },
  { screen: "business", label: "Entreprise", icon: "🏢" },
  { screen: "finances", label: "Finances", icon: "📊" },
];

export function BottomNav() {
  const { route, navigate } = useNavigation();
  const { endMonth } = useGame();

  return (
    <nav className="bottom-nav">
      {TABS.slice(0, 2).map((tab) => (
        <NavItem key={tab.screen} tab={tab} active={route.screen === tab.screen} onClick={() => navigate(routeFor(tab.screen))} />
      ))}
      <button className="bottom-nav__end-month" onClick={endMonth} aria-label="Terminer le mois">
        <span className="bottom-nav__end-month-icon">▶</span>
        <span>Fin de mois</span>
      </button>
      {TABS.slice(2).map((tab) => (
        <NavItem key={tab.screen} tab={tab} active={route.screen === tab.screen} onClick={() => navigate(routeFor(tab.screen))} />
      ))}
    </nav>
  );
}

function routeFor(screen: Route["screen"]): Route {
  if (screen === "createBusiness") return { screen: "createBusiness", family: "" };
  return { screen } as Route;
}

function NavItem({
  tab,
  active,
  onClick,
}: {
  readonly tab: { readonly screen: Route["screen"]; readonly label: string; readonly icon: string };
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
