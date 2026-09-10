import { describe, expect, it } from "vitest";
import { deriveDecisions } from "../src/state/commercialTranslation";

describe("deriveDecisions (spec M11.1.5 §7.1 + M11.2 §3.4 : prix piloté par l'offre active)", () => {
  it("service : dérive targetHours depuis prospectionHours, prix depuis l'offre active", () => {
    const decisions = deriveDecisions("service", 40, { family: "service", price: 999, targetHours: 999 }, 45);
    expect(decisions).toEqual({ family: "service", price: 45, targetHours: 400 });
  });

  it("hospitality : dérive expectedDemandCovers, prix depuis l'offre active", () => {
    const decisions = deriveDecisions("hospitality", 40, { family: "hospitality", averageTicketPrice: 0, expectedDemandCovers: 0 }, 26);
    expect(decisions).toEqual({ family: "hospitality", averageTicketPrice: 26, expectedDemandCovers: 1_500 });
  });

  it("subscription : dérive entièrement newSubscribers depuis prospectionHours", () => {
    const decisions = deriveDecisions("subscription", 40, { family: "subscription", newSubscribers: 0 }, null);
    expect(decisions).toEqual({ family: "subscription", newSubscribers: 40 });
  });

  it("retail : dérive expectedFootTraffic, prix depuis l'offre active, conserve stockUnits", () => {
    const decisions = deriveDecisions("retail", 40, { family: "retail", unitPrice: 0, stockUnits: 600, expectedFootTraffic: 0 }, 15);
    expect(decisions).toEqual({ family: "retail", unitPrice: 15, stockUnits: 600, expectedFootTraffic: 2_500 });
  });

  it("agency : dérive entièrement targetMandates depuis prospectionHours", () => {
    const decisions = deriveDecisions("agency", 40, { family: "agency", targetMandates: 0 }, null);
    expect(decisions).toEqual({ family: "agency", targetMandates: 20 });
  });

  it("aucune offre active (null) donne un prix de 0 : tant qu'aucune offre n'est lancée, l'entreprise ne vend rien", () => {
    const service = deriveDecisions("service", 40, { family: "service", price: 999, targetHours: 0 }, null);
    const hospitality = deriveDecisions("hospitality", 40, { family: "hospitality", averageTicketPrice: 999, expectedDemandCovers: 0 }, null);
    const retail = deriveDecisions("retail", 40, { family: "retail", unitPrice: 999, stockUnits: 100, expectedFootTraffic: 0 }, null);
    if (service.family !== "service" || hospitality.family !== "hospitality" || retail.family !== "retail") {
      throw new Error("familles inattendues");
    }
    expect(service.price).toBe(0);
    expect(hospitality.averageTicketPrice).toBe(0);
    expect(retail.unitPrice).toBe(0);
    expect(retail.stockUnits).toBe(100); // stockUnits reste indépendant du prix
  });

  it("0 heure de prospection produit une cible nulle, jamais négative ou NaN", () => {
    const zero = deriveDecisions("service", 0, { family: "service", price: 40, targetHours: 0 }, 40);
    const negative = deriveDecisions("service", -10, { family: "service", price: 40, targetHours: 0 }, 40);
    if (zero.family !== "service" || negative.family !== "service") throw new Error("devrait rester 'service'");
    expect(zero.targetHours).toBe(0);
    expect(negative.targetHours).toBe(0);
  });
});
