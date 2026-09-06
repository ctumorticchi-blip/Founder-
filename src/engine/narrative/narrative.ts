import type { GameEvent, GameEventKind, MemoryEntry } from "../../types/narrative.js";

/**
 * Types d'événements jugés assez importants pour rester en mémoire longue
 * (spec §18). `market-opportunity-detected` en est volontairement exclu :
 * il peut se répéter de nombreux mois consécutifs sur un même marché stable,
 * ce qui ferait grossir la mémoire sans apporter d'information nouvelle.
 */
const MEMORABLE_EVENT_KINDS: ReadonlySet<GameEventKind> = new Set([
  "job-started",
  "business-created",
  "business-liquidated",
  "cash-crisis-warning",
  "capital-injected",
]);

/**
 * Ajoute à la mémoire longue les événements mémorables du mois. Fonction
 * pure : retourne un nouveau tableau (ou le même si rien à mémoriser).
 */
export function appendToMemory(
  memory: readonly MemoryEntry[],
  events: readonly GameEvent[],
): readonly MemoryEntry[] {
  const memorable = events.filter((event) => MEMORABLE_EVENT_KINDS.has(event.kind));
  if (memorable.length === 0) {
    return memory;
  }
  return [
    ...memory,
    ...memorable.map((event) => ({ date: event.date, kind: event.kind, message: event.message })),
  ];
}
