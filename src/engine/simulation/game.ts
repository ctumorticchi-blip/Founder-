import { createRng } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { createInitialMacroState } from "../world/world.js";
import { createAggregateCompetition } from "../competition/competition.js";
import { createInitialCharacter } from "../character/character.js";
import type { Market } from "../../types/market.js";
import type { GameState } from "./types.js";

/**
 * Crée l'état initial d'une partie (spec §4.1) : 18 ans, 0 €, aucun diplôme,
 * aucune entreprise, marché et concurrence de fond tirés depuis la seed.
 */
export function createInitialGameState(seed: number, birthDate: GameDate, startDate: GameDate, market: Market): GameState {
  const rng = createRng(seed);
  return {
    date: startDate,
    macro: createInitialMacroState(startDate),
    market,
    competition: createAggregateCompetition(market.id, rng.fork("competition:init")),
    character: createInitialCharacter(rng.fork("character:init"), birthDate),
    job: null,
    playerBusiness: null,
    events: [],
    memory: [],
  };
}
