import { describe, expect, it } from "vitest";
import {
  computeRepeatDemand,
  computeRepeatRate,
  computeReputationUpdate,
  computeSubscriptionChurnAdjustment,
  computeWordOfMouth,
  updateSegmentMemory,
} from "../../../src/engine/customer/retention.js";
import type { SatisfactionDiagnosis, SegmentCustomerMemory, SegmentMemoryUpdateInput } from "../../../src/types/satisfaction.js";

const NEUTRAL_DIAGNOSIS: SatisfactionDiagnosis = {
  highExpectations: false,
  greatValueForMoney: false,
  qualityAboveExpectations: false,
  operationsUnderStrain: false,
  experienceBelowPromise: false,
};

/** Fabrique une mémoire de segment complète, avec des valeurs par défaut neutres (spec M11.2.3.1 §6). */
function memory(overrides: Partial<SegmentCustomerMemory> = {}): SegmentCustomerMemory {
  return {
    segmentId: "seg-a",
    segmentLabel: "Segment A",
    retainedBaseVolume: 100,
    newVolumeThisMonth: 0,
    retainedVolumeThisMonth: 0,
    cumulativeAcquiredVolume: 0,
    lastSatisfactionScore: 70,
    smoothedSatisfactionScore: 70,
    lastDiagnosis: NEUTRAL_DIAGNOSIS,
    consecutiveGoodMonths: 0,
    consecutiveBadMonths: 0,
    monthsSinceFirstSale: 3,
    repeatDemandThisMonth: 0,
    unservedRepeatDemandThisMonth: 0,
    availabilityFrustration: 0,
    ...overrides,
  };
}

/** Fabrique un input pour `updateSegmentMemory`, avec des valeurs par défaut neutres. */
function input(overrides: Partial<SegmentMemoryUpdateInput> = {}): SegmentMemoryUpdateInput {
  return {
    segmentId: "seg-a",
    segmentLabel: "Segment A",
    newVolumeThisMonth: 0,
    retainedVolumeThisMonth: 0,
    repeatDemandThisMonth: 0,
    unservedRepeatDemandThisMonth: 0,
    satisfactionThisMonth: null,
    diagnosisThisMonth: null,
    ...overrides,
  };
}

describe("computeRepeatDemand (spec M11.2.3.1 §2)", () => {
  it("aucune mémoire préalable (premier contact) -> 0", () => {
    expect(computeRepeatDemand(null)).toBe(0);
  });

  it("base retenue nulle -> 0 même à satisfaction/propension maximales", () => {
    expect(computeRepeatDemand(memory({ retainedBaseVolume: 0, smoothedSatisfactionScore: 100, availabilityFrustration: 0 }))).toBe(0);
  });

  it("base non nulle + satisfaction neutre + frustration nulle -> repeat demand strictement positif", () => {
    expect(computeRepeatDemand(memory({ retainedBaseVolume: 100, smoothedSatisfactionScore: 50, availabilityFrustration: 0 }))).toBeGreaterThan(0);
  });

  it("meilleure satisfaction -> repeat demand supérieur, toutes choses égales par ailleurs", () => {
    const low = computeRepeatDemand(memory({ smoothedSatisfactionScore: 40 }));
    const high = computeRepeatDemand(memory({ smoothedSatisfactionScore: 90 }));
    expect(high).toBeGreaterThan(low);
  });

  it("frustration de disponibilité plus élevée -> repeat demand plus faible, toutes choses égales par ailleurs", () => {
    const low = computeRepeatDemand(memory({ availabilityFrustration: 0.8 }));
    const high = computeRepeatDemand(memory({ availabilityFrustration: 0 }));
    expect(high).toBeGreaterThan(low);
  });

  it("frustration totale (1) -> repeat demand nul", () => {
    expect(computeRepeatDemand(memory({ availabilityFrustration: 1 }))).toBe(0);
  });

  it("est déterministe", () => {
    const m = memory();
    expect(computeRepeatDemand(m)).toBe(computeRepeatDemand(m));
  });
});

describe("updateSegmentMemory — flux réels, jamais reclassifiés (spec M11.2.3.1 §7, §9)", () => {
  it("premier contact avec vente : les flux fournis sont restitués tels quels, sans reclassification", () => {
    const result = updateSegmentMemory(null, input({ newVolumeThisMonth: 40, retainedVolumeThisMonth: 0, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(result.monthsSinceFirstSale).toBe(0);
    expect(result.newVolumeThisMonth).toBe(40);
    expect(result.retainedVolumeThisMonth).toBe(0);
  });

  it("un mois avec des clients à la fois nouveaux ET récurrents restitue les deux flux exactement", () => {
    const result = updateSegmentMemory(null, input({ newVolumeThisMonth: 30, retainedVolumeThisMonth: 12, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(result.newVolumeThisMonth).toBe(30);
    expect(result.retainedVolumeThisMonth).toBe(12);
  });

  it("premier contact sans vente : ancienneté reste nulle (null)", () => {
    const result = updateSegmentMemory(null, input());
    expect(result.monthsSinceFirstSale).toBeNull();
  });

  it("volume soutenu sur plusieurs mois fait progressivement croître la base retenue, jamais un saut", () => {
    let m: SegmentCustomerMemory | null = null;
    const bases: number[] = [];
    for (let i = 0; i < 6; i++) {
      m = updateSegmentMemory(m, input({ newVolumeThisMonth: 20, retainedVolumeThisMonth: 80, satisfactionThisMonth: 80, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
      bases.push(m.retainedBaseVolume);
    }
    for (let i = 1; i < bases.length; i++) {
      expect(bases[i]!).toBeGreaterThan(bases[i - 1]!);
      expect(bases[i]!).toBeLessThan(100);
    }
  });

  it("un mois à volume nul après plusieurs bons mois réduit la base sans l'annuler (inertie)", () => {
    let m: SegmentCustomerMemory | null = null;
    for (let i = 0; i < 6; i++) {
      m = updateSegmentMemory(m, input({ newVolumeThisMonth: 20, retainedVolumeThisMonth: 80, satisfactionThisMonth: 80, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    }
    const baseBeforeDrop = m!.retainedBaseVolume;
    const afterDrop = updateSegmentMemory(m, input());
    expect(afterDrop.retainedBaseVolume).toBeLessThan(baseBeforeDrop);
    expect(afterDrop.retainedBaseVolume).toBeGreaterThan(0);
  });

  it("cumulativeAcquiredVolume est la somme exacte des newVolumeThisMonth fournis, jamais un reste de soustraction", () => {
    let m: SegmentCustomerMemory | null = null;
    let expectedCumulative = 0;
    const newVolumes = [10, 25, 5, 0, 18];
    for (const newVolume of newVolumes) {
      m = updateSegmentMemory(m, input({ newVolumeThisMonth: newVolume, retainedVolumeThisMonth: 50, satisfactionThisMonth: 60, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
      expectedCumulative += newVolume;
      expect(m.cumulativeAcquiredVolume).toBeCloseTo(expectedCumulative, 6);
    }
  });

  it("un client récurrent servi n'est jamais compté une deuxième fois comme nouveau client", () => {
    // 0 nouveau, 40 récurrents servis : cumulativeAcquiredVolume ne doit pas bouger.
    const first = updateSegmentMemory(null, input({ newVolumeThisMonth: 40, retainedVolumeThisMonth: 0, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    const second = updateSegmentMemory(first, input({ newVolumeThisMonth: 0, retainedVolumeThisMonth: 30, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(second.cumulativeAcquiredVolume).toBe(first.cumulativeAcquiredVolume);
  });

  it("compteurs de mois consécutifs bons/mauvais s'incrémentent et se réinitialisent correctement", () => {
    let m: SegmentCustomerMemory | null = null;
    m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, satisfactionThisMonth: 75, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(m.consecutiveGoodMonths).toBe(2);
    expect(m.consecutiveBadMonths).toBe(0);
    m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, satisfactionThisMonth: 20, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(m.consecutiveGoodMonths).toBe(0);
    expect(m.consecutiveBadMonths).toBe(1);
  });

  it("l'ancienneté progresse chaque mois même sans vente ce mois-ci, une fois initiée", () => {
    let m = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(m.monthsSinceFirstSale).toBe(0);
    m = updateSegmentMemory(m, input());
    expect(m.monthsSinceFirstSale).toBe(1);
  });

  it("repeatDemandThisMonth et unservedRepeatDemandThisMonth sont persistés tels quels", () => {
    const result = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, retainedVolumeThisMonth: 5, repeatDemandThisMonth: 8, unservedRepeatDemandThisMonth: 3, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(result.repeatDemandThisMonth).toBe(8);
    expect(result.unservedRepeatDemandThisMonth).toBe(3);
  });

  it("est déterministe", () => {
    const a = updateSegmentMemory(null, input({ newVolumeThisMonth: 40, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    const b = updateSegmentMemory(null, input({ newVolumeThisMonth: 40, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(a).toEqual(b);
  });
});

describe("availabilityFrustration (spec M11.2.3.1 §5, §17)", () => {
  it("pas de demande récurrente ce mois-ci -> frustration inchangée", () => {
    const before = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 20, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(before.availabilityFrustration).toBeGreaterThan(0);
    const after = updateSegmentMemory(before, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 0, unservedRepeatDemandThisMonth: 0, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(after.availabilityFrustration).toBe(before.availabilityFrustration);
  });

  it("demande récurrente entièrement servie -> frustration nulle reste nulle", () => {
    const result = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, retainedVolumeThisMonth: 20, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 0, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(result.availabilityFrustration).toBe(0);
  });

  it("un refus ponctuel (un seul mois) a un effet faible sur la frustration lissée", () => {
    const result = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 20, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(result.availabilityFrustration).toBeGreaterThan(0);
    expect(result.availabilityFrustration).toBeLessThan(0.5);
  });

  it("des refus répétés sur plusieurs mois font monter la frustration vers un niveau élevé", () => {
    let m: SegmentCustomerMemory | null = null;
    for (let i = 0; i < 10; i++) {
      m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 20, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    }
    expect(m!.availabilityFrustration).toBeGreaterThan(0.7);
  });

  it("une frustration élevée redescend progressivement une fois la capacité restaurée, jamais en un seul mois", () => {
    let m: SegmentCustomerMemory | null = null;
    for (let i = 0; i < 10; i++) {
      m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 20, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    }
    const peak = m!.availabilityFrustration;
    m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, retainedVolumeThisMonth: 20, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 0, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    expect(m.availabilityFrustration).toBeLessThan(peak);
    expect(m.availabilityFrustration).toBeGreaterThan(peak * 0.3); // pas un reset instantané
    // Plusieurs mois de capacité restaurée pour repasser sous la moitié du pic.
    for (let i = 0; i < 5; i++) {
      m = updateSegmentMemory(m, input({ newVolumeThisMonth: 10, retainedVolumeThisMonth: 20, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 0, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    }
    expect(m.availabilityFrustration).toBeLessThan(peak * 0.5);
  });

  it("est déterministe", () => {
    const a = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 5, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
    const b = updateSegmentMemory(null, input({ newVolumeThisMonth: 10, repeatDemandThisMonth: 20, unservedRepeatDemandThisMonth: 5, satisfactionThisMonth: 70, diagnosisThisMonth: NEUTRAL_DIAGNOSIS }));
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
