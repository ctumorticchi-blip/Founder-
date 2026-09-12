import { describe, expect, it } from "vitest";
import { computeSegmentExpectation } from "../../../src/engine/customer/expectations.js";
import type { CustomerSegment } from "../../../src/types/customerSegment.js";
import type { Offer } from "../../../src/types/offer.js";

function offer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-1",
    name: "Offre Test",
    businessModel: "service-hours",
    positioning: "standard",
    targetSegment: "",
    price: 45,
    status: "launched",
    maturity: 100,
    qualityLevel: 60,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: { year: 2026, month: 1 },
    launchedAt: { year: 2026, month: 1 },
    lastDemand: null,
    customerMemory: [],
    ...overrides,
  };
}

function segment(overrides: Partial<CustomerSegment> = {}): CustomerSegment {
  return {
    id: "seg-1",
    label: "Segment Test",
    relativeSize: 1,
    referencePrice: 45,
    preferredPositioning: "standard",
    priceSensitivity: 0.5,
    qualityExpectation: 55,
    trustImportance: 0.5,
    structuralTrend: 0,
    seasonality: Array(12).fill(1),
    ...overrides,
  };
}

describe("computeSegmentExpectation (spec M11.2.3 §3)", () => {
  it("des segments avec une exigence différente produisent des attentes différentes, à offre égale", () => {
    const demanding = computeSegmentExpectation(offer(), segment({ qualityExpectation: 80 }), 0.5);
    const relaxed = computeSegmentExpectation(offer(), segment({ qualityExpectation: 30 }), 0.5);
    expect(demanding).toBeGreaterThan(relaxed);
  });

  it("un prix supérieur au prix de référence élève les attentes", () => {
    const atReference = computeSegmentExpectation(offer({ price: 45 }), segment({ referencePrice: 45 }), 0.5);
    const abovePremium = computeSegmentExpectation(offer({ price: 90 }), segment({ referencePrice: 45 }), 0.5);
    expect(abovePremium).toBeGreaterThan(atReference);
  });

  it("un prix inférieur au prix de référence n'élève jamais les attentes au-delà du prix de référence", () => {
    const atReference = computeSegmentExpectation(offer({ price: 45 }), segment({ referencePrice: 45 }), 0.5);
    const cheaper = computeSegmentExpectation(offer({ price: 20 }), segment({ referencePrice: 45 }), 0.5);
    expect(cheaper).toBe(atReference);
  });

  it("un positionnement premium élève les attentes par rapport à standard/economy, tout le reste égal", () => {
    const premium = computeSegmentExpectation(offer({ positioning: "premium" }), segment(), 0.5);
    const standard = computeSegmentExpectation(offer({ positioning: "standard" }), segment(), 0.5);
    const economy = computeSegmentExpectation(offer({ positioning: "economy" }), segment(), 0.5);
    expect(premium).toBeGreaterThan(standard);
    expect(standard).toBeGreaterThan(economy);
  });

  it("une réputation plus haute élève les attentes (la promesse implicite)", () => {
    const lowRep = computeSegmentExpectation(offer(), segment(), 0.1);
    const highRep = computeSegmentExpectation(offer(), segment(), 0.9);
    expect(highRep).toBeGreaterThan(lowRep);
  });

  it("deux segments avec une sensibilité au prix différente réagissent différemment à la même hausse de prix", () => {
    const expensive = offer({ price: 90 });
    const sensitive = computeSegmentExpectation(expensive, segment({ referencePrice: 45, priceSensitivity: 0.9 }), 0.5);
    const insensitive = computeSegmentExpectation(expensive, segment({ referencePrice: 45, priceSensitivity: 0.1 }), 0.5);
    expect(sensitive).toBeGreaterThan(insensitive);
  });

  it("reste borné [0,100] même avec des entrées extrêmes", () => {
    const extreme = computeSegmentExpectation(offer({ price: 100_000, positioning: "premium" }), segment({ priceSensitivity: 1 }), 1);
    expect(extreme).toBeLessThanOrEqual(100);
    expect(extreme).toBeGreaterThanOrEqual(0);
  });

  it("est déterministe", () => {
    const a = computeSegmentExpectation(offer(), segment(), 0.5);
    const b = computeSegmentExpectation(offer(), segment(), 0.5);
    expect(a).toBe(b);
  });
});
