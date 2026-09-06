import { describe, expect, it } from "vitest";
import {
  addMonths,
  ageInYears,
  compareGameDates,
  formatGameDate,
  fromMonthIndex,
  monthsBetween,
  toMonthIndex,
} from "../../../src/engine/time/clock.js";

describe("toMonthIndex / fromMonthIndex", () => {
  it("sont des bijections réciproques", () => {
    const date = { year: 2026, month: 5 };
    expect(fromMonthIndex(toMonthIndex(date))).toEqual(date);
  });

  it("rejette un mois hors [1, 12]", () => {
    expect(() => toMonthIndex({ year: 2026, month: 0 })).toThrow(RangeError);
    expect(() => toMonthIndex({ year: 2026, month: 13 })).toThrow(RangeError);
  });
});

describe("addMonths", () => {
  it("avance dans la même année", () => {
    expect(addMonths({ year: 2026, month: 1 }, 2)).toEqual({ year: 2026, month: 3 });
  });

  it("gère le passage à l'année suivante", () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({ year: 2027, month: 2 });
  });

  it("gère les décalages négatifs", () => {
    expect(addMonths({ year: 2026, month: 2 }, -3)).toEqual({ year: 2025, month: 11 });
  });

  it("rejette un nombre de mois non entier", () => {
    expect(() => addMonths({ year: 2026, month: 1 }, 1.5)).toThrow(RangeError);
  });
});

describe("monthsBetween", () => {
  it("calcule un écart positif", () => {
    expect(monthsBetween({ year: 2026, month: 1 }, { year: 2027, month: 3 })).toBe(14);
  });

  it("calcule un écart négatif", () => {
    expect(monthsBetween({ year: 2027, month: 3 }, { year: 2026, month: 1 })).toBe(-14);
  });
});

describe("compareGameDates", () => {
  it("ordonne correctement deux dates", () => {
    expect(compareGameDates({ year: 2026, month: 1 }, { year: 2026, month: 2 })).toBe(-1);
    expect(compareGameDates({ year: 2026, month: 2 }, { year: 2026, month: 1 })).toBe(1);
    expect(compareGameDates({ year: 2026, month: 2 }, { year: 2026, month: 2 })).toBe(0);
  });
});

describe("ageInYears", () => {
  it("calcule 18 ans révolus exactement à la date anniversaire", () => {
    const birth = { year: 2008, month: 9 };
    const current = { year: 2026, month: 9 };
    expect(ageInYears(birth, current)).toBe(18);
  });

  it("ne compte pas l'année si l'anniversaire n'est pas encore passé", () => {
    const birth = { year: 2008, month: 9 };
    const current = { year: 2026, month: 8 };
    expect(ageInYears(birth, current)).toBe(17);
  });

  it("rejette une date courante antérieure à la naissance", () => {
    expect(() =>
      ageInYears({ year: 2026, month: 1 }, { year: 2025, month: 1 }),
    ).toThrow(RangeError);
  });
});

describe("formatGameDate", () => {
  it("formate avec le mois sur 2 chiffres", () => {
    expect(formatGameDate({ year: 2026, month: 3 })).toBe("2026-03");
    expect(formatGameDate({ year: 2026, month: 12 })).toBe("2026-12");
  });
});
