import { describe, expect, it } from "vitest";
import { deriveDecisions } from "../src/state/commercialTranslation";

describe("deriveDecisions (spec M11.2.2 §9 : ni prix ni cible commerciale ne sont des décisions du joueur)", () => {
  it("service : ne produit que le discriminant de famille", () => {
    const decisions = deriveDecisions("service", { family: "service" });
    expect(decisions).toEqual({ family: "service" });
  });

  it("hospitality : ne produit que le discriminant de famille", () => {
    const decisions = deriveDecisions("hospitality", { family: "hospitality" });
    expect(decisions).toEqual({ family: "hospitality" });
  });

  it("subscription : ne produit que le discriminant de famille", () => {
    const decisions = deriveDecisions("subscription", { family: "subscription" });
    expect(decisions).toEqual({ family: "subscription" });
  });

  it("agency : ne produit que le discriminant de famille", () => {
    const decisions = deriveDecisions("agency", { family: "agency" });
    expect(decisions).toEqual({ family: "agency" });
  });

  it("retail : conserve stockUnits, seule décision opérationnelle restante", () => {
    const decisions = deriveDecisions("retail", { family: "retail", stockUnits: 600 });
    expect(decisions).toEqual({ family: "retail", stockUnits: 600 });
  });

  it("retail : des concreteFields d'une autre famille ne fuient jamais un stockUnits fantôme", () => {
    const decisions = deriveDecisions("retail", { family: "service" });
    expect(decisions).toEqual({ family: "retail", stockUnits: 0 });
  });
});
