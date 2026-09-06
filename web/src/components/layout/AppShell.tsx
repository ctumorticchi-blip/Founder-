import { useGame } from "../../state/GameProvider";
import { useNavigation, type Route } from "../../state/Navigation";
import { StatusBar } from "./StatusBar";
import { BottomNav } from "./BottomNav";
import { DashboardScreen } from "../../screens/DashboardScreen";
import { CareerScreen } from "../../screens/CareerScreen";
import { SkillsScreen } from "../../screens/SkillsScreen";
import { OpportunitiesScreen } from "../../screens/OpportunitiesScreen";
import { CreateBusinessScreen } from "../../screens/CreateBusinessScreen";
import { BusinessScreen } from "../../screens/BusinessScreen";
import { WorkforceScreen } from "../../screens/WorkforceScreen";
import { FinancesScreen } from "../../screens/FinancesScreen";
import { NewsScreen } from "../../screens/NewsScreen";
import { MonthRecapModal } from "../../screens/MonthRecapModal";

export function AppShell() {
  const { state, clearError } = useGame();
  const { route } = useNavigation();

  return (
    <div className="app-shell">
      <StatusBar />
      <main className="app-shell__content">
        <Screen route={route} />
      </main>
      <BottomNav />
      {state.lastRecap ? <MonthRecapModal recap={state.lastRecap} /> : null}
      {state.error ? (
        <div className="toast" role="alert">
          {state.error}
          <button className="btn btn--ghost" style={{ width: "auto", padding: "4px 8px", marginTop: 4 }} onClick={clearError}>
            Fermer
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Screen({ route }: { readonly route: Route }) {
  switch (route.screen) {
    case "dashboard":
      return <DashboardScreen />;
    case "career":
      return <CareerScreen />;
    case "skills":
      return <SkillsScreen />;
    case "opportunities":
      return <OpportunitiesScreen />;
    case "createBusiness":
      return <CreateBusinessScreen family={route.family} />;
    case "business":
      return <BusinessScreen />;
    case "workforce":
      return <WorkforceScreen />;
    case "finances":
      return <FinancesScreen />;
    case "news":
      return <NewsScreen />;
    default:
      return <DashboardScreen />;
  }
}
