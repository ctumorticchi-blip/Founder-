import type { Rng } from "../rng/rng.js";
import type { GameDate } from "../time/clock.js";
import { clamp } from "../util/math.js";
import {
  SKILL_NAMES,
  TIME_CATEGORIES,
  type CharacterState,
  type SkillName,
  type Skills,
  type TimeCategory,
} from "../../types/character.js";

/** Budget de temps mensuel constant du P0 (spec §4.3, valeur de design). */
export const MONTHLY_TIME_BUDGET_HOURS = 160;

/** Plage de tirage des compétences initiales à 18 ans (spec §4.2) : très faibles, avec variance seedée. */
const INITIAL_SKILL_MIN = 1;
const INITIAL_SKILL_MAX = 8;

function createInitialSkills(rng: Rng): Skills {
  const skillRng = rng.fork("character:initial-skills");
  const entries = SKILL_NAMES.map(
    (name) => [name, skillRng.nextInt(INITIAL_SKILL_MIN, INITIAL_SKILL_MAX)] as const,
  );
  return Object.fromEntries(entries) as Skills;
}

function emptyAllocation(): Readonly<Record<TimeCategory, number>> {
  return { emploi: 0, apprentissage: 0, business: 0, reseau: 0 };
}

/**
 * Crée le personnage initial du P0 : 18 ans, 0 €, aucun diplôme, aucune
 * entreprise, compétences quasi nulles (spec §4.1).
 */
export function createInitialCharacter(rng: Rng, birthDate: GameDate): CharacterState {
  return {
    birthDate,
    skills: createInitialSkills(rng),
    cash: 0,
    education: "aucun",
    timeBudget: {
      totalHoursPerMonth: MONTHLY_TIME_BUDGET_HOURS,
      allocation: emptyAllocation(),
    },
    orgCapacity: { delegatedHoursPerMonth: 0 },
  };
}

export class TimeBudgetError extends Error {}

/**
 * Remplace l'allocation de temps du personnage. Rejette explicitement toute
 * allocation invalide (spec §4.3 : "le moteur refuse une allocation qui
 * dépasse le budget, pas un clamp silencieux").
 */
export function allocateTime(
  character: CharacterState,
  allocation: Readonly<Record<TimeCategory, number>>,
): CharacterState {
  for (const category of TIME_CATEGORIES) {
    const hours = allocation[category];
    if (!Number.isFinite(hours) || hours < 0) {
      throw new TimeBudgetError(
        `Allocation invalide pour "${category}" : ${hours} (doit être un nombre >= 0).`,
      );
    }
  }
  const total = TIME_CATEGORIES.reduce((sum, category) => sum + allocation[category], 0);
  if (total > character.timeBudget.totalHoursPerMonth) {
    throw new TimeBudgetError(
      `Allocation totale ${total}h dépasse le budget mensuel de ${character.timeBudget.totalHoursPerMonth}h.`,
    );
  }
  return {
    ...character,
    timeBudget: { ...character.timeBudget, allocation },
  };
}

/**
 * Applique un gain de compétence avec rendements décroissants (spec §4.2) :
 * plus la compétence est proche de 100, moins un même `rawGain` la fait
 * progresser. Le résultat reste toujours dans [0, 100].
 */
export function applySkillGain(skills: Skills, skill: SkillName, rawGain: number): Skills {
  if (rawGain < 0) {
    throw new RangeError(`applySkillGain: rawGain=${rawGain} doit être >= 0.`);
  }
  const current = skills[skill];
  const diminishingFactor = 1 - current / 100;
  const next = clamp(current + rawGain * diminishingFactor, 0, 100);
  return { ...skills, [skill]: next };
}
