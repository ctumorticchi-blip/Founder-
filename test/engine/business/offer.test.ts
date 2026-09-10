import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_POINTS_PER_BUDGET_EURO,
  DEVELOPMENT_POINTS_PER_HOUR,
  INITIAL_QUALITY_LEVEL,
  computeLaunchThreshold,
  createOffer,
  developOffer,
  launchOffer,
  updateOfferPricing,
} from "../../../src/engine/business/offer.js";
import type { Offer, OfferCreateSpec } from "../../../src/types/offer.js";

const DATE = { year: 2026, month: 1 } as const;

function spec(overrides: Partial<OfferCreateSpec> = {}): OfferCreateSpec {
  return {
    id: "offer-1",
    name: "Nettoyage Premium",
    businessModel: "unit-sale",
    positioning: "standard",
    targetSegment: "Particuliers",
    price: 20,
    ...overrides,
  };
}

describe("computeLaunchThreshold", () => {
  it("service-hours n'a aucun seuil (toujours lançable)", () => {
    expect(computeLaunchThreshold("service-hours")).toBe(0);
  });

  it("project/unit-sale/recurring exigent un vrai développement", () => {
    expect(computeLaunchThreshold("project")).toBeGreaterThan(0);
    expect(computeLaunchThreshold("unit-sale")).toBeGreaterThan(0);
    expect(computeLaunchThreshold("recurring")).toBeGreaterThan(0);
  });
});

describe("createOffer", () => {
  it("rejette un nom vide", () => {
    expect(() => createOffer(spec({ name: "" }), DATE)).toThrow(RangeError);
    expect(() => createOffer(spec({ name: "   " }), DATE)).toThrow(RangeError);
  });

  it("rejette un prix négatif", () => {
    expect(() => createOffer(spec({ price: -1 }), DATE)).toThrow(RangeError);
  });

  it("produit une offre en développement, maturité 0, qualité initiale", () => {
    const offer = createOffer(spec(), DATE);
    expect(offer.status).toBe("in-development");
    expect(offer.maturity).toBe(0);
    expect(offer.qualityLevel).toBe(INITIAL_QUALITY_LEVEL);
    expect(offer.developmentHoursInvested).toBe(0);
    expect(offer.developmentBudgetInvested).toBe(0);
    expect(offer.launchedAt).toBeNull();
    expect(offer.createdAt).toEqual(DATE);
    expect(offer.id).toBe("offer-1");
    expect(offer.name).toBe("Nettoyage Premium");
  });
});

describe("developOffer", () => {
  it("rejette des heures négatives", () => {
    const offer = createOffer(spec(), DATE);
    expect(() => developOffer(offer, -1, 0)).toThrow(RangeError);
  });

  it("rejette un budget négatif", () => {
    const offer = createOffer(spec(), DATE);
    expect(() => developOffer(offer, 0, -1)).toThrow(RangeError);
  });

  it("incrémente la maturité avant lancement, selon le calibrage (20h + 500€ = 40 points)", () => {
    const offer = createOffer(spec(), DATE);
    const developed = developOffer(offer, 20, 500);
    const expectedPoints = 20 * DEVELOPMENT_POINTS_PER_HOUR + 500 * DEVELOPMENT_POINTS_PER_BUDGET_EURO;
    expect(expectedPoints).toBeCloseTo(40, 5);
    expect(developed.maturity).toBeCloseTo(40, 5);
    expect(developed.qualityLevel).toBe(INITIAL_QUALITY_LEVEL); // inchangé avant lancement
  });

  it("accumule les cumuls investis sur plusieurs mois", () => {
    let offer: Offer = createOffer(spec(), DATE);
    offer = developOffer(offer, 10, 200);
    offer = developOffer(offer, 15, 300);
    expect(offer.developmentHoursInvested).toBe(25);
    expect(offer.developmentBudgetInvested).toBe(500);
  });

  it("progression multi-mois : la maturité s'accumule de façon déterministe", () => {
    let offer: Offer = createOffer(spec({ businessModel: "unit-sale" }), DATE);
    for (let i = 0; i < 3; i += 1) {
      offer = developOffer(offer, 20, 500);
    }
    // 3 x 40 points = 120, clampé à 100.
    expect(offer.maturity).toBe(100);
  });

  it("clampe la maturité à 100", () => {
    const offer = createOffer(spec(), DATE);
    const developed = developOffer(offer, 1000, 100_000);
    expect(developed.maturity).toBe(100);
  });

  it("deux appels identiques produisent le même résultat (déterminisme)", () => {
    const offer = createOffer(spec(), DATE);
    const a = developOffer(offer, 12, 250);
    const b = developOffer(offer, 12, 250);
    expect(a).toEqual(b);
  });

  it("après lancement, incrémente la qualité plutôt que la maturité (amélioration)", () => {
    let offer: Offer = createOffer(spec({ businessModel: "service-hours" }), DATE);
    offer = launchOffer(offer, DATE);
    const before = offer.maturity;
    const improved = developOffer(offer, 20, 500);
    expect(improved.maturity).toBe(before); // gelée au lancement
    expect(improved.qualityLevel).toBeGreaterThan(INITIAL_QUALITY_LEVEL);
  });
});

describe("launchOffer", () => {
  it("service-hours est lançable immédiatement, sans aucun développement", () => {
    const offer = createOffer(spec({ businessModel: "service-hours" }), DATE);
    const launched = launchOffer(offer, DATE);
    expect(launched.status).toBe("launched");
    expect(launched.launchedAt).toEqual(DATE);
  });

  it("unit-sale/recurring/project rejettent un lancement prématuré", () => {
    for (const businessModel of ["unit-sale", "recurring", "project"] as const) {
      const offer = createOffer(spec({ businessModel }), DATE);
      expect(() => launchOffer(offer, DATE)).toThrow(RangeError);
    }
  });

  it("le message de refus cite le nom de l'offre, jamais son id technique", () => {
    const offer = createOffer(spec({ id: "offre-technique-abc123", name: "Ma Belle Offre", businessModel: "unit-sale" }), DATE);
    try {
      launchOffer(offer, DATE);
      expect.fail("devait lever une RangeError");
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      const message = (error as Error).message;
      expect(message).toContain("Ma Belle Offre");
      expect(message).not.toContain("offre-technique-abc123");
    }
  });

  it("accepte un lancement une fois le seuil atteint", () => {
    let offer: Offer = createOffer(spec({ businessModel: "unit-sale" }), DATE);
    const threshold = computeLaunchThreshold("unit-sale");
    while (offer.maturity < threshold) {
      offer = developOffer(offer, 20, 500);
    }
    const launched = launchOffer(offer, DATE);
    expect(launched.status).toBe("launched");
  });

  it("rejette une offre déjà lancée", () => {
    let offer: Offer = createOffer(spec({ businessModel: "service-hours" }), DATE);
    offer = launchOffer(offer, DATE);
    expect(() => launchOffer(offer, DATE)).toThrow(RangeError);
  });
});

describe("updateOfferPricing", () => {
  it("rejette un prix négatif", () => {
    const offer = createOffer(spec(), DATE);
    expect(() => updateOfferPricing(offer, -1, "premium")).toThrow(RangeError);
  });

  it("met à jour prix et positionnement, sans effet sur le reste", () => {
    const offer = createOffer(spec(), DATE);
    const updated = updateOfferPricing(offer, 99, "premium");
    expect(updated.price).toBe(99);
    expect(updated.positioning).toBe("premium");
    expect(updated.maturity).toBe(offer.maturity);
    expect(updated.status).toBe(offer.status);
  });
});
