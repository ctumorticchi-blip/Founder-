import { describe, expect, it } from "vitest";
import type { EconomicFamily } from "@founder/engine";
import { offerModelLabel, offerModelsForFamily, offerQualityLabel } from "../src/data/offerModels";

const FAMILIES: readonly EconomicFamily[] = ["service", "hospitality", "subscription", "retail", "agency"];

describe("offerModels (spec M11.2 §3.4bis)", () => {
  it("chaque famille recommande au moins un modèle économique", () => {
    for (const family of FAMILIES) {
      expect(offerModelsForFamily(family).length).toBeGreaterThan(0);
    }
  });

  it("chaque modèle recommandé a un label non vide pour sa famille", () => {
    for (const family of FAMILIES) {
      for (const model of offerModelsForFamily(family)) {
        expect(offerModelLabel(model, family).length).toBeGreaterThan(0);
      }
    }
  });

  it("chaque famille a un libellé de qualité non vide", () => {
    for (const family of FAMILIES) {
      expect(offerQualityLabel(family).length).toBeGreaterThan(0);
    }
  });
});
