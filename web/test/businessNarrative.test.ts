import { describe, expect, it } from "vitest";
import type { GameState } from "@founder/engine";
import { computeBusinessNarratives } from "../src/state/businessNarrative";

function gameState(businesses: GameState["businesses"]): GameState {
  return {
    date: { year: 2026, month: 2 },
    macro: {} as GameState["macro"],
    markets: {} as GameState["markets"],
    competitions: {} as GameState["competitions"],
    character: { cash: 0 } as GameState["character"],
    job: null,
    businesses,
    events: [],
    memory: [],
  } as unknown as GameState;
}

function business(overrides: {
  readonly id: string;
  readonly reputationScore: number;
  readonly customerMemory?: readonly Partial<GameState["businesses"][number]["business"]["offers"][number]["customerMemory"][number]>[];
}): GameState["businesses"][number] {
  return {
    id: overrides.id,
    business: {
      name: overrides.id,
      families: ["service"],
      treasury: { cash: 0 },
      offers: [
        {
          id: `${overrides.id}-offer`,
          customerMemory: (overrides.customerMemory ?? []).map((m) => ({
            segmentId: "seg",
            segmentLabel: "Segment",
            retainedBaseVolume: 0,
            newVolumeThisMonth: 0,
            retainedVolumeThisMonth: 0,
            cumulativeAcquiredVolume: 0,
            lastSatisfactionScore: null,
            smoothedSatisfactionScore: 50,
            lastDiagnosis: null,
            consecutiveGoodMonths: 0,
            consecutiveBadMonths: 0,
            monthsSinceFirstSale: 1,
            ...m,
          })),
        },
      ],
      properties: [],
    },
    workforce: { headcount: 0, averageMonthlySalary: 0 },
    marketId: "market-1",
    familyState: { family: "service", reputationScore: overrides.reputationScore, costPerLaborHour: 8 },
    saleProcess: null,
    lastStatement: null,
  } as unknown as GameState["businesses"][number];
}

describe("computeBusinessNarratives (spec M11.2.3 §16)", () => {
  it("aucune narration pour une entreprise sans mouvement de clientèle", () => {
    const prev = gameState([business({ id: "biz", reputationScore: 0.1 })]);
    const next = gameState([business({ id: "biz", reputationScore: 0.1 })]);
    expect(computeBusinessNarratives(prev, next, {})).toEqual([]);
  });

  it("narre les nouveaux clients agrégés sur toutes les offres, jamais un id technique", () => {
    const prev = gameState([business({ id: "biz", reputationScore: 0.1 })]);
    const next = gameState([
      business({ id: "biz", reputationScore: 0.1, customerMemory: [{ newVolumeThisMonth: 38, retainedVolumeThisMonth: 0 }] }),
    ]);
    const narratives = computeBusinessNarratives(prev, next, { biz: { displayName: "Fleuriste du coin", createdAt: { year: 2026, month: 1 }, description: "", activity: "", targetCustomers: "" } });
    expect(narratives).toHaveLength(1);
    expect(narratives[0]!.sentences[0]).toContain("Fleuriste du coin");
    expect(narratives[0]!.sentences[0]).toContain("38");
    expect(narratives[0]!.sentences[0]).not.toContain("biz");
  });

  it("narre la progression de réputation entre deux mois", () => {
    const prev = gameState([business({ id: "biz", reputationScore: 0.1, customerMemory: [{ newVolumeThisMonth: 10 }] })]);
    const next = gameState([business({ id: "biz", reputationScore: 0.15, customerMemory: [{ newVolumeThisMonth: 10 }] })]);
    const narratives = computeBusinessNarratives(prev, next, {});
    expect(narratives[0]!.sentences.some((s) => s.includes("progresse"))).toBe(true);
  });

  it("narre le recul de réputation entre deux mois", () => {
    const prev = gameState([business({ id: "biz", reputationScore: 0.3, customerMemory: [{ newVolumeThisMonth: 10 }] })]);
    const next = gameState([business({ id: "biz", reputationScore: 0.2, customerMemory: [{ newVolumeThisMonth: 10 }] })]);
    const narratives = computeBusinessNarratives(prev, next, {});
    expect(narratives[0]!.sentences.some((s) => s.includes("recule"))).toBe(true);
  });

  it("intègre le diagnostic causal du segment dominant, jamais inventé", () => {
    const prev = gameState([business({ id: "biz", reputationScore: 0.1 })]);
    const next = gameState([
      business({
        id: "biz",
        reputationScore: 0.1,
        customerMemory: [
          {
            newVolumeThisMonth: 5,
            retainedBaseVolume: 100,
            lastDiagnosis: {
              highExpectations: false,
              greatValueForMoney: true,
              qualityAboveExpectations: true,
              operationsUnderStrain: false,
              experienceBelowPromise: false,
            },
          },
        ],
      }),
    ]);
    const narratives = computeBusinessNarratives(prev, next, {});
    const joined = narratives[0]!.sentences.join(" ");
    expect(joined).toContain("Bon rapport qualité/prix");
    expect(joined).toContain("Qualité supérieure aux attentes");
  });

  it("plusieurs entreprises restent indépendantes dans la narration", () => {
    const prev = gameState([business({ id: "a", reputationScore: 0.1 }), business({ id: "b", reputationScore: 0.1 })]);
    const next = gameState([
      business({ id: "a", reputationScore: 0.1, customerMemory: [{ newVolumeThisMonth: 10 }] }),
      business({ id: "b", reputationScore: 0.1 }),
    ]);
    const narratives = computeBusinessNarratives(prev, next, {});
    expect(narratives).toHaveLength(1);
    expect(narratives[0]!.businessId).toBe("a");
  });
});
