import { render } from "@testing-library/react";
import { GameProvider } from "../src/state/GameProvider";
import { App } from "../src/App";

export function renderApp() {
  return render(
    <GameProvider>
      <App />
    </GameProvider>,
  );
}
