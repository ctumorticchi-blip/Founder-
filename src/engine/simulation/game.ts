import { createRng } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { createInitialMacroState } from "../world/world.js";
import { createAggregateCompetition } from "../competition/competition.js";
import { createInitialCharacter } from "../character/character.js";
import type { Market } from "../../types/market.js";
import type { GameState } from "./types.js";

/**
 * Crée l'état initial d'une partie (spec §4.1) : 18 ans, 0 €, aucun diplôme,
 * aucune entreprise, aucun emploi. Accepte plusieurs marchés d'entrée
 * (spec §3 : l'orchestrateur n'est plus limité à une seule entreprise/un
 * seul marché) ; chaque marché reçoit sa propre concurrence de fond.
 */
export function createInitialGameState(
  seed: number,
  birthDate: GameDate,
  startDate: GameDate,
  markets: readonly Market[],
): GameState {
  if (markets.length === 0) {
    throw new RangeError("createInitialGameState: au moins un marché doit être fourni.");
  }
  const ids = new Set(markets.map((market) => market.id));
  if (ids.size !== markets.length) {
    throw new RangeError("createInitialGameState: les identifiants de marché doivent être uniques.");
  }

  const rng = createRng(seed);
  const marketsById: Record<string, Market> = {};
  const competitionsById: Record<string, ReturnType<typeof createAggregateCompetition>> = {};
  for (const market of markets) {
    marketsById[market.id] = market;
    competitionsById[market.id] = createAggregateCompetition(market.id, rng.fork(`competition:init:${market.id}`));
  }

  return {
    date: startDate,
    macro: createInitialMacroState(startDate),
    markets: marketsById,
    competitions: competitionsById,
    character: createInitialCharacter(rng.fork("character:init"), birthDate),
    job: null,
    businesses: [],
    events: [],
    memory: [],
  };
}
