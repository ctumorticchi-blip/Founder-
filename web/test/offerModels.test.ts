import { describe, expect, it } from "vitest";
import type { DemandSignal, EconomicFamily, PriceSignal, VisibilityLevel } from "@founder/engine";
import {
  demandSignalLabel,
  demandUnitLabel,
  offerModelLabel,
  offerModelsForFamily,
  offerQualityLabel,
  priceSignalLabel,
  visibilityLevelLabel,
} from "../src/data/offerModels";

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

describe("offerModels — vocabulaire de la demande (spec M11.2.2 §11)", () => {
  it("chaque famille a un libellé d'unité de demande non vide, jamais un nom technique", () => {
    for (const family of FAMILIES) {
      const label = demandUnitLabel(family);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/hoursSold|wonMandates|coversServed|unitsSold|newSubscribers/i);
    }
  });

  it("les 3 signaux de demande ont un libellé métier distinct, jamais le mot-clé technique brut", () => {
    const signals: readonly DemandSignal[] = ["weak", "moderate", "strong"];
    const labels = signals.map(demandSignalLabel);
    expect(new Set(labels).size).toBe(3);
    for (const signal of signals) {
      expect(demandSignalLabel(signal)).not.toBe(signal);
    }
  });

  it("les 3 signaux de prix ont un libellé métier distinct, jamais le mot-clé technique brut", () => {
    const signals: readonly PriceSignal[] = ["low", "fair", "high"];
    const labels = signals.map(priceSignalLabel);
    expect(new Set(labels).size).toBe(3);
    for (const signal of signals) {
      expect(priceSignalLabel(signal)).not.toBe(signal);
    }
  });

  it("les 3 niveaux de visibilité ont un libellé métier distinct, jamais le mot-clé technique brut", () => {
    const levels: readonly VisibilityLevel[] = ["low", "medium", "high"];
    const labels = levels.map(visibilityLevelLabel);
    expect(new Set(labels).size).toBe(3);
    for (const level of levels) {
      expect(visibilityLevelLabel(level)).not.toBe(level);
    }
  });
});
