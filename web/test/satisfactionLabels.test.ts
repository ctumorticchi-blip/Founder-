import { describe, expect, it } from "vitest";
import type { FidelityTrend, SatisfactionDiagnosis, SatisfactionLevel, SegmentCustomerMemory } from "@founder/engine";
import {
  activeDiagnosisLines,
  computeOfferWordOfMouth,
  fidelityTrendFromMemory,
  fidelityTrendLabel,
  satisfactionLevelLabel,
  summarizeCustomerMemory,
  wordOfMouthDescription,
} from "../src/data/satisfactionLabels";

const LEVELS: readonly SatisfactionLevel[] = ["very-positive", "positive", "mixed", "negative", "very-negative"];
const TRENDS: readonly FidelityTrend[] = ["improving", "stable", "declining"];

const NO_DIAGNOSIS: SatisfactionDiagnosis = {
  highExpectations: false,
  greatValueForMoney: false,
  qualityAboveExpectations: false,
  operationsUnderStrain: false,
  experienceBelowPromise: false,
};

function memory(overrides: Partial<SegmentCustomerMemory> = {}): SegmentCustomerMemory {
  return {
    segmentId: "seg",
    segmentLabel: "Segment",
    retainedBaseVolume: 10,
    newVolumeThisMonth: 5,
    retainedVolumeThisMonth: 5,
    cumulativeAcquiredVolume: 10,
    lastSatisfactionScore: 70,
    smoothedSatisfactionScore: 70,
    lastDiagnosis: NO_DIAGNOSIS,
    consecutiveGoodMonths: 0,
    consecutiveBadMonths: 0,
    monthsSinceFirstSale: 3,
    ...overrides,
  };
}

describe("satisfactionLabels (spec M11.2.3 §4, §15)", () => {
  it("les 5 niveaux de satisfaction ont un libellé métier distinct, jamais le mot-clé technique brut", () => {
    const labels = LEVELS.map(satisfactionLevelLabel);
    expect(new Set(labels).size).toBe(5);
    for (const level of LEVELS) {
      expect(satisfactionLevelLabel(level)).not.toBe(level);
      expect(satisfactionLevelLabel(level).length).toBeGreaterThan(0);
    }
  });

  it("les 3 tendances de fidélité ont un libellé métier distinct", () => {
    const labels = TRENDS.map(fidelityTrendLabel);
    expect(new Set(labels).size).toBe(3);
    for (const trend of TRENDS) {
      expect(fidelityTrendLabel(trend)).not.toBe(trend);
    }
  });

  it("fidelityTrendFromMemory : plusieurs bons mois consécutifs -> progression", () => {
    expect(fidelityTrendFromMemory(memory({ consecutiveGoodMonths: 3 }))).toBe("improving");
  });

  it("fidelityTrendFromMemory : plusieurs mauvais mois consécutifs -> recul", () => {
    expect(fidelityTrendFromMemory(memory({ consecutiveBadMonths: 3 }))).toBe("declining");
  });

  it("fidelityTrendFromMemory : ni série bonne ni mauvaise -> stable", () => {
    expect(fidelityTrendFromMemory(memory({ consecutiveGoodMonths: 1, consecutiveBadMonths: 0 }))).toBe("stable");
  });

  it("activeDiagnosisLines : ne retient que les diagnostics actifs, jamais une liste exhaustive de non-événements", () => {
    const lines = activeDiagnosisLines({ ...NO_DIAGNOSIS, qualityAboveExpectations: true, operationsUnderStrain: true });
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.key).sort()).toEqual(["operationsUnderStrain", "qualityAboveExpectations"]);
  });

  it("activeDiagnosisLines : aucun diagnostic actif -> liste vide", () => {
    expect(activeDiagnosisLines(NO_DIAGNOSIS)).toEqual([]);
  });

  it("activeDiagnosisLines : distingue les signaux positifs des signaux d'alerte", () => {
    const lines = activeDiagnosisLines({ ...NO_DIAGNOSIS, greatValueForMoney: true, experienceBelowPromise: true });
    const positive = lines.find((l) => l.key === "greatValueForMoney");
    const warning = lines.find((l) => l.key === "experienceBelowPromise");
    expect(positive?.positive).toBe(true);
    expect(warning?.positive).toBe(false);
  });
});

describe("summarizeCustomerMemory (spec §15 : pas d'affichage avant donnée suffisante)", () => {
  it("renvoie null tant qu'aucun segment n'a de vente réelle", () => {
    expect(summarizeCustomerMemory([memory({ monthsSinceFirstSale: null, lastSatisfactionScore: null })])).toBeNull();
    expect(summarizeCustomerMemory([])).toBeNull();
  });

  it("agrège nouveaux/récurrents sur tous les segments dès qu'un segment a une vente réelle", () => {
    const summary = summarizeCustomerMemory([
      memory({ segmentId: "a", newVolumeThisMonth: 20, retainedVolumeThisMonth: 10 }),
      memory({ segmentId: "b", newVolumeThisMonth: 18, retainedVolumeThisMonth: 11 }),
    ]);
    expect(summary).not.toBeNull();
    expect(summary!.newThisMonth).toBe(38);
    expect(summary!.recurrentThisMonth).toBe(21);
  });

  it("le niveau de satisfaction agrégé reflète une pondération par volume, pas une moyenne simple", () => {
    const summary = summarizeCustomerMemory([
      memory({ segmentId: "a", retainedBaseVolume: 100, smoothedSatisfactionScore: 90 }),
      memory({ segmentId: "b", retainedBaseVolume: 1, smoothedSatisfactionScore: 10 }),
    ]);
    // Dominé par le segment à fort volume (90) -> "very-positive", pas une moyenne simple (50 -> "mixed").
    expect(summary!.satisfactionLevel).toBe("very-positive");
  });

  it("la tendance de fidélité agrégée suit la série dominante à travers les segments", () => {
    const improving = summarizeCustomerMemory([
      memory({ segmentId: "a", consecutiveGoodMonths: 4 }),
      memory({ segmentId: "b", consecutiveGoodMonths: 3 }),
    ]);
    expect(improving!.fidelityTrend).toBe("improving");

    const declining = summarizeCustomerMemory([
      memory({ segmentId: "a", consecutiveBadMonths: 5 }),
      memory({ segmentId: "b", consecutiveGoodMonths: 1 }),
    ]);
    expect(declining!.fidelityTrend).toBe("declining");
  });
});

describe("bouche-à-oreille affichable (spec §10, §15)", () => {
  it("computeOfferWordOfMouth : nul pour une offre sans volume retenu", () => {
    expect(computeOfferWordOfMouth([memory({ retainedBaseVolume: 0 })], "service")).toBe(0);
  });

  it("computeOfferWordOfMouth : positif pour une offre à fort volume et forte satisfaction", () => {
    expect(computeOfferWordOfMouth([memory({ retainedBaseVolume: 300, smoothedSatisfactionScore: 95 })], "service")).toBeGreaterThan(0);
  });

  it("computeOfferWordOfMouth : suit la base d'abonnés pour Subscription (même référence que le moteur)", () => {
    const lowBase = computeOfferWordOfMouth([memory({ retainedBaseVolume: 40, smoothedSatisfactionScore: 90 })], "subscription", 40);
    const highBase = computeOfferWordOfMouth([memory({ retainedBaseVolume: 40, smoothedSatisfactionScore: 90 })], "subscription", 5_000);
    // Même mémoire, référence de volume différente (Subscription suit `activeSubscribers`) -> intensité différente.
    expect(lowBase).not.toBe(highBase);
  });

  it("wordOfMouthDescription : combine intensité et tendance, jamais un nombre brut", () => {
    expect(wordOfMouthDescription(0.02, "improving")).toBe("Faible mais en hausse");
    expect(wordOfMouthDescription(0.2, "stable")).toBe("Fort");
    expect(wordOfMouthDescription(0.02, "declining")).toBe("Faible et en baisse");
    expect(wordOfMouthDescription(0.2, "improving")).not.toMatch(/0\.\d/);
  });
});
