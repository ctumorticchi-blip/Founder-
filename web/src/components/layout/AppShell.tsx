import { useEffect } from "react";
import { useGame } from "../../state/GameProvider";
import { useNavigation, type Route } from "../../state/Navigation";
import { StatusBar } from "./StatusBar";
import { BottomNav } from "./BottomNav";
import { DashboardScreen } from "../../screens/DashboardScreen";
import { CareerScreen } from "../../screens/CareerScreen";
import { SkillsScreen } from "../../screens/SkillsScreen";
import { OpportunitiesScreen } from "../../screens/OpportunitiesScreen";
import { CreateBusinessScreen } from "../../screens/CreateBusinessScreen";
import { PortfolioScreen } from "../../screens/PortfolioScreen";
import { BusinessScreen } from "../../screens/BusinessScreen";
import { WorkforceScreen } from "../../screens/WorkforceScreen";
import { CreateOfferScreen } from "../../screens/CreateOfferScreen";
import { OfferScreen } from "../../screens/OfferScreen";
import { FinancesScreen } from "../../screens/FinancesScreen";
import { NewsScreen } from "../../screens/NewsScreen";
import { MonthRecapModal } from "../../screens/MonthRecapModal";

export function AppShell() {
  const { state, clearError } = useGame();
  const { route } = useNavigation();

  // Un changement d'écran doit toujours repartir du haut : sans ce reset, un
  // écran ouvert précédemment scrollé (ex. OfferScreen, dont le bouton
  // "Lancer" est en haut) conserve sa position de défilement, cachant des
  // informations/actions essentielles au joueur (trouvé en playtest M11.2.1).
  // Le scroll réel se produit sur le document (`.app-shell__content` ne
  // contraint pas sa hauteur — `min-height`, pas `height` — donc ne devient
  // jamais lui-même scrollable en pratique), pas sur un conteneur interne.
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      // jsdom (tests) n'implémente pas window.scrollTo : sans effet, jamais bloquant.
    }
  }, [route]);

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
    case "portfolio":
      return <PortfolioScreen />;
    case "business":
      return <BusinessScreen businessId={route.businessId} />;
    case "workforce":
      return <WorkforceScreen businessId={route.businessId} />;
    case "createOffer":
      return <CreateOfferScreen businessId={route.businessId} />;
    case "offer":
      return <OfferScreen businessId={route.businessId} offerId={route.offerId} />;
    case "finances":
      return <FinancesScreen businessId={route.businessId} />;
    case "news":
      return <NewsScreen />;
    default:
      return <DashboardScreen />;
  }
}
