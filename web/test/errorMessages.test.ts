import { describe, expect, it } from "vitest";
import { sanitizeEngineError } from "../src/state/errorMessages";

describe("sanitizeEngineError (spec M11.1.5 §3.2, I1 étendu)", () => {
  const identities = {
    "service-a3f8e21c": {
      displayName: "Svc Established",
      description: "",
      activity: "",
      targetCustomers: "",
      createdAt: { year: 2025, month: 1 },
    },
  };

  it("retire le préfixe technique et remplace l'id par le nom commercial", () => {
    const raw =
      'simulateMonth: businessId="service-a3f8e21c" — capacité atteinte (2/3 postes utilisés). Agrandissez vos locaux avant de recruter.';
    const sanitized = sanitizeEngineError(raw, identities);
    expect(sanitized).not.toContain("service-a3f8e21c");
    expect(sanitized).not.toContain("simulateMonth");
    expect(sanitized).toContain("Svc Established");
    expect(sanitized).toContain("capacité atteinte");
  });

  it("ne laisse aucun id technique quand plusieurs entreprises sont connues", () => {
    const raw = 'resolveBusinessMonth: businessId="service-a3f8e21c" nécessite des décisions ce mois-ci.';
    const sanitized = sanitizeEngineError(raw, identities);
    expect(sanitized).not.toContain("service-a3f8e21c");
    expect(sanitized).toContain("Svc Established");
  });

  it("laisse un message sans id/préfixe technique connu essentiellement inchangé", () => {
    const raw = "Allocation totale 190h dépasse le budget mensuel de 160h.";
    expect(sanitizeEngineError(raw, identities)).toBe(raw);
  });
});
