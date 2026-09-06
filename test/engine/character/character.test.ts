import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  MONTHLY_TIME_BUDGET_HOURS,
  TimeBudgetError,
  allocateTime,
  applySkillGain,
  createInitialCharacter,
} from "../../../src/engine/character/character.js";
import { SKILL_NAMES } from "../../../src/types/character.js";

const BIRTH_DATE = { year: 2008, month: 1 };

describe("createInitialCharacter", () => {
  it("démarre à 0 €, sans diplôme, avec toutes les compétences très basses", () => {
    const character = createInitialCharacter(createRng(1), BIRTH_DATE);
    expect(character.cash).toBe(0);
    expect(character.education).toBe("aucun");
    expect(character.orgCapacity.delegatedHoursPerMonth).toBe(0);
    for (const skill of SKILL_NAMES) {
      expect(character.skills[skill]).toBeGreaterThanOrEqual(1);
      expect(character.skills[skill]).toBeLessThanOrEqual(8);
    }
  });

  it("est déterministe pour une même seed", () => {
    const a = createInitialCharacter(createRng(99), BIRTH_DATE);
    const b = createInitialCharacter(createRng(99), BIRTH_DATE);
    expect(a).toEqual(b);
  });

  it("produit des profils différents pour des seeds différentes", () => {
    const a = createInitialCharacter(createRng(1), BIRTH_DATE);
    const b = createInitialCharacter(createRng(2), BIRTH_DATE);
    expect(a.skills).not.toEqual(b.skills);
  });

  it("n'alloue aucune heure au départ", () => {
    const character = createInitialCharacter(createRng(1), BIRTH_DATE);
    expect(character.timeBudget.totalHoursPerMonth).toBe(MONTHLY_TIME_BUDGET_HOURS);
    expect(character.timeBudget.allocation).toEqual({
      emploi: 0,
      apprentissage: 0,
      business: 0,
      reseau: 0,
    });
  });
});

describe("allocateTime", () => {
  const character = createInitialCharacter(createRng(1), BIRTH_DATE);

  it("accepte une allocation dans le budget", () => {
    const updated = allocateTime(character, {
      emploi: 100,
      apprentissage: 20,
      business: 0,
      reseau: 10,
    });
    expect(updated.timeBudget.allocation.emploi).toBe(100);
  });

  it("rejette une allocation qui dépasse le budget total", () => {
    expect(() =>
      allocateTime(character, { emploi: 100, apprentissage: 40, business: 30, reseau: 0 }),
    ).toThrow(TimeBudgetError);
  });

  it("rejette une allocation négative", () => {
    expect(() =>
      allocateTime(character, { emploi: -5, apprentissage: 0, business: 0, reseau: 0 }),
    ).toThrow(TimeBudgetError);
  });

  it("ne mute pas le personnage d'origine", () => {
    const before = character.timeBudget.allocation.emploi;
    allocateTime(character, { emploi: 50, apprentissage: 0, business: 0, reseau: 0 });
    expect(character.timeBudget.allocation.emploi).toBe(before);
  });
});

describe("applySkillGain", () => {
  it("augmente la compétence ciblée sans affecter les autres", () => {
    const character = createInitialCharacter(createRng(1), BIRTH_DATE);
    const before = character.skills.vente;
    const updated = applySkillGain(character.skills, "vente", 10);
    expect(updated.vente).toBeGreaterThan(before);
    expect(updated.marketing).toBe(character.skills.marketing);
  });

  it("applique des rendements décroissants près de 100", () => {
    const lowSkills = { ...createInitialCharacter(createRng(1), BIRTH_DATE).skills, vente: 5 };
    const highSkills = { ...lowSkills, vente: 95 };
    const lowGain = applySkillGain(lowSkills, "vente", 10).vente - lowSkills.vente;
    const highGain = applySkillGain(highSkills, "vente", 10).vente - highSkills.vente;
    expect(highGain).toBeLessThan(lowGain);
  });

  it("ne dépasse jamais 100", () => {
    const skills = { ...createInitialCharacter(createRng(1), BIRTH_DATE).skills, vente: 98 };
    const updated = applySkillGain(skills, "vente", 1000);
    expect(updated.vente).toBeLessThanOrEqual(100);
  });

  it("rejette un gain négatif", () => {
    const character = createInitialCharacter(createRng(1), BIRTH_DATE);
    expect(() => applySkillGain(character.skills, "vente", -1)).toThrow(RangeError);
  });
});
