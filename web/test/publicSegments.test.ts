import { describe, expect, it } from "vitest";
import type { EconomicFamily } from "@founder/engine";
import { getPublicSegmentOptions } from "../src/data/publicSegments";

const FAMILIES: readonly EconomicFamily[] = ["service", "hospitality", "subscription", "retail", "agency"];

describe("getPublicSegmentOptions (spec M11.2.2 §11 : projection minimale, aucun coefficient interne)", () => {
  it("chaque famille a entre 3 et 5 segments publics", () => {
    for (const family of FAMILIES) {
      const options = getPublicSegmentOptions(family);
      expect(options.length).toBeGreaterThanOrEqual(3);
      expect(options.length).toBeLessThanOrEqual(5);
    }
  });

  it("chaque option n'expose que {id, label}, jamais un coefficient interne", () => {
    for (const family of FAMILIES) {
      for (const option of getPublicSegmentOptions(family)) {
        expect(Object.keys(option).sort()).toEqual(["id", "label"]);
        expect(option.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("est déterministe (même famille -> mêmes options)", () => {
    expect(getPublicSegmentOptions("service")).toEqual(getPublicSegmentOptions("service"));
  });
});
