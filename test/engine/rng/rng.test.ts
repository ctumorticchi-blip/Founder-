import { describe, expect, it } from "vitest";
import { createRng, deriveSeed } from "../../../src/engine/rng/rng.js";

describe("createRng", () => {
  it("est reproductible pour une même seed", () => {
    const rngA = createRng(42);
    const rngB = createRng(42);
    const seqA = Array.from({ length: 20 }, () => rngA.next());
    const seqB = Array.from({ length: 20 }, () => rngB.next());
    expect(seqA).toEqual(seqB);
  });

  it("produit des séquences différentes pour des seeds différentes", () => {
    const rngA = createRng(1);
    const rngB = createRng(2);
    const seqA = Array.from({ length: 10 }, () => rngA.next());
    const seqB = Array.from({ length: 10 }, () => rngB.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("next() reste dans [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("nextInt respecte les bornes incluses", () => {
    const rng = createRng(123);
    for (let i = 0; i < 500; i++) {
      const value = rng.nextInt(3, 5);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(5);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("nextInt rejette min > max", () => {
    const rng = createRng(1);
    expect(() => rng.nextInt(5, 1)).toThrow(RangeError);
  });

  it("pick rejette un tableau vide", () => {
    const rng = createRng(1);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("pick choisit toujours parmi les éléments fournis", () => {
    const rng = createRng(9);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("pickWeighted favorise statistiquement le poids le plus fort", () => {
    const rng = createRng(555);
    const counts = { low: 0, high: 0 };
    for (let i = 0; i < 2000; i++) {
      const value = rng.pickWeighted([
        { value: "low", weight: 1 },
        { value: "high", weight: 9 },
      ]);
      counts[value as "low" | "high"]++;
    }
    expect(counts.high).toBeGreaterThan(counts.low * 3);
  });

  it("pickWeighted rejette une somme de poids nulle ou négative", () => {
    const rng = createRng(1);
    expect(() =>
      rng.pickWeighted([
        { value: "a", weight: 0 },
        { value: "b", weight: 0 },
      ]),
    ).toThrow(RangeError);
  });

  it("nextGaussian produit une moyenne empirique proche de la moyenne demandée", () => {
    const rng = createRng(2024);
    const samples = Array.from({ length: 5000 }, () => rng.nextGaussian(10, 2));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(9.5);
    expect(mean).toBeLessThan(10.5);
  });

  it("fork est déterministe et indépendant de la consommation préalable", () => {
    const rngA = createRng(42);
    const forkedImmediately = rngA.fork("business:month-1");

    const rngB = createRng(42);
    rngB.next();
    rngB.next();
    rngB.next();
    const forkedAfterConsumption = rngB.fork("business:month-1");

    expect(forkedImmediately.next()).toBe(forkedAfterConsumption.next());
  });

  it("fork produit des flux différents pour des labels différents", () => {
    const rng = createRng(42);
    const forkA = rng.fork("a");
    const forkB = rng.fork("b");
    expect(forkA.next()).not.toBe(forkB.next());
  });
});

describe("deriveSeed", () => {
  it("est une fonction pure : mêmes arguments -> même résultat", () => {
    expect(deriveSeed(1, "world", 2026, 3)).toBe(deriveSeed(1, "world", 2026, 3));
  });

  it("varie si un des segments de contexte change", () => {
    expect(deriveSeed(1, "world", 2026, 3)).not.toBe(deriveSeed(1, "world", 2026, 4));
  });
});
