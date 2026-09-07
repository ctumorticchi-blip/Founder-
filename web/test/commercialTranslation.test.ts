import { describe, expect, it } from "vitest";
import { deriveDecisions } from "../src/state/commercialTranslation";

describe("deriveDecisions (spec M11.1.5 §7.1 : traduction prospection -> decisions moteur)", () => {
  it("service : dérive targetHours depuis prospectionHours, conserve price tel quel", () => {
    const decisions = deriveDecisions("service", 40, { family: "service", price: 45, targetHours: 999 });
    expect(decisions).toEqual({ family: "service", price: 45, targetHours: 400 });
  });

  it("hospitality : dérive expectedDemandCovers, conserve averageTicketPrice", () => {
    const decisions = deriveDecisions("hospitality", 40, { family: "hospitality", averageTicketPrice: 26, expectedDemandCovers: 0 });
    expect(decisions).toEqual({ family: "hospitality", averageTicketPrice: 26, expectedDemandCovers: 1_500 });
  });

  it("subscription : dérive entièrement newSubscribers depuis prospectionHours", () => {
    const decisions = deriveDecisions("subscription", 40, { family: "subscription", newSubscribers: 0 });
    expect(decisions).toEqual({ family: "subscription", newSubscribers: 40 });
  });

  it("retail : dérive expectedFootTraffic, conserve unitPrice et stockUnits", () => {
    const decisions = deriveDecisions("retail", 40, { family: "retail", unitPrice: 15, stockUnits: 600, expectedFootTraffic: 0 });
    expect(decisions).toEqual({ family: "retail", unitPrice: 15, stockUnits: 600, expectedFootTraffic: 2_500 });
  });

  it("agency : dérive entièrement targetMandates depuis prospectionHours", () => {
    const decisions = deriveDecisions("agency", 40, { family: "agency", targetMandates: 0 });
    expect(decisions).toEqual({ family: "agency", targetMandates: 20 });
  });

  it("0 heure de prospection produit une cible nulle, jamais négative ou NaN", () => {
    const zero = deriveDecisions("service", 0, { family: "service", price: 40, targetHours: 0 });
    const negative = deriveDecisions("service", -10, { family: "service", price: 40, targetHours: 0 });
    if (zero.family !== "service" || negative.family !== "service") throw new Error("devrait rester 'service'");
    expect(zero.targetHours).toBe(0);
    expect(negative.targetHours).toBe(0);
  });
});
