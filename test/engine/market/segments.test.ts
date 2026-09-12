import { describe, expect, it } from "vitest";
import { ECONOMIC_FAMILIES } from "../../../src/types/business.js";
import { getMarketSegments } from "../../../src/engine/market/segments.js";

describe("getMarketSegments (spec M11.2.2 §2)", () => {
  it("chaque famille a entre 3 et 5 segments distincts", () => {
    for (const family of ECONOMIC_FAMILIES) {
      const segments = getMarketSegments(family);
      expect(segments.length).toBeGreaterThanOrEqual(3);
      expect(segments.length).toBeLessThanOrEqual(5);
      const ids = new Set(segments.map((s) => s.id));
      expect(ids.size).toBe(segments.length);
    }
  });

  it("les relativeSize d'une famille somment approximativement à 1", () => {
    for (const family of ECONOMIC_FAMILIES) {
      const total = getMarketSegments(family).reduce((sum, s) => sum + s.relativeSize, 0);
      expect(total).toBeCloseTo(1, 1);
    }
  });

  it("chaque segment a des coefficients dans leurs bornes attendues", () => {
    for (const family of ECONOMIC_FAMILIES) {
      for (const segment of getMarketSegments(family)) {
        expect(segment.label.length).toBeGreaterThan(0);
        expect(segment.relativeSize).toBeGreaterThan(0);
        expect(segment.relativeSize).toBeLessThanOrEqual(1);
        expect(segment.referencePrice).toBeGreaterThan(0);
        expect(segment.priceSensitivity).toBeGreaterThanOrEqual(0);
        expect(segment.priceSensitivity).toBeLessThanOrEqual(1);
        expect(segment.qualityExpectation).toBeGreaterThan(0);
        expect(segment.qualityExpectation).toBeLessThanOrEqual(100);
        expect(segment.trustImportance).toBeGreaterThanOrEqual(0);
        expect(segment.trustImportance).toBeLessThanOrEqual(1);
        expect(segment.seasonality).toHaveLength(12);
        for (const multiplier of segment.seasonality) {
          expect(multiplier).toBeGreaterThan(0);
        }
      }
    }
  });

  it("au moins deux positionnements différents apparaissent par famille (segments réellement distincts)", () => {
    for (const family of ECONOMIC_FAMILIES) {
      const positionings = new Set(getMarketSegments(family).map((s) => s.preferredPositioning));
      expect(positionings.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("est déterministe (même famille -> même résultat, appels répétés)", () => {
    expect(getMarketSegments("service")).toEqual(getMarketSegments("service"));
  });

  it("des segments d'une même famille ont une saisonnalité différente (diversité réelle)", () => {
    for (const family of ECONOMIC_FAMILIES) {
      const seasonalities = getMarketSegments(family).map((s) => JSON.stringify(s.seasonality));
      expect(new Set(seasonalities).size).toBeGreaterThan(1);
    }
  });
});
