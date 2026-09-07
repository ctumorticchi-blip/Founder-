import { describe, expect, it } from "vitest";
import {
  computeAdminMonthlyCost,
  computeInfrastructureMonthlyCost,
  computeInfrastructureSetupCost,
  computePurchasesCost,
} from "../src/state/businessCosts";

describe("computeInfrastructureMonthlyCost", () => {
  it("retourne le coût mensuel de l'option choisie", () => {
    expect(computeInfrastructureMonthlyCost("domicile")).toBe(0);
    expect(computeInfrastructureMonthlyCost("coworking")).toBe(250);
    expect(computeInfrastructureMonthlyCost("petit-bureau")).toBe(900);
    expect(computeInfrastructureMonthlyCost("bureau-intermediaire")).toBe(2_500);
  });

  it("retourne 0 pour un id d'infrastructure inconnu (repli défensif)", () => {
    expect(computeInfrastructureMonthlyCost("inconnu")).toBe(0);
  });
});

describe("computeInfrastructureSetupCost", () => {
  it("retourne le coût d'installation de l'option choisie", () => {
    expect(computeInfrastructureSetupCost("domicile")).toBe(0);
    expect(computeInfrastructureSetupCost("petit-bureau")).toBe(2_000);
    expect(computeInfrastructureSetupCost("bureau-intermediaire")).toBe(8_000);
  });

  it("retourne 0 pour un id inconnu", () => {
    expect(computeInfrastructureSetupCost("inconnu")).toBe(0);
  });
});

describe("computeAdminMonthlyCost", () => {
  it("inclut toujours les composants requis même sans optionnel coché", () => {
    // banque(25) + assurance(45) + comptabilite(120) = 190
    expect(computeAdminMonthlyCost([])).toBe(190);
  });

  it("ajoute les optionnels cochés", () => {
    expect(computeAdminMonthlyCost(["logiciels"])).toBe(190 + 60);
    expect(computeAdminMonthlyCost(["logiciels", "conformite"])).toBe(190 + 60 + 80);
  });

  it("ignore un id optionnel inconnu sans planter", () => {
    expect(computeAdminMonthlyCost(["inconnu"])).toBe(190);
  });
});

describe("computePurchasesCost", () => {
  it("retourne 0 pour une liste vide", () => {
    expect(computePurchasesCost([])).toBe(0);
  });

  it("multiplie prix unitaire par quantité et somme plusieurs achats", () => {
    // ordinateur(1200) * 2 + mobilier(600) * 1 = 3000
    expect(
      computePurchasesCost([
        { itemId: "ordinateur", quantity: 2 },
        { itemId: "mobilier", quantity: 1 },
      ]),
    ).toBe(3_000);
  });

  it("ignore un item inconnu sans planter", () => {
    expect(computePurchasesCost([{ itemId: "inconnu", quantity: 5 }])).toBe(0);
  });
});
