import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { generateStrategicAccountIdentity } from "../../../src/engine/business/strategicAccountIdentity.js";

describe("generateStrategicAccountIdentity (spec M11.2.4 §5)", () => {
  it("est déterministe : même rng (même seed) -> même identité", () => {
    expect(generateStrategicAccountIdentity(createRng(42))).toEqual(generateStrategicAccountIdentity(createRng(42)));
  });

  it("produit des identités réellement différentes selon la seed", () => {
    const identities = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(generateStrategicAccountIdentity(createRng(i)))));
    expect(identities.size).toBeGreaterThan(10);
  });

  it("ne renvoie jamais une chaîne vide ni un id/slug technique", () => {
    for (let seed = 0; seed < 30; seed++) {
      const identity = generateStrategicAccountIdentity(createRng(seed));
      expect(identity.companyName.length).toBeGreaterThan(0);
      expect(identity.contactName.length).toBeGreaterThan(0);
      expect(identity.contactRole.length).toBeGreaterThan(0);
      expect(identity.companyName).not.toMatch(/^[a-z0-9-]+$/);
    }
  });
});
