import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { createOwnedBusiness, resolveBusinessMonth, wordOfMouthReferenceVolume } from "../../../src/engine/simulation/businessResolution.js";
import type { BusinessAction, BusinessFamilyDecisions, CreateBusinessSpec, OwnedBusiness } from "../../../src/engine/simulation/types.js";
import type { Market } from "../../../src/types/market.js";
import type { Offer, OfferAction } from "../../../src/types/offer.js";
import type { SegmentCustomerMemory } from "../../../src/types/satisfaction.js";

const SERVICE_SPEC: CreateBusinessSpec = {
  family: "service",
  name: "Test Service",
  marketId: "market-1",
  costPerLaborHour: 8,
  averageMonthlySalary: 2_000,
  creditLineLimit: 100_000,
  creditLineInterestRateAnnual: 0.08,
};

const SUBSCRIPTION_SPEC: CreateBusinessSpec = {
  family: "subscription",
  name: "Test Subscription",
  marketId: "market-2",
  arpu: 29,
  churnRateBase: 0.04,
  cogsRatio: 0.2,
  initialActiveSubscribers: 2_000,
  averageMonthlySalary: 3_000,
  creditLineLimit: 100_000,
  creditLineInterestRateAnnual: 0.08,
};

const SERVICE_MARKET: Market = {
  id: "market-1",
  family: "service",
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

const SUBSCRIPTION_MARKET: Market = { ...SERVICE_MARKET, id: "market-2", family: "subscription" };

const LEADERSHIP_SKILL = 50;
const DEMAND_SHARE = 1; // isole l'effet de capacité/effectif de la variance de part de marché.
// Part de marché infime : isole l'effet de capacité/effectif en gardant la demande captée
// négligeable devant n'importe quelle capacité testée (remplace l'ancien "targetHours: 5").
const TINY_DEMAND_SHARE = 0.0005;
const DATE = { year: 2026, month: 1 };

/** Offre "service" lancée dès la création, prix/positionnement standard — génère une
 * demande largement capacity-bound sur `SERVICE_MARKET` (spec M11.2.2). */
function serviceOfferActions(): OfferAction[] {
  return [
    { kind: "create", spec: { id: "svc-offer", name: "Prestations", businessModel: "service-hours", positioning: "standard", targetSegment: "", price: 40 } },
    { kind: "launch", offerId: "svc-offer" },
  ];
}

function subscriptionOfferActions(): OfferAction[] {
  return [
    { kind: "create", spec: { id: "sub-offer", name: "Abonnement", businessModel: "service-hours", positioning: "standard", targetSegment: "", price: 29 } },
    { kind: "launch", offerId: "sub-offer" },
  ];
}

function serviceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return {
    businessId: "svc",
    founderHoursAllocated: 150,
    founderProspectionHoursAllocated: 0,
    offerActions: serviceOfferActions(),
    decisions: { family: "service" },
    marketingBudget: 0,
    rentBudget: 0,
    adminBudget: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

describe("createOwnedBusiness — identité (spec M11.1)", () => {
  it("le nom de l'entreprise créée est le nom commercial fourni, pas l'id technique", () => {
    const owned = createOwnedBusiness("service-abc123", SERVICE_SPEC);
    expect(owned.id).toBe("service-abc123");
    expect(owned.business.name).toBe("Test Service");
    expect(owned.business.name).not.toBe(owned.id);
  });
});

describe("resolveBusinessMonth — effet de capacité (recrutement)", () => {
  it("plus de salariés -> plus d'heures vendues -> plus de revenu (à demande capacity-bound)", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);

    const soloResult = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 0 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      SERVICE_MARKET,
    );
    const staffedResult = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 5 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      SERVICE_MARKET,
    );

    expect(staffedResult.statement.revenue).toBeGreaterThan(soloResult.statement.revenue);
  });

  it("un meilleur leadership du fondateur augmente la capacité apportée par le même effectif", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const action = serviceAction({ targetHeadcount: 5 });

    const lowLeadership = resolveBusinessMonth(owned, action, DEMAND_SHARE, 0, createRng(1), DATE, SERVICE_MARKET);
    const highLeadership = resolveBusinessMonth(owned, action, DEMAND_SHARE, 100, createRng(1), DATE, SERVICE_MARKET);

    expect(highLeadership.statement.revenue).toBeGreaterThanOrEqual(lowLeadership.statement.revenue);
  });
});

describe("resolveBusinessMonth — payroll dans le P&L et cash-flow", () => {
  it("le payroll du P&L est exactement effectif * salaire moyen", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const result = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 4 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      SERVICE_MARKET,
    );
    expect(result.statement.payroll).toBeCloseTo(4 * SERVICE_SPEC.averageMonthlySalary);
  });

  it("le coût réel d'une embauche (recrutement) est imputé au P&L le mois de l'embauche", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const withoutHire = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 0 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      SERVICE_MARKET,
    );
    const withHire = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 3 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      SERVICE_MARKET,
    );

    // 3 embauches * 1 mois de salaire de coût de recrutement, imputé en admin.
    expect(withHire.recruitmentCost).toBeCloseTo(3 * SERVICE_SPEC.averageMonthlySalary);
    expect(withHire.statement.admin - withoutHire.statement.admin).toBeCloseTo(3 * SERVICE_SPEC.averageMonthlySalary);
  });

  it("le licenciement facture un coût de séparation réel", () => {
    const owned = { ...createOwnedBusiness("svc", SERVICE_SPEC), workforce: { headcount: 5, averageMonthlySalary: SERVICE_SPEC.averageMonthlySalary } };
    const result = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 1 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      SERVICE_MARKET,
    );
    expect(result.fired).toBe(4);
    expect(result.severanceCost).toBeCloseTo(4 * SERVICE_SPEC.averageMonthlySalary);
  });
});

describe("resolveBusinessMonth — sur-effectif (masse salariale gaspillée sans revenu additionnel)", () => {
  it("un effectif excédentaire face à une demande limitée augmente le payroll sans augmenter le revenu", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    // Part de marché infime : la vente est bornée par la demande captée, pas par la capacité.
    const lowDemandAction = (headcount: number): BusinessAction => serviceAction({ targetHeadcount: headcount });

    const lean = resolveBusinessMonth(owned, lowDemandAction(0), TINY_DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);
    const overstaffed = resolveBusinessMonth(owned, lowDemandAction(20), TINY_DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);

    expect(overstaffed.statement.revenue).toBeCloseTo(lean.statement.revenue, 0);
    expect(overstaffed.statement.payroll).toBeGreaterThan(lean.statement.payroll);
    expect(overstaffed.statement.netIncome).toBeLessThan(lean.statement.netIncome);
  });
});

describe("resolveBusinessMonth — sous-effectif (Subscription : pénalité de churn)", () => {
  it("un effectif support insuffisant augmente le churn effectif et réduit les abonnés en fin de mois", () => {
    const owned = createOwnedBusiness("sub", SUBSCRIPTION_SPEC); // 2000 abonnés -> 4 ETP support requis
    const action: BusinessAction = {
      businessId: "sub",
      founderHoursAllocated: 100,
      founderProspectionHoursAllocated: 0,
      offerActions: subscriptionOfferActions(),
      decisions: { family: "subscription" },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    };

    const understaffed = resolveBusinessMonth(owned, { ...action, targetHeadcount: 0 }, DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SUBSCRIPTION_MARKET);
    const adequatelyStaffed = resolveBusinessMonth(owned, { ...action, targetHeadcount: 4 }, DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SUBSCRIPTION_MARKET);

    if (understaffed.updated.familyState.family !== "subscription" || adequatelyStaffed.updated.familyState.family !== "subscription") {
      throw new Error("familyState devrait rester 'subscription'");
    }
    expect(understaffed.updated.familyState.activeSubscribers).toBeLessThan(adequatelyStaffed.updated.familyState.activeSubscribers);
  });
});

describe("wordOfMouthReferenceVolume (spec M11.2.3 §9, §10, §15)", () => {
  it("renvoie une valeur fixe positive pour les familles à capacité finie", () => {
    expect(wordOfMouthReferenceVolume("service")).toBeGreaterThan(0);
    expect(wordOfMouthReferenceVolume("hospitality")).toBeGreaterThan(0);
    expect(wordOfMouthReferenceVolume("retail")).toBeGreaterThan(0);
    expect(wordOfMouthReferenceVolume("agency")).toBeGreaterThan(0);
  });

  it("subscription : suit la base d'abonnés actifs, jamais sous le plancher", () => {
    // Sous le plancher (5 comme 0 abonnés) : la valeur de référence reste au plancher, inchangée.
    expect(wordOfMouthReferenceVolume("subscription", 5)).toBe(wordOfMouthReferenceVolume("subscription", 0));
    // Au-delà du plancher, la référence suit réellement la base d'abonnés.
    expect(wordOfMouthReferenceVolume("subscription", 10_000)).toBeGreaterThan(wordOfMouthReferenceVolume("subscription", 5));
  });
});

describe("allocation new/repeat — capacité proportionnelle, aucune priorité cachée (spec M11.2.3.1 §3, §6)", () => {
  const SEGMENT_ID = "service-professionnels-locaux";

  function seededMemory(overrides: Partial<SegmentCustomerMemory> = {}): SegmentCustomerMemory {
    return {
      segmentId: SEGMENT_ID,
      segmentLabel: "Professionnels locaux",
      retainedBaseVolume: 300,
      newVolumeThisMonth: 0,
      retainedVolumeThisMonth: 0,
      cumulativeAcquiredVolume: 300,
      lastSatisfactionScore: 90,
      smoothedSatisfactionScore: 90,
      lastDiagnosis: null,
      consecutiveGoodMonths: 3,
      consecutiveBadMonths: 0,
      monthsSinceFirstSale: 6,
      repeatDemandThisMonth: 0,
      unservedRepeatDemandThisMonth: 0,
      availabilityFrustration: 0,
      ...overrides,
    };
  }

  function offerWithMemory(memory: readonly SegmentCustomerMemory[]): Offer {
    return {
      id: "svc-offer",
      name: "Prestations",
      businessModel: "service-hours",
      positioning: "standard",
      targetSegment: "",
      price: 40,
      status: "launched",
      maturity: 100,
      qualityLevel: 80,
      developmentHoursInvested: 0,
      developmentBudgetInvested: 0,
      createdAt: DATE,
      launchedAt: DATE,
      lastDemand: null,
      customerMemory: memory,
    };
  }

  function withOffer(owned: OwnedBusiness, offer: Offer): OwnedBusiness {
    return { ...owned, business: { ...owned.business, offers: [offer] } };
  }

  it("capacité largement suffisante : la demande récurrente calculée depuis la mémoire est bien positive et intégralement servie", () => {
    const owned = withOffer(createOwnedBusiness("svc", SERVICE_SPEC), offerWithMemory([seededMemory()]));
    const action = serviceAction({ offerActions: [], targetHeadcount: 20 }); // large capacité, demande de marché infime pour isoler le repeat.
    const result = resolveBusinessMonth(owned, action, TINY_DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);

    const memory = result.updated.business.offers[0]!.customerMemory.find((m) => m.segmentId === SEGMENT_ID)!;
    expect(memory.repeatDemandThisMonth).toBeGreaterThan(0);
    // Capacité largement suffisante -> quasiment toute la demande récurrente est servie.
    expect(memory.unservedRepeatDemandThisMonth).toBeLessThan(memory.repeatDemandThisMonth * 0.05);
    expect(memory.retainedVolumeThisMonth).toBeGreaterThan(0);
  });

  it("capacité insuffisante : l'allocation nouveaux/récurrents reste proportionnelle à la demande, sans priorité cachée", () => {
    const owned = withOffer(createOwnedBusiness("svc", SERVICE_SPEC), offerWithMemory([seededMemory({ retainedBaseVolume: 2_000, smoothedSatisfactionScore: 95 })]));
    // Forte demande de marché (part significative) + capacité minuscule : les deux
    // flux (nouveaux ET récurrents) se disputent une capacité largement insuffisante.
    const action = serviceAction({ offerActions: [], founderHoursAllocated: 5, targetHeadcount: 0 });
    const result = resolveBusinessMonth(owned, action, 1, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);

    const finalOffer = result.updated.business.offers[0]!;
    const memory = finalOffer.customerMemory.find((m) => m.segmentId === SEGMENT_ID)!;
    const lastDemand = finalOffer.lastDemand!;

    expect(lastDemand.lostToCapacity).toBeGreaterThan(0);
    expect(memory.unservedRepeatDemandThisMonth).toBeGreaterThan(0);

    // newSales + repeatSales, SOMMÉS SUR TOUS LES SEGMENTS (le marché "service" en
    // compte 4, un seul a une mémoire préalable) = ventes réelles totales de l'offre.
    const totalNewPlusRetained = finalOffer.customerMemory.reduce((sum, m) => sum + m.newVolumeThisMonth + m.retainedVolumeThisMonth, 0);
    expect(totalNewPlusRetained).toBeCloseTo(lastDemand.sales, 6);
  });

  it("un client récurrent servi est compté comme récurrent, jamais comme nouveau", () => {
    const owned = withOffer(createOwnedBusiness("svc", SERVICE_SPEC), offerWithMemory([seededMemory()]));
    const action = serviceAction({ offerActions: [], targetHeadcount: 20 });
    const result = resolveBusinessMonth(owned, action, TINY_DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);

    const memory = result.updated.business.offers[0]!.customerMemory.find((m) => m.segmentId === SEGMENT_ID)!;
    // Demande de marché infime (TINY_DEMAND_SHARE) : les ventes viennent quasi exclusivement du réachat.
    expect(memory.retainedVolumeThisMonth).toBeGreaterThan(memory.newVolumeThisMonth);
  });

  it("un client récurrent non servi (capacité insuffisante) n'est jamais compté comme un nouveau client", () => {
    const before = seededMemory({ retainedBaseVolume: 2_000, smoothedSatisfactionScore: 95 });
    const owned = withOffer(createOwnedBusiness("svc", SERVICE_SPEC), offerWithMemory([before]));
    const action = serviceAction({ offerActions: [], founderHoursAllocated: 5, targetHeadcount: 0 });
    const result = resolveBusinessMonth(owned, action, TINY_DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);

    const memory = result.updated.business.offers[0]!.customerMemory.find((m) => m.segmentId === SEGMENT_ID)!;
    expect(memory.unservedRepeatDemandThisMonth).toBeGreaterThan(0);
    // Demande de marché infime : le cumul de nouveaux clients ne doit quasiment pas bouger,
    // et surtout jamais être gonflé par les habitués refusés.
    expect(memory.cumulativeAcquiredVolume).toBeCloseTo(before.cumulativeAcquiredVolume, 1);
  });

  it("un client récurrent non servi n'est pas automatiquement considéré comme insatisfait", () => {
    // Capacité tout juste sous la demande totale (spec §4) : une part réelle mais
    // MODESTE de demande récurrente est refusée, sans faire exploser la pénalité
    // opérationnelle (`SATURATION_COMFORT_THRESHOLD`) qui dégraderait l'expérience
    // des clients SERVIS — ce qui isole bien "refusé" de "mal servi" (deux signaux
    // distincts, spec §4 ; calibré empiriquement pour ce fixture de mémoire).
    const owned = withOffer(createOwnedBusiness("svc", SERVICE_SPEC), offerWithMemory([seededMemory({ retainedBaseVolume: 1_000, smoothedSatisfactionScore: 95 })]));
    const action = serviceAction({ offerActions: [], founderHoursAllocated: 920, targetHeadcount: 0 });
    const result = resolveBusinessMonth(owned, action, TINY_DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET);

    const memory = result.updated.business.offers[0]!.customerMemory.find((m) => m.segmentId === SEGMENT_ID)!;
    expect(memory.unservedRepeatDemandThisMonth).toBeGreaterThan(0);
    // Les clients SERVIS restent globalement satisfaits : la satisfaction ne
    // s'effondre jamais uniquement à cause des clients refusés ailleurs.
    if (memory.lastSatisfactionScore !== null) {
      expect(memory.lastSatisfactionScore).toBeGreaterThan(60);
    }
  });
});

describe("Demand Execution Cleanup — conservation exacte demande captée -> ventes (spec M11.2.3.2 §15)", () => {
  const HOSPITALITY_SPEC: CreateBusinessSpec = {
    family: "hospitality",
    name: "Test Hospitality",
    marketId: "market-3",
    foodCostPerCover: 7,
    averageMonthlySalary: 2_000,
    creditLineLimit: 100_000,
    creditLineInterestRateAnnual: 0.08,
  };
  const HOSPITALITY_MARKET: Market = { ...SERVICE_MARKET, id: "market-3", family: "hospitality" };
  const RETAIL_SPEC: CreateBusinessSpec = {
    family: "retail",
    name: "Test Retail",
    marketId: "market-4",
    unitCostOfGoods: 6,
    averageMonthlySalary: 1_800,
    creditLineLimit: 100_000,
    creditLineInterestRateAnnual: 0.08,
  };
  const RETAIL_MARKET: Market = { ...SERVICE_MARKET, id: "market-4", family: "retail" };
  const AGENCY_SPEC: CreateBusinessSpec = {
    family: "agency",
    name: "Test Agency",
    marketId: "market-5",
    averageMonthlyFeePerMandate: 6_000,
    deliveryCostRatio: 0.2,
    averageMonthlySalary: 3_500,
    creditLineLimit: 100_000,
    creditLineInterestRateAnnual: 0.08,
  };
  const AGENCY_MARKET: Market = { ...SERVICE_MARKET, id: "market-5", family: "agency" };

  interface FamilyFixture {
    readonly label: string;
    readonly spec: CreateBusinessSpec;
    readonly market: Market;
    readonly segmentId: string;
    readonly segmentLabel: string;
    readonly decisions: BusinessFamilyDecisions;
    readonly price: number;
  }

  // `stockUnits` énorme pour Retail : isole la contrainte de main-d'œuvre
  // (pilotée par `founderHoursAllocated`, comme les 3 autres familles) —
  // la contrainte de stock elle-même est vérifiée séparément plus bas.
  const FAMILIES: readonly FamilyFixture[] = [
    { label: "Service", spec: SERVICE_SPEC, market: SERVICE_MARKET, segmentId: "service-professionnels-locaux", segmentLabel: "Professionnels locaux", decisions: { family: "service" }, price: 40 },
    { label: "Hospitality", spec: HOSPITALITY_SPEC, market: HOSPITALITY_MARKET, segmentId: "hospitality-habitues-quartier", segmentLabel: "Habitués du quartier", decisions: { family: "hospitality" }, price: 22 },
    { label: "Retail", spec: RETAIL_SPEC, market: RETAIL_MARKET, segmentId: "retail-clientele-quartier", segmentLabel: "Clientèle de quartier", decisions: { family: "retail", stockUnits: 1_000_000_000 }, price: 15 },
    { label: "Agency", spec: AGENCY_SPEC, market: AGENCY_MARKET, segmentId: "agency-pme-croissance", segmentLabel: "PME en croissance", decisions: { family: "agency" }, price: 4_000 },
  ];

  function seededMemoryFor(fixture: FamilyFixture, overrides: Partial<SegmentCustomerMemory> = {}): SegmentCustomerMemory {
    return {
      segmentId: fixture.segmentId,
      segmentLabel: fixture.segmentLabel,
      retainedBaseVolume: 1_000,
      newVolumeThisMonth: 0,
      retainedVolumeThisMonth: 0,
      cumulativeAcquiredVolume: 1_000,
      lastSatisfactionScore: 90,
      smoothedSatisfactionScore: 90,
      lastDiagnosis: null,
      consecutiveGoodMonths: 3,
      consecutiveBadMonths: 0,
      monthsSinceFirstSale: 6,
      repeatDemandThisMonth: 0,
      unservedRepeatDemandThisMonth: 0,
      availabilityFrustration: 0,
      ...overrides,
    };
  }

  function offerFor(fixture: FamilyFixture, memory: readonly SegmentCustomerMemory[]): Offer {
    return {
      id: "offer",
      name: "Offre",
      businessModel: "service-hours",
      positioning: "standard",
      targetSegment: "",
      price: fixture.price,
      status: "launched",
      maturity: 100,
      qualityLevel: 80,
      developmentHoursInvested: 0,
      developmentBudgetInvested: 0,
      createdAt: DATE,
      launchedAt: DATE,
      lastDemand: null,
      customerMemory: memory,
    };
  }

  function ownedWithOffer(fixture: FamilyFixture, memory: readonly SegmentCustomerMemory[]): OwnedBusiness {
    const owned = createOwnedBusiness("biz", fixture.spec);
    return { ...owned, business: { ...owned.business, offers: [offerFor(fixture, memory)] } };
  }

  function actionFor(fixture: FamilyFixture, founderHoursAllocated: number): BusinessAction {
    return {
      businessId: "biz",
      founderHoursAllocated,
      founderProspectionHoursAllocated: 0,
      offerActions: [],
      decisions: fixture.decisions,
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
      targetHeadcount: 0,
    };
  }

  const DEMAND_SHARE_FIXTURE = 0.02;

  function resolveWithCapacity(fixture: FamilyFixture, memory: readonly SegmentCustomerMemory[], founderHoursAllocated: number) {
    return resolveBusinessMonth(
      ownedWithOffer(fixture, memory),
      actionFor(fixture, founderHoursAllocated),
      DEMAND_SHARE_FIXTURE,
      LEADERSHIP_SKILL,
      createRng(1),
      DATE,
      fixture.market,
    );
  }

  for (const fixture of FAMILIES) {
    describe(fixture.label, () => {
      const memory = [seededMemoryFor(fixture)];

      it("capacité exacte == demande captée totale -> sales == demande, lostToCapacity == 0", () => {
        // Calibration : capacité énorme -> lostToCapacity ~ 0 ; lit `totalDemand`
        // et le coefficient (linéaire) capacité/heures pour cette famille.
        const probe = resolveWithCapacity(fixture, memory, 1_000_000);
        const probeDemand = probe.updated.business.offers[0]!.lastDemand!;
        expect(probeDemand.lostToCapacity).toBeCloseTo(0, 3);
        const totalDemand = probeDemand.demand;
        const coefficient = probeDemand.capacity / 1_000_000;

        const exact = resolveWithCapacity(fixture, memory, totalDemand / coefficient);
        const exactDemand = exact.updated.business.offers[0]!.lastDemand!;
        expect(exactDemand.sales).toBeCloseTo(totalDemand, 3);
        expect(exactDemand.lostToCapacity).toBeCloseTo(0, 3);
        // Conservation stricte, jamais de disparition silencieuse de demande.
        expect(exactDemand.sales + exactDemand.lostToCapacity).toBeCloseTo(totalDemand, 3);
      });

      it("capacité == 60% de la demande captée -> conservation exacte du split new/repeat (spec §12, §15)", () => {
        const probe = resolveWithCapacity(fixture, memory, 1_000_000);
        const probeOffer = probe.updated.business.offers[0]!;
        const totalDemand = probeOffer.lastDemand!.demand;
        const coefficient = probeOffer.lastDemand!.capacity / 1_000_000;
        const repeatDemand = probeOffer.customerMemory.reduce((sum, m) => sum + m.repeatDemandThisMonth, 0);
        const newDemand = totalDemand - repeatDemand;

        const partial = resolveWithCapacity(fixture, memory, (0.6 * totalDemand) / coefficient);
        const partialOffer = partial.updated.business.offers[0]!;
        const lastDemand = partialOffer.lastDemand!;
        expect(lastDemand.sales).toBeCloseTo(0.6 * totalDemand, 2);
        expect(lastDemand.lostToCapacity).toBeCloseTo(0.4 * totalDemand, 2);
        expect(lastDemand.sales + lastDemand.lostToCapacity).toBeCloseTo(totalDemand, 6);

        const servedNew = partialOffer.customerMemory.reduce((sum, m) => sum + m.newVolumeThisMonth, 0);
        const servedRepeat = partialOffer.customerMemory.reduce((sum, m) => sum + m.retainedVolumeThisMonth, 0);
        const unservedRepeat = partialOffer.customerMemory.reduce((sum, m) => sum + m.unservedRepeatDemandThisMonth, 0);
        const unservedNew = lastDemand.lostToCapacity - unservedRepeat;

        expect(servedNew + servedRepeat).toBeCloseTo(lastDemand.sales, 3);
        // Aucune priorité cachée : le ratio new/repeat SERVI == le ratio new/repeat DEMANDÉ.
        if (repeatDemand > 0) {
          expect(servedNew / servedRepeat).toBeCloseTo(newDemand / repeatDemand, 1);
          expect(unservedNew / unservedRepeat).toBeCloseTo(newDemand / repeatDemand, 1);
        }
      });

      it("non-double-comptage de la réputation : même demande captée/capacité, réputation de départ différente -> mêmes ventes exécutées (spec §8, §9)", () => {
        const probe = resolveWithCapacity(fixture, memory, 1_000_000);
        const totalDemand = probe.updated.business.offers[0]!.lastDemand!.demand;
        const coefficient = probe.updated.business.offers[0]!.lastDemand!.capacity / 1_000_000;
        const founderHoursForHalfCapacity = (0.5 * totalDemand) / coefficient;

        const ownedLowRep = ownedWithOffer(fixture, memory);
        const ownedHighRep = { ...ownedLowRep, familyState: { ...ownedLowRep.familyState, reputationScore: 0.95 } as typeof ownedLowRep.familyState };

        const low = resolveBusinessMonth(ownedLowRep, actionFor(fixture, founderHoursForHalfCapacity), DEMAND_SHARE_FIXTURE, LEADERSHIP_SKILL, createRng(1), DATE, fixture.market);
        const high = resolveBusinessMonth(ownedHighRep, actionFor(fixture, founderHoursForHalfCapacity), DEMAND_SHARE_FIXTURE, LEADERSHIP_SKILL, createRng(1), DATE, fixture.market);

        // La réputation influence encore `totalDemand` lui-même (via `computeOfferDemand`,
        // inchangé) : ce test compare directement les VENTES EXÉCUTÉES à demande/capacité
        // FIXÉES par construction (même `founderHoursAllocated`), pas la demande elle-même.
        expect(high.updated.business.offers[0]!.lastDemand!.sales).toBeCloseTo(low.updated.business.offers[0]!.lastDemand!.sales, 6);
      });
    });
  }

  describe("exemple numérique obligatoire (spec §12, §15) : newDemand≈80/repeatDemand≈20/capacity=50 -> newSales≈40/repeatSales≈10", () => {
    for (const label of ["Service", "Hospitality"] as const) {
      it(label, () => {
        const fixture = FAMILIES.find((f) => f.label === label)!;

        // Étape 1 — sans mémoire préalable (repeatDemand = 0) : lit `newDemand` pur.
        const purelyNew = resolveWithCapacity(fixture, [], 1_000_000);
        const newDemand = purelyNew.updated.business.offers[0]!.lastDemand!.demand;
        const coefficient = purelyNew.updated.business.offers[0]!.lastDemand!.capacity / 1_000_000;

        // Étape 2 — calibre `retainedBaseVolume` pour repeatDemand ≈ newDemand/4 (ratio 4:1 -> 80/20 sur 100).
        const repeatRateAt90 = 0.9; // computeRepeatRate(90) = clamp(90/100, 0.05, 0.95) = 0.9, frustration = 0.
        const targetRepeatDemand = newDemand / 4;
        const memory = [seededMemoryFor(fixture, { retainedBaseVolume: targetRepeatDemand / repeatRateAt90 })];

        const probe = resolveWithCapacity(fixture, memory, 1_000_000);
        const probeOffer = probe.updated.business.offers[0]!;
        const totalDemand = probeOffer.lastDemand!.demand;
        const repeatDemand = probeOffer.customerMemory.reduce((sum, m) => sum + m.repeatDemandThisMonth, 0);
        // Vérifie le ratio visé (tolérance large : `computeOfferDemand` a une légère
        // sensibilité résiduelle à la mémoire via le bouche-à-oreille organique).
        expect(repeatDemand / totalDemand).toBeCloseTo(0.2, 1);

        // Étape 3 — capacité fixée à 50% de la demande totale.
        const partial = resolveWithCapacity(fixture, memory, (0.5 * totalDemand) / coefficient);
        const partialOffer = partial.updated.business.offers[0]!;
        const lastDemand = partialOffer.lastDemand!;
        const servedNew = partialOffer.customerMemory.reduce((sum, m) => sum + m.newVolumeThisMonth, 0);
        const servedRepeat = partialOffer.customerMemory.reduce((sum, m) => sum + m.retainedVolumeThisMonth, 0);
        const unservedRepeat = partialOffer.customerMemory.reduce((sum, m) => sum + m.unservedRepeatDemandThisMonth, 0);
        const unservedNew = lastDemand.lostToCapacity - unservedRepeat;

        // ≈ 40/10/40/10 sur une base ≈ 100 (tolérance 15% relative, cohérente avec le "≈" de l'énoncé).
        expect(servedNew / totalDemand).toBeCloseTo(0.4, 1);
        expect(servedRepeat / totalDemand).toBeCloseTo(0.1, 1);
        expect(unservedNew / totalDemand).toBeCloseTo(0.4, 1);
        expect(unservedRepeat / totalDemand).toBeCloseTo(0.1, 1);
      });
    }
  });

  it("Retail : une vraie contrainte de stock reste appliquée normalement (pas supprimée par erreur avec conversionRate, spec §6, §8)", () => {
    const fixture = FAMILIES.find((f) => f.label === "Retail")!;
    const memory = [seededMemoryFor(fixture)];
    // Stock délibérément inférieur à la capacité main-d'œuvre ET à la demande totale.
    const constrainedFixture: FamilyFixture = { ...fixture, decisions: { family: "retail", stockUnits: 30 } };
    const result = resolveWithCapacity(constrainedFixture, memory, 1_000_000); // capacité main-d'œuvre énorme, mais stock = 30
    const lastDemand = result.updated.business.offers[0]!.lastDemand!;
    expect(lastDemand.capacity).toBe(30);
    expect(lastDemand.sales).toBe(30);
    expect(lastDemand.lostToCapacity).toBeCloseTo(lastDemand.demand - 30, 6);
  });

  it("ANTI-ANCIENNE-ARCHITECTURE (intégration) : demande captée == capacité -> ventes == demande EXACTEMENT pour les 4 familles transactionnelles (spec §16)", () => {
    for (const fixture of FAMILIES) {
      const memory = [seededMemoryFor(fixture)];
      const probe = resolveWithCapacity(fixture, memory, 1_000_000);
      const probeDemand = probe.updated.business.offers[0]!.lastDemand!;
      const totalDemand = probeDemand.demand;
      const coefficient = probeDemand.capacity / 1_000_000;

      const exact = resolveWithCapacity(fixture, memory, totalDemand / coefficient);
      const exactDemand = exact.updated.business.offers[0]!.lastDemand!;
      // Sous l'ancien moteur (utilizationRate/fillRate/conversionRate/winRate aléatoires),
      // `sales` était presque toujours strictement < `demand`, même à capacité suffisante.
      expect(exactDemand.sales, `${fixture.label} : sales devrait être ~= demand`).toBeCloseTo(totalDemand, 3);
    }
  });
});

describe("resolveBusinessMonth — rejette une famille de décisions incompatible", () => {
  it("lève une erreur si les décisions ne correspondent pas à la famille de l'entreprise", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const wrongAction: BusinessAction = {
      businessId: "svc",
      founderHoursAllocated: 100,
      founderProspectionHoursAllocated: 0,
      decisions: { family: "subscription" },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    };
    expect(() => resolveBusinessMonth(owned, wrongAction, DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1), DATE, SERVICE_MARKET)).toThrow(RangeError);
  });
});
