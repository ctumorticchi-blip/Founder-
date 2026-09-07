import { describe, expect, it } from "vitest";
import { defaultBusinessIdentity } from "../src/state/businessIdentity";

const DATE = { year: 2026, month: 3 };

describe("defaultBusinessIdentity", () => {
  it("retourne un nom et une description non vides pour chacune des 5 familles", () => {
    const families = ["service", "hospitality", "subscription", "retail", "agency"] as const;
    for (const family of families) {
      const identity = defaultBusinessIdentity(family, DATE);
      expect(identity.displayName.length).toBeGreaterThan(0);
      expect(identity.description.length).toBeGreaterThan(0);
      expect(identity.activity.length).toBeGreaterThan(0);
      expect(identity.targetCustomers.length).toBeGreaterThan(0);
      expect(identity.createdAt).toEqual(DATE);
    }
  });
});
