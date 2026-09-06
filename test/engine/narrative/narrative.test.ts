import { describe, expect, it } from "vitest";
import { appendToMemory } from "../../../src/engine/narrative/narrative.js";
import type { GameEvent } from "../../../src/types/narrative.js";

const DATE = { year: 2026, month: 6 };

describe("appendToMemory", () => {
  it("mémorise les événements marquants", () => {
    const events: GameEvent[] = [
      { kind: "business-created", date: DATE, message: "Création." },
    ];
    const memory = appendToMemory([], events);
    expect(memory).toHaveLength(1);
    expect(memory[0]?.kind).toBe("business-created");
  });

  it("ignore les événements non marquants (ex. opportunité de marché)", () => {
    const events: GameEvent[] = [
      { kind: "market-opportunity-detected", date: DATE, message: "Opportunité." },
    ];
    const memory = appendToMemory([], events);
    expect(memory).toHaveLength(0);
  });

  it("retourne la même référence si rien à mémoriser (pas d'allocation inutile)", () => {
    const initialMemory = [{ kind: "job-started" as const, date: DATE, message: "x" }];
    const result = appendToMemory(initialMemory, []);
    expect(result).toBe(initialMemory);
  });

  it("accumule au fil des mois sans écraser l'historique", () => {
    let memory = appendToMemory([], [{ kind: "job-started", date: DATE, message: "Emploi." }]);
    memory = appendToMemory(memory, [
      { kind: "business-created", date: { year: 2027, month: 1 }, message: "Création." },
    ]);
    expect(memory).toHaveLength(2);
    expect(memory.map((entry) => entry.kind)).toEqual(["job-started", "business-created"]);
  });
});
