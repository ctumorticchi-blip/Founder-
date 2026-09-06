import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { addMonths } from "../../../src/engine/time/clock.js";
import { advanceMacro, createInitialMacroState } from "../../../src/engine/world/world.js";

const START_DATE = { year: 2026, month: 1 };

describe("createInitialMacroState", () => {
  it("démarre en phase d'expansion avec des taux plausibles", () => {
    const macro = createInitialMacroState(START_DATE);
    expect(macro.cyclePhase).toBe("expansion");
    expect(macro.inflationRateAnnual).toBeGreaterThan(0);
    expect(macro.gdpGrowthRateAnnual).toBeGreaterThan(0);
  });
});

describe("advanceMacro", () => {
  it("est déterministe pour un même seed", () => {
    const macro = createInitialMacroState(START_DATE);
    const nextDate = addMonths(START_DATE, 1);
    const a = advanceMacro(macro, nextDate, createRng(1));
    const b = advanceMacro(macro, nextDate, createRng(1));
    expect(a).toEqual(b);
  });

  it("avance bien la date", () => {
    const macro = createInitialMacroState(START_DATE);
    const nextDate = addMonths(START_DATE, 1);
    const next = advanceMacro(macro, nextDate, createRng(1));
    expect(next.date).toEqual(nextDate);
  });

  it("ne fait jamais sortir les taux de bornes raisonnables sur 240 mois", () => {
    let macro = createInitialMacroState(START_DATE);
    const rng = createRng(2026);
    let date = START_DATE;
    for (let i = 0; i < 240; i++) {
      date = addMonths(date, 1);
      macro = advanceMacro(macro, date, rng.fork(`month-${i}`));
      expect(macro.inflationRateAnnual).toBeGreaterThanOrEqual(-0.02);
      expect(macro.inflationRateAnnual).toBeLessThanOrEqual(0.15);
      expect(macro.referenceInterestRate).toBeGreaterThanOrEqual(0);
    }
  });

  it("finit par transiter de phase sur un horizon long (pas bloqué en expansion)", () => {
    let macro = createInitialMacroState(START_DATE);
    const rng = createRng(7);
    let date = START_DATE;
    const phasesSeen = new Set([macro.cyclePhase]);
    for (let i = 0; i < 120; i++) {
      date = addMonths(date, 1);
      macro = advanceMacro(macro, date, rng.fork(`m${i}`));
      phasesSeen.add(macro.cyclePhase);
    }
    expect(phasesSeen.size).toBeGreaterThan(1);
  });
});
