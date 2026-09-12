import { describe, expect, it } from "vitest";
import {
  computeRepeatRate,
  computeReputationUpdate,
  computeSubscriptionChurnAdjustment,
  computeWordOfMouth,
  updateSegmentMemory,
} from "../../../src/engine/customer/retention.js";
import type { SatisfactionDiagnosis, SegmentCustomerMemory } from "../../../src/types/satisfaction.js";

const NEUTRAL_DIAGNOSIS: SatisfactionDiagnosis = {
  highExpectations: false,
  greatValueForMoney: false,
  qualityAboveExpectations: false,
  operationsUnderStrain: false,
  experienceBelowPromise: false,
};

describe("updateSegmentMemory (spec M11.2.3 §6, §8)", () => {
  it("premier contact : mémoire initialisée, ancienneté à 0 si du volume, null sinon", () => {
    const withSale = updateSegmentMemory(null, "seg-a", "Segment A", 40, 70, NEUTRAL_DIAGNOSIS);
    expect(withSale.monthsSinceFirstSale).toBe(0);
    expect(withSale.newVolumeThisMonth).toBe(40);
    expect(withSale.retainedVolumeThisMonth).toBe(0);

    const withoutSale = updateSegmentMemory(null, "seg-a", "Segment A", 0, null, null);
    expect(withoutSale.monthsSinceFirstSale).toBeNull();
  });

  it("un volume soutenu sur plusieurs mois fait progressivement croître la base retenue, jamais un saut", () => {
    let memory: SegmentCustomerMemory | null = null;
    const bases: number[] = [];
    for (let i = 0; i < 6; i++) {
      memory = updateSegmentMemory(memory, "seg-a", "Segment A", 100, 80, NEUTRAL_DIAGNOSIS);
      bases.push(memory.retainedBaseVolume);
    }
    // Croissance monotone vers 100, jamais un saut direct à 100.
    for (let i = 1; i < bases.length; i++) {
      expect(bases[i]!).toBeGreaterThan(bases[i - 1]!);
      expect(bases[i]!).toBeLessThan(100);
    }
  });

  it("un mois à volume nul après plusieurs bons mois réduit la base sans l'annuler (inertie)", () => {
    let memory: SegmentCustomerMemory | null = null;
    for (let i = 0; i < 6; i++) {
      memory = updateSegmentMemory(memory, "seg-a", "Segment A", 100, 80, NEUTRAL_DIAGNOSIS);
    }
    const baseBeforeDrop = memory!.retainedBaseVolume;
    const afterDrop = updateSegmentMemory(memory, "seg-a", "Segment A", 0, null, null);
    expect(afterDrop.retainedBaseVolume).toBeLessThan(baseBeforeDrop);
    expect(afterDrop.retainedBaseVolume).toBeGreaterThan(0);
  });

  it("satisfaction élevée soutenue -> repeatRate élevé -> le volume retenu domine le volume du mois", () => {
    let memory: SegmentCustomerMemory | null = null;
    for (let i = 0; i < 8; i++) {
      memory = updateSegmentMemory(memory, "seg-a", "Segment A", 100, 90, NEUTRAL_DIAGNOSIS);
    }
    expect(memory!.retainedVolumeThisMonth).toBeGreaterThan(memory!.newVolumeThisMonth);
  });

  it("satisfaction basse soutenue -> repeatRate bas -> le volume nouveau domine, la base s'érode", () => {
    let memory: SegmentCustomerMemory | null = null;
    const bases: number[] = [];
    for (let i = 0; i < 8; i++) {
      memory = updateSegmentMemory(memory, "seg-a", "Segment A", 100, 10, NEUTRAL_DIAGNOSIS);
      bases.push(memory.retainedBaseVolume);
    }
    expect(memory!.newVolumeThisMonth).toBeGreaterThan(memory!.retainedVolumeThisMonth);
  });

  it("compteurs de mois consécutifs bons/mauvais s'incrémentent et se réinitialisent correctement", () => {
    let memory: SegmentCustomerMemory | null = null;
    memory = updateSegmentMemory(memory, "seg-a", "A", 10, 70, NEUTRAL_DIAGNOSIS); // bon
    memory = updateSegmentMemory(memory, "seg-a", "A", 10, 75, NEUTRAL_DIAGNOSIS); // bon
    expect(memory.consecutiveGoodMonths).toBe(2);
    expect(memory.consecutiveBadMonths).toBe(0);
    memory = updateSegmentMemory(memory, "seg-a", "A", 10, 20, NEUTRAL_DIAGNOSIS); // mauvais
    expect(memory.consecutiveGoodMonths).toBe(0);
    expect(memory.consecutiveBadMonths).toBe(1);
  });

  it("l'ancienneté progresse chaque mois même sans vente ce mois-ci, une fois initiée", () => {
    let memory = updateSegmentMemory(null, "seg-a", "A", 10, 70, NEUTRAL_DIAGNOSIS);
    expect(memory.monthsSinceFirstSale).toBe(0);
    memory = updateSegmentMemory(memory, "seg-a", "A", 0, null, null);
    expect(memory.monthsSinceFirstSale).toBe(1);
  });

  it("est déterministe", () => {
    const a = updateSegmentMemory(null, "seg-a", "A", 40, 70, NEUTRAL_DIAGNOSIS);
    const b = updateSegmentMemory(null, "seg-a", "A", 40, 70, NEUTRAL_DIAGNOSIS);
    expect(a).toEqual(b);
  });
});

describe("computeRepeatRate", () => {
  it("reste toujours dans [0.05, 0.95]", () => {
    expect(computeRepeatRate(0)).toBeCloseTo(0.05, 5);
    expect(computeRepeatRate(100)).toBeCloseTo(0.95, 5);
  });
});

describe("computeReputationUpdate (spec M11.2.3 §9)", () => {
  it("volume élevé + satisfaction haute -> la réputation augmente", () => {
    const updated = computeReputationUpdate(0.5, 90, 200, 200);
    expect(updated).toBeGreaterThan(0.5);
  });

  it("volume élevé + satisfaction basse -> la réputation diminue", () => {
    const updated = computeReputationUpdate(0.5, 10, 200, 200);
    expect(updated).toBeLessThan(0.5);
  });

  it("un tout petit volume (5 clients) a un effet quasi nul même à satisfaction extrême", () => {
    const tinyVolume = computeReputationUpdate(0.5, 100, 5, 200);
    const fullVolume = computeReputationUpdate(0.5, 100, 200, 200);
    expect(tinyVolume - 0.5).toBeLessThan((fullVolume - 0.5) * 0.1);
  });

  it("le déplacement reste toujours borné, même à un mois extrême (aucune réparation/chute instantanée)", () => {
    const up = computeReputationUpdate(0.2, 100, 10_000, 200);
    const down = computeReputationUpdate(0.8, 0, 10_000, 200);
    expect(up).toBeLessThan(0.3); // pas de saut de 0.2 à 0.95+
    expect(down).toBeGreaterThan(0.7); // pas de chute de 0.8 à 0.05
  });

  it("plusieurs mois consécutifs bons produisent un déplacement cumulatif visible", () => {
    let reputation = 0.3;
    for (let i = 0; i < 12; i++) {
      reputation = computeReputationUpdate(reputation, 90, 200, 200);
    }
    expect(reputation).toBeGreaterThan(0.5);
  });

  it("est déterministe", () => {
    expect(computeReputationUpdate(0.4, 70, 100, 200)).toBe(computeReputationUpdate(0.4, 70, 100, 200));
  });
});

describe("computeWordOfMouth (spec M11.2.3 §10)", () => {
  it("nul pour une entreprise neuve (volume quasi nul), même à satisfaction parfaite", () => {
    expect(computeWordOfMouth(100, 0, 200)).toBe(0);
  });

  it("croît avec le volume, à satisfaction égale", () => {
    const low = computeWordOfMouth(90, 20, 200);
    const high = computeWordOfMouth(90, 200, 200);
    expect(high).toBeGreaterThan(low);
  });

  it("croît avec la satisfaction, à volume égal", () => {
    const low = computeWordOfMouth(55, 200, 200);
    const high = computeWordOfMouth(95, 200, 200);
    expect(high).toBeGreaterThan(low);
  });

  it("n'est jamais négatif, même à satisfaction très basse (pas de bad buzz, hors scope)", () => {
    expect(computeWordOfMouth(0, 200, 200)).toBe(0);
  });

  it("reste toujours borné à un facteur d'appoint modeste", () => {
    expect(computeWordOfMouth(100, 100_000, 200)).toBeLessThanOrEqual(0.25);
  });

  it("est déterministe", () => {
    expect(computeWordOfMouth(80, 50, 200)).toBe(computeWordOfMouth(80, 50, 200));
  });
});

describe("computeSubscriptionChurnAdjustment (spec M11.2.3 §13)", () => {
  it("satisfaction haute -> ajustement négatif (churn réduit)", () => {
    expect(computeSubscriptionChurnAdjustment(90)).toBeLessThan(0);
  });

  it("satisfaction basse -> ajustement positif (churn augmenté)", () => {
    expect(computeSubscriptionChurnAdjustment(10)).toBeGreaterThan(0);
  });

  it("satisfaction neutre (aucune mémoire) -> aucun ajustement", () => {
    expect(computeSubscriptionChurnAdjustment(50)).toBe(0);
  });

  it("est déterministe", () => {
    expect(computeSubscriptionChurnAdjustment(30)).toBe(computeSubscriptionChurnAdjustment(30));
  });
});
