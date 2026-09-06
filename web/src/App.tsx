import { useGame } from "./state/GameProvider";
import { NavigationProvider } from "./state/Navigation";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AppShell } from "./components/layout/AppShell";

export function App() {
  const { state } = useGame();

  if (!state.gameState) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationProvider>
      <AppShell />
    </NavigationProvider>
  );
}
