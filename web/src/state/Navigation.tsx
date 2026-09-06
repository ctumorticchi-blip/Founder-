import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Route =
  | { readonly screen: "dashboard" }
  | { readonly screen: "career" }
  | { readonly screen: "skills" }
  | { readonly screen: "opportunities" }
  | { readonly screen: "createBusiness"; readonly family: string }
  | { readonly screen: "business" }
  | { readonly screen: "workforce" }
  | { readonly screen: "finances" }
  | { readonly screen: "news" };

interface NavigationValue {
  readonly route: Route;
  readonly navigate: (route: Route) => void;
}

const NavigationContext = createContext<NavigationValue | null>(null);

export function NavigationProvider({ children }: { readonly children: ReactNode }) {
  const [route, setRoute] = useState<Route>({ screen: "dashboard" });
  const value = useMemo<NavigationValue>(() => ({ route, navigate: setRoute }), [route]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation doit être utilisé à l'intérieur de <NavigationProvider>.");
  return ctx;
}
