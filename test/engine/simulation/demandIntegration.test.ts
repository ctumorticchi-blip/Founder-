import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { createOwnedBusiness, resolveBusinessMonth } from "../../../src/engine/simulation/businessResolution.js";
import type { CreateBusinessSpec } from "../../../src/engine/simulation/types.js";
import type { Market } from "../../../src/types/market.js";
import type { Offer, OfferAction } from "../../../src/types/offer.js";

/**
 * Intégration Customer & Demand Engine (spec M11.2.2 §6-§9) : ces tests
 * vérifient que le CA est réellement la CONSÉQUENCE de la demande captée
 * (calculée par `computeOfferDemand` à partir des offres/segments/marché)
 * et de la capacité opérationnelle — jamais un entonnoir d'affichage
 * posé par-dessus une cible choisie par le joueur (`targetHours`/
 * `expectedDemandCovers`/`newSubscribers`/`expectedFootTraffic`/
 * `targetMandates`, tous supprimés du type `BusinessFamilyDecisions`).
 */

const DATE = { year: 2026, month: 6 };

function bigMarket(family: Market["family"], id: string): Market {
  return {
    id,
    family,
    sizeMonthlyRevenuePotential: 2_000_000,
    growthRateMonthly: 0.01,
    averageMargin: 0.4,
    fragmentation: 0.8,
    competitiveIntensity: 0.3,
    capitalIntensity: 0.1,
    regulation: 0.2,
    innovationRate: 0.1,
    priceSensitivity: 0.5,
    entryBarriers: 0.2,
    cyclicality: 0.3,
  };
}

function offerAction(id: string, price: number, businessModel: Offer["businessModel"] = "service-hours"): OfferAction[] {
  return [
    { kind: "create", spec: { id, name: `Offre ${id}`, businessModel, positioning: "standard", targetSegment: "", price } },
    { kind: "launch", offerId: id },
  ];
}

describe("Customer & Demand Engine — le CA est une conséquence de la demande captée et de la capacité", () => {
  it("aucune offre lancée => CA nul (invariant hérité M11.2.1)", () => {
    const spec: CreateBusinessSpec = {
      family: "service",
      name: "Svc",
      marketId: "m",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const owned = createOwnedBusiness("svc", spec);
    const result = resolveBusinessMonth(
      owned,
      {
        businessId: "svc",
        founderHoursAllocated: 150,
        founderProspectionHoursAllocated: 0,
        decisions: { family: "service" },
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
      1,
      50,
      createRng(1),
      DATE,
      bigMarket("service", "m"),
    );
    expect(result.statement.revenue).toBe(0);
    expect(result.updated.business.offers).toHaveLength(0);
  });

  it("demande << capacité : la vente reste sous la capacité, aucune vente perdue", () => {
    const spec: CreateBusinessSpec = {
      family: "service",
      name: "Svc",
      marketId: "m",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const owned = createOwnedBusiness("svc", spec);
    const result = resolveBusinessMonth(
      owned,
      {
        businessId: "svc",
        founderHoursAllocated: 150,
        founderProspectionHoursAllocated: 0,
        offerActions: offerAction("o1", 45),
        decisions: { family: "service" },
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
      0.0002, // part de marché infime : la demande captée reste très inférieure à la capacité
      50,
      createRng(1),
      DATE,
      bigMarket("service", "m"),
    );
    const offer = result.updated.business.offers[0]!;
    expect(offer.lastDemand).not.toBeNull();
    expect(offer.lastDemand!.demand).toBeLessThan(offer.lastDemand!.capacity);
    expect(offer.lastDemand!.lostToCapacity).toBe(0);
  });

  it("demande >> capacité : des ventes sont perdues, distinctes du manque de demande", () => {
    const spec: CreateBusinessSpec = {
      family: "service",
      name: "Svc",
      marketId: "m",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const owned = createOwnedBusiness("svc", spec);
    const result = resolveBusinessMonth(
      owned,
      {
        businessId: "svc",
        founderHoursAllocated: 10, // capacité minuscule : fondateur seul, peu d'heures
        founderProspectionHoursAllocated: 0,
        offerActions: offerAction("o1", 45),
        decisions: { family: "service" },
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
      1,
      50,
      createRng(1),
      DATE,
      bigMarket("service", "m"),
    );
    const offer = result.updated.business.offers[0]!;
    expect(offer.lastDemand!.demand).toBeGreaterThan(offer.lastDemand!.capacity);
    expect(offer.lastDemand!.lostToCapacity).toBeGreaterThan(0);
  });

  it("deux offres lancées simultanément coexistent : chacune a sa propre demande attribuable", () => {
    const spec: CreateBusinessSpec = {
      family: "service",
      name: "Svc",
      marketId: "m",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const owned = createOwnedBusiness("svc", spec);
    const result = resolveBusinessMonth(
      owned,
      {
        businessId: "svc",
        founderHoursAllocated: 150,
        founderProspectionHoursAllocated: 0,
        offerActions: [...offerAction("cheap", 30), ...offerAction("premium", 65)],
        decisions: { family: "service" },
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
      1,
      50,
      createRng(1),
      DATE,
      bigMarket("service", "m"),
    );
    const cheap = result.updated.business.offers.find((o) => o.id === "cheap")!;
    const premium = result.updated.business.offers.find((o) => o.id === "premium")!;
    expect(cheap.lastDemand).not.toBeNull();
    expect(premium.lastDemand).not.toBeNull();
    // La deuxième offre traitée (premium, ordre de création) hérite de la capacité
    // restante après la première (cheap) : jamais la pleine capacité de l'entreprise.
    expect(premium.lastDemand!.capacity).toBeLessThan(cheap.lastDemand!.capacity);
    expect(result.statement.revenue).toBeGreaterThan(0);
  });

  it("deux entreprises différentes ne partagent aucun état de demande (indépendance)", () => {
    const specA: CreateBusinessSpec = {
      family: "service",
      name: "A",
      marketId: "ma",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const specB: CreateBusinessSpec = {
      family: "service",
      name: "B",
      marketId: "mb",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const ownedA = createOwnedBusiness("a", specA);
    const ownedB = createOwnedBusiness("b", specB);
    const action = (businessId: string, offerId: string, price: number) => ({
      businessId,
      founderHoursAllocated: 150,
      founderProspectionHoursAllocated: 0,
      offerActions: offerAction(offerId, price),
      decisions: { family: "service" as const },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    });
    const resultA = resolveBusinessMonth(ownedA, action("a", "oa", 30), 1, 50, createRng(1), DATE, bigMarket("service", "ma"));
    const resultB = resolveBusinessMonth(ownedB, action("b", "ob", 90), 1, 50, createRng(1), DATE, bigMarket("service", "mb"));
    expect(resultA.updated.business.offers[0]!.lastDemand).not.toEqual(resultB.updated.business.offers[0]!.lastDemand);
  });

  it("les 5 familles produisent un lastDemand cohérent une fois une offre lancée", () => {
    const families: Array<{ readonly spec: CreateBusinessSpec; readonly price: number }> = [
      { spec: { family: "service", name: "S", marketId: "m", costPerLaborHour: 8, averageMonthlySalary: 2_000, creditLineLimit: 50_000, creditLineInterestRateAnnual: 0.08 }, price: 45 },
      { spec: { family: "hospitality", name: "H", marketId: "m", foodCostPerCover: 9, averageMonthlySalary: 2_000, creditLineLimit: 50_000, creditLineInterestRateAnnual: 0.08 }, price: 26 },
      { spec: { family: "subscription", name: "U", marketId: "m", arpu: 29, churnRateBase: 0.04, cogsRatio: 0.2, initialActiveSubscribers: 500, averageMonthlySalary: 3_000, creditLineLimit: 50_000, creditLineInterestRateAnnual: 0.08 }, price: 29 },
      { spec: { family: "retail", name: "R", marketId: "m", unitCostOfGoods: 6, averageMonthlySalary: 1_800, creditLineLimit: 50_000, creditLineInterestRateAnnual: 0.08 }, price: 15 },
      { spec: { family: "agency", name: "AG", marketId: "m", averageMonthlyFeePerMandate: 6_000, deliveryCostRatio: 0.2, averageMonthlySalary: 3_500, creditLineLimit: 50_000, creditLineInterestRateAnnual: 0.08 }, price: 6_000 },
    ];

    for (const { spec, price } of families) {
      const owned = createOwnedBusiness("biz", spec);
      const decisions = spec.family === "retail" ? { family: "retail" as const, stockUnits: 5_000 } : { family: spec.family };
      const result = resolveBusinessMonth(
        owned,
        {
          businessId: "biz",
          founderHoursAllocated: 150,
          founderProspectionHoursAllocated: 20,
          offerActions: offerAction("offer", price),
          decisions,
          marketingBudget: 0,
          rentBudget: 0,
          adminBudget: 0,
          headcountCapacity: Number.POSITIVE_INFINITY,
          storageCapacity: Number.POSITIVE_INFINITY,
        },
        1,
        50,
        createRng(1),
        DATE,
        bigMarket(spec.family, "m"),
      );
      const offer = result.updated.business.offers[0]!;
      expect(offer.lastDemand, `famille ${spec.family}`).not.toBeNull();
      const funnel = offer.lastDemand!;
      expect(funnel.availableMarket).toBeGreaterThanOrEqual(funnel.reached);
      expect(funnel.reached).toBeGreaterThanOrEqual(funnel.interested);
      expect(Number.isFinite(funnel.demand)).toBe(true);
      expect(funnel.sales).toBeGreaterThanOrEqual(0);
    }
  });

  it("Agency : le prix de l'offre pilote réellement le CA, pas la constante figée à la création", () => {
    const spec: CreateBusinessSpec = {
      family: "agency",
      name: "Conseil",
      marketId: "m",
      averageMonthlyFeePerMandate: 100, // valeur figée volontairement très différente du prix de l'offre
      deliveryCostRatio: 0.2,
      averageMonthlySalary: 3_500,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const owned = createOwnedBusiness("ag", spec);
    const result = resolveBusinessMonth(
      owned,
      {
        businessId: "ag",
        founderHoursAllocated: 150,
        founderProspectionHoursAllocated: 20,
        offerActions: offerAction("mandat", 6_000),
        decisions: { family: "agency" },
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
      1,
      50,
      createRng(1),
      DATE,
      bigMarket("agency", "m"),
    );
    const offer = result.updated.business.offers[0]!;
    if (offer.lastDemand!.sales > 0) {
      const impliedFeePerMandate = result.statement.revenue / offer.lastDemand!.sales;
      // Le CA implicite par mandat doit être proche du prix de l'offre (6000), pas de la
      // constante figée à la création (100) — preuve que le prix de l'offre pilote le CA.
      expect(impliedFeePerMandate).toBeGreaterThan(1_000);
    } else {
      expect(result.statement.revenue).toBe(0);
    }
  });

  it("Subscription : le prix de l'offre pilote l'ARPU du pool, capacité honnêtement infinie", () => {
    const spec: CreateBusinessSpec = {
      family: "subscription",
      name: "SaaS",
      marketId: "m",
      arpu: 5, // valeur figée volontairement très différente du prix de l'offre
      churnRateBase: 0.04,
      cogsRatio: 0.2,
      initialActiveSubscribers: 1_000,
      averageMonthlySalary: 3_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const owned = createOwnedBusiness("sub", spec);
    const result = resolveBusinessMonth(
      owned,
      {
        businessId: "sub",
        founderHoursAllocated: 150,
        founderProspectionHoursAllocated: 20,
        offerActions: offerAction("abo", 29),
        decisions: { family: "subscription" },
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
      },
      1,
      50,
      createRng(1),
      DATE,
      bigMarket("subscription", "m"),
    );
    // 1000 abonnés existants * 29 (prix de l'offre) — pas * 5 (arpu figé à la création).
    expect(result.statement.revenue).toBeCloseTo(1_000 * 29, 0);
    const offer = result.updated.business.offers[0]!;
    expect(offer.lastDemand!.capacity).toBe(Infinity);
    expect(offer.lastDemand!.lostToCapacity).toBe(0);
  });

  it("déterminisme : mêmes entrées -> même demande, même CA, sur plusieurs appels", () => {
    const spec: CreateBusinessSpec = {
      family: "service",
      name: "Svc",
      marketId: "m",
      costPerLaborHour: 8,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const action = {
      businessId: "svc",
      founderHoursAllocated: 150,
      founderProspectionHoursAllocated: 0,
      offerActions: offerAction("o1", 45),
      decisions: { family: "service" as const },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    };
    const a = resolveBusinessMonth(createOwnedBusiness("svc", spec), action, 1, 50, createRng(1), DATE, bigMarket("service", "m"));
    const b = resolveBusinessMonth(createOwnedBusiness("svc", spec), action, 1, 50, createRng(1), DATE, bigMarket("service", "m"));
    expect(a.statement.revenue).toBe(b.statement.revenue);
    expect(a.updated.business.offers[0]!.lastDemand).toEqual(b.updated.business.offers[0]!.lastDemand);
  });

  it("des prix d'offre différents produisent un CA proportionnellement différent (capacité constante et saturée)", () => {
    const spec: CreateBusinessSpec = {
      family: "service",
      name: "Svc",
      marketId: "m",
      costPerLaborHour: 0,
      averageMonthlySalary: 2_000,
      creditLineLimit: 50_000,
      creditLineInterestRateAnnual: 0.08,
    };
    const buildAction = (price: number) => ({
      businessId: "svc",
      founderHoursAllocated: 150, // capacité petite et fixe : la vente reste bornée par la capacité aux deux prix
      founderProspectionHoursAllocated: 0,
      offerActions: offerAction("o1", price),
      decisions: { family: "service" as const },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    });
    const market = bigMarket("service", "m");
    const cheap = resolveBusinessMonth(createOwnedBusiness("svc", spec), buildAction(40), 1, 50, createRng(7), DATE, market);
    const expensive = resolveBusinessMonth(createOwnedBusiness("svc", spec), buildAction(80), 1, 50, createRng(7), DATE, market);

    // Les deux restent capacity-bound (demande très supérieure à la capacité) : les heures
    // vendues sont donc identiques (même RNG, même capacité), et le CA suit exactement le prix.
    expect(cheap.updated.business.offers[0]!.lastDemand!.demand).toBeGreaterThan(cheap.updated.business.offers[0]!.lastDemand!.capacity);
    expect(expensive.updated.business.offers[0]!.lastDemand!.demand).toBeGreaterThan(expensive.updated.business.offers[0]!.lastDemand!.capacity);
    expect(expensive.statement.revenue).toBeCloseTo(cheap.statement.revenue * 2, 5);
  });
});
