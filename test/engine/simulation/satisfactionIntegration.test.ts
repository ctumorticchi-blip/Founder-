import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { addMonths } from "../../../src/engine/time/clock.js";
import { createOwnedBusiness, resolveBusinessMonth, type ResolvedBusinessMonth } from "../../../src/engine/simulation/businessResolution.js";
import type { GameDate } from "../../../src/engine/time/clock.js";
import type { BusinessAction, BusinessFamilyDecisions, CreateBusinessSpec, OwnedBusiness } from "../../../src/engine/simulation/types.js";
import type { Market } from "../../../src/types/market.js";
import type { Offer, OfferPositioning } from "../../../src/types/offer.js";
import {
  AGENCY_MARKET,
  HOSPITALITY_MARKET,
  RETAIL_MARKET,
  SERVICE_MARKET,
  SUBSCRIPTION_MARKET,
} from "../../../src/scenarios/markets.js";

/**
 * Tests transversaux M11.2.3 (spec §17, §22) : la satisfaction, la mémoire
 * client, la rétention, la réputation et le bouche-à-oreille comme ils
 * émergent réellement à travers `resolveBusinessMonth` sur plusieurs mois —
 * les formules elles-mêmes (attentes, expérience, satisfaction, rétention)
 * sont déjà couvertes unitairement dans `test/engine/customer/*.test.ts`.
 */

const DATE0: GameDate = { year: 2026, month: 1 };
const LEADERSHIP_SKILL = 50;
const SEED = 42;

function makeOffer(overrides: Partial<Offer> & Pick<Offer, "id" | "price" | "qualityLevel">): Offer {
  return {
    name: overrides.id,
    businessModel: "service-hours",
    positioning: "standard",
    targetSegment: "",
    status: "launched",
    maturity: 100,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: DATE0,
    launchedAt: DATE0,
    lastDemand: null,
    customerMemory: [],
    ...overrides,
  };
}

function withOffer(owned: OwnedBusiness, offer: Offer): OwnedBusiness {
  return { ...owned, business: { ...owned.business, offers: [offer] } };
}

/** Rejoue N mois consécutifs, en ré-injectant l'état résolu du mois précédent. Un seed d'entreprise (fork rng) fixe rend chaque mois déterministe. */
function runMonths(
  owned: OwnedBusiness,
  actionFor: (monthIndex: number) => BusinessAction,
  months: number,
  demandShare: number,
  market: Market,
): { readonly history: readonly ResolvedBusinessMonth[]; readonly final: OwnedBusiness } {
  let current = owned;
  const history: ResolvedBusinessMonth[] = [];
  for (let i = 0; i < months; i++) {
    const result = resolveBusinessMonth(
      current,
      actionFor(i),
      demandShare,
      LEADERSHIP_SKILL,
      createRng(SEED),
      addMonths(DATE0, i),
      market,
    );
    history.push(result);
    current = result.updated;
  }
  return { history, final: current };
}

function serviceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return {
    businessId: "biz",
    founderHoursAllocated: 150,
    founderProspectionHoursAllocated: 0,
    decisions: { family: "service" },
    marketingBudget: 0,
    rentBudget: 0,
    adminBudget: 0,
    headcountCapacity: Number.POSITIVE_INFINITY,
    storageCapacity: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

const SERVICE_SPEC: CreateBusinessSpec = {
  family: "service",
  name: "Test Service",
  marketId: SERVICE_MARKET.id,
  costPerLaborHour: 8,
  averageMonthlySalary: 2_000,
  creditLineLimit: 200_000,
  creditLineInterestRateAnnual: 0.08,
};

function familyState(owned: OwnedBusiness): OwnedBusiness["familyState"] {
  return owned.familyState;
}

describe("Boucle intermensuelle obligatoire — divergence de trajectoire (spec M11.2.3 §11, §22)", () => {
  it(
    "deux entreprises identiques au départ, acquisition initiale comparable, expérience délivrée différente -> " +
      "elles divergent (réputation, mémoire client, revenu) dans les mois suivants",
    () => {
      // Prix aligné sur le segment "professionnels locaux" (référence 45,
      // attente qualité 55). Les deux entreprises démarrent avec EXACTEMENT
      // la même qualité au mois 1 (le `qualityFit` du M11.2.2 influence déjà
      // la demande captée — spec `computeSegmentFit` — donc une qualité
      // différente dès le départ biaiserait l'acquisition initiale elle-même,
      // pas seulement l'expérience). L'expérience ne diverge qu'À PARTIR du
      // mois 2, moment où l'une investit dans son offre et l'autre la laisse
      // se dégrader — exactement le scénario du §22 : "acquisition initiale
      // comparable, expérience délivrée différente".
      const price = 45;
      const positioning: OfferPositioning = "standard";
      const sharedInitialOffer = makeOffer({ id: "offer", price, qualityLevel: 55, positioning });
      const action = serviceAction({ targetHeadcount: 6 });
      const demandShare = 0.05;

      // Même id d'entreprise/offre pour les deux runs (jamais dans le même
      // GameState en même temps) : le fork RNG (`business:${id}:...`) produit
      // exactement le même bruit économique des deux côtés, isolant la
      // qualité comme SEUL facteur de divergence à partir du mois 2.
      const sharedOwned = withOffer(createOwnedBusiness("biz", SERVICE_SPEC), sharedInitialOffer);
      const month1Excellent = resolveBusinessMonth(sharedOwned, action, demandShare, LEADERSHIP_SKILL, createRng(SEED), DATE0, SERVICE_MARKET);
      const month1Mediocre = resolveBusinessMonth(sharedOwned, action, demandShare, LEADERSHIP_SKILL, createRng(SEED), DATE0, SERVICE_MARKET);

      // Acquisition initiale comparable (spec §22) : mêmes entrées -> même
      // demande captée, mêmes ventes, même revenu le mois 1.
      expect(month1Excellent.statement.revenue).toBeCloseTo(month1Mediocre.statement.revenue, 6);
      expect(month1Excellent.updated.business.offers[0]!.lastDemand!.sales).toBeCloseTo(
        month1Mediocre.updated.business.offers[0]!.lastDemand!.sales,
        6,
      );

      // À partir du mois 2 : l'une soigne son offre (qualité excellente), l'autre la laisse se dégrader.
      const excellentAfterMonth1: OwnedBusiness = {
        ...month1Excellent.updated,
        business: { ...month1Excellent.updated.business, offers: [{ ...month1Excellent.updated.business.offers[0]!, qualityLevel: 95 }] },
      };
      const mediocreAfterMonth1: OwnedBusiness = {
        ...month1Mediocre.updated,
        business: { ...month1Mediocre.updated.business, offers: [{ ...month1Mediocre.updated.business.offers[0]!, qualityLevel: 15 }] },
      };

      const excellentRest = runMonths(excellentAfterMonth1, () => action, 11, demandShare, SERVICE_MARKET);
      const mediocreRest = runMonths(mediocreAfterMonth1, () => action, 11, demandShare, SERVICE_MARKET);
      const excellentHistory = [month1Excellent, ...excellentRest.history];
      const mediocreHistory = [month1Mediocre, ...mediocreRest.history];

      const excellentState = familyState(excellentRest.final);
      const mediocreState = familyState(mediocreRest.final);
      if (excellentState.family !== "service" || mediocreState.family !== "service") {
        throw new Error("familyState devrait rester 'service'");
      }

      // Réputation : l'excellente expérience fait progresser la réputation,
      // la médiocre la fait reculer -> net écart après 12 mois.
      expect(excellentState.reputationScore).toBeGreaterThan(mediocreState.reputationScore);

      const excellentMemory = excellentRest.final.business.offers[0]!.customerMemory[0]!;
      const mediocreMemory = mediocreRest.final.business.offers[0]!.customerMemory[0]!;

      // Mémoire client : la base retenue et la satisfaction lissée divergent nettement.
      expect(excellentMemory.smoothedSatisfactionScore).toBeGreaterThan(mediocreMemory.smoothedSatisfactionScore);
      expect(excellentMemory.retainedBaseVolume).toBeGreaterThan(mediocreMemory.retainedBaseVolume);

      // Revenu : le dernier mois, l'entreprise à l'expérience excellente
      // génère plus de chiffre d'affaires (réputation + bouche-à-oreille
      // ayant fait grossir sa demande captée, quand l'autre a stagné/reculé).
      const excellentLastRevenue = excellentHistory[excellentHistory.length - 1]!.statement.revenue;
      const mediocreLastRevenue = mediocreHistory[mediocreHistory.length - 1]!.statement.revenue;
      expect(excellentLastRevenue).toBeGreaterThan(mediocreLastRevenue);

      // La trajectoire diverge progressivement à partir du mois où l'expérience
      // change (mois 2, index 1), jamais un écart négatif ensuite.
      for (let i = 1; i < excellentHistory.length; i++) {
        const gap = excellentHistory[i]!.statement.revenue - mediocreHistory[i]!.statement.revenue;
        expect(gap).toBeGreaterThanOrEqual(-1e-6);
      }
    },
  );

  it("est déterministe : rejouer la même trajectoire produit exactement le même état final", () => {
    const offer = makeOffer({ id: "offer", price: 45, qualityLevel: 80 });
    const action = serviceAction({ targetHeadcount: 4 });

    const run = () => runMonths(withOffer(createOwnedBusiness("biz", SERVICE_SPEC), offer), () => action, 10, 0.05, SERVICE_MARKET).final;

    expect(run()).toEqual(run());
  });
});

describe("Mémoire client persistante (spec M11.2.3 §6)", () => {
  it("plusieurs offres de la même entreprise gardent des mémoires clients séparées", () => {
    const excellent = makeOffer({ id: "offer-a", price: 45, qualityLevel: 95 });
    const mediocre = makeOffer({ id: "offer-b", price: 45, qualityLevel: 15 });
    const owned = { ...createOwnedBusiness("biz", SERVICE_SPEC), business: { ...createOwnedBusiness("biz", SERVICE_SPEC).business, offers: [excellent, mediocre] } };

    const action = serviceAction({ targetHeadcount: 8 });
    const { final } = runMonths(owned, () => action, 6, 0.05, SERVICE_MARKET);

    const offerA = final.business.offers.find((o) => o.id === "offer-a")!;
    const offerB = final.business.offers.find((o) => o.id === "offer-b")!;

    expect(offerA.customerMemory.length).toBeGreaterThan(0);
    expect(offerB.customerMemory.length).toBeGreaterThan(0);
    // Une offre excellente ne doit jamais masquer une offre catastrophique (spec §14).
    expect(offerA.customerMemory[0]!.smoothedSatisfactionScore).toBeGreaterThan(offerB.customerMemory[0]!.smoothedSatisfactionScore);
  });

  it("plusieurs entreprises restent totalement indépendantes (aucune fuite de mémoire/réputation)", () => {
    const offerX = makeOffer({ id: "offer", price: 45, qualityLevel: 95 });
    const offerY = makeOffer({ id: "offer", price: 45, qualityLevel: 15 });
    const ownedX = withOffer(createOwnedBusiness("biz-x", SERVICE_SPEC), offerX);
    const ownedY = withOffer(createOwnedBusiness("biz-y", SERVICE_SPEC), offerY);

    const action = (id: string) => serviceAction({ businessId: id, targetHeadcount: 6 });
    const runX = runMonths(ownedX, () => action("biz-x"), 6, 0.05, SERVICE_MARKET);
    const runY = runMonths(ownedY, () => action("biz-y"), 6, 0.05, SERVICE_MARKET);

    const stateX = familyState(runX.final);
    const stateY = familyState(runY.final);
    if (stateX.family !== "service" || stateY.family !== "service") throw new Error("familyState devrait rester 'service'");
    expect(stateX.reputationScore).not.toBe(stateY.reputationScore);
    expect(stateX.reputationScore).toBeGreaterThan(stateY.reputationScore);
  });

  it("mémoire jamais initialisée avant la première vente réelle", () => {
    const offer = makeOffer({ id: "offer", price: 45, qualityLevel: 80, status: "launched" });
    const owned = withOffer(createOwnedBusiness("biz", SERVICE_SPEC), offer);
    expect(owned.business.offers[0]!.customerMemory).toEqual([]);
  });
});

describe("Rétention et churn — inertie et récupération (spec M11.2.3 §8)", () => {
  it("un mauvais mois isolé après une bonne histoire ne détruit pas la relation client", () => {
    const offer = makeOffer({ id: "offer", price: 45, qualityLevel: 95 });
    const goodAction = serviceAction({ targetHeadcount: 8 });
    const badMonthAction = serviceAction({ targetHeadcount: 8 });

    // 8 bons mois construisent une base retenue solide.
    const { final: afterGoodMonths } = runMonths(withOffer(createOwnedBusiness("biz", SERVICE_SPEC), offer), () => goodAction, 8, 0.05, SERVICE_MARKET);
    const retainedBeforeBadMonth = afterGoodMonths.business.offers[0]!.customerMemory[0]!.retainedBaseVolume;

    // Un seul mois catastrophique (qualité effondrée ce mois-ci uniquement).
    const badOffer = { ...afterGoodMonths.business.offers[0]!, qualityLevel: 5 };
    const afterBadMonth = resolveBusinessMonth(
      withOffer(afterGoodMonths, badOffer),
      badMonthAction,
      0.05,
      LEADERSHIP_SKILL,
      createRng(SEED),
      addMonths(DATE0, 8),
      SERVICE_MARKET,
    ).updated;
    const retainedAfterBadMonth = afterBadMonth.business.offers[0]!.customerMemory[0]!.retainedBaseVolume;

    expect(retainedAfterBadMonth).toBeLessThan(retainedBeforeBadMonth);
    // Réduit, jamais annulé par un seul mois (inertie, spec §8).
    expect(retainedAfterBadMonth).toBeGreaterThan(retainedBeforeBadMonth * 0.5);
  });

  it("plusieurs mauvais mois consécutifs ont, eux, un impact bien plus marqué qu'un seul", () => {
    const goodOffer = makeOffer({ id: "offer", price: 45, qualityLevel: 95 });
    const action = serviceAction({ targetHeadcount: 8 });
    const { final: afterGoodMonths } = runMonths(withOffer(createOwnedBusiness("biz", SERVICE_SPEC), goodOffer), () => action, 8, 0.05, SERVICE_MARKET);
    const retainedBeforeDecline = afterGoodMonths.business.offers[0]!.customerMemory[0]!.retainedBaseVolume;
    const badOffer = { ...afterGoodMonths.business.offers[0]!, qualityLevel: 5 };

    const afterOneBadMonth = resolveBusinessMonth(
      withOffer(afterGoodMonths, badOffer),
      action,
      0.05,
      LEADERSHIP_SKILL,
      createRng(SEED),
      addMonths(DATE0, 8),
      SERVICE_MARKET,
    ).updated;
    const { final: afterSixBadMonths } = runMonths(withOffer(afterGoodMonths, badOffer), () => action, 6, 0.05, SERVICE_MARKET);
    // Note : `runMonths` réinjecte `final.business.offers` tel quel après chaque
    // mois (dont un `qualityLevel` déjà dégradé), la dégradation persiste donc
    // sur toute la boucle des 6 mois.

    const oneMonthDecline = retainedBeforeDecline - afterOneBadMonth.business.offers[0]!.customerMemory[0]!.retainedBaseVolume;
    const sixMonthsDecline = retainedBeforeDecline - afterSixBadMonths.business.offers[0]!.customerMemory[0]!.retainedBaseVolume;

    expect(sixMonthsDecline).toBeGreaterThan(oneMonthDecline * 2);
  });

  it("récupération progressive après amélioration, jamais instantanée", () => {
    const badOffer = makeOffer({ id: "offer", price: 45, qualityLevel: 10 });
    const action = serviceAction({ targetHeadcount: 8 });
    const { final: afterBadMonths } = runMonths(withOffer(createOwnedBusiness("biz", SERVICE_SPEC), badOffer), () => action, 6, 0.05, SERVICE_MARKET);
    const satisfactionAtLow = afterBadMonths.business.offers[0]!.customerMemory[0]!.smoothedSatisfactionScore;

    const improvedOffer = { ...afterBadMonths.business.offers[0]!, qualityLevel: 95 };
    const oneGoodMonth = resolveBusinessMonth(
      withOffer(afterBadMonths, improvedOffer),
      action,
      0.05,
      LEADERSHIP_SKILL,
      createRng(SEED),
      addMonths(DATE0, 6),
      SERVICE_MARKET,
    ).updated;
    const satisfactionAfterOneGoodMonth = oneGoodMonth.business.offers[0]!.customerMemory[0]!.smoothedSatisfactionScore;

    // Progrès réel, mais pas de réparation immédiate à un niveau excellent.
    expect(satisfactionAfterOneGoodMonth).toBeGreaterThan(satisfactionAtLow);
    expect(satisfactionAfterOneGoodMonth).toBeLessThan(80);
  });
});

describe("Croissance trop rapide (spec M11.2.3 §12)", () => {
  it("une capacité largement dépassée par la demande dégrade l'expérience délivrée sans annuler les ventes déjà comptées en 'lostToCapacity'", () => {
    // Offre d'excellente qualité intrinsèque, mais capacité fondateur seul
    // (aucun effectif) très inférieure à la demande captée sur ce marché.
    const offer = makeOffer({ id: "offer", price: 30, qualityLevel: 95 });
    const owned = withOffer(createOwnedBusiness("biz", SERVICE_SPEC), offer);
    const saturatedAction = serviceAction({ targetHeadcount: 0, founderHoursAllocated: 20 });

    const result = resolveBusinessMonth(owned, saturatedAction, 1, LEADERSHIP_SKILL, createRng(SEED), DATE0, SERVICE_MARKET);
    const memory = result.updated.business.offers[0]!.customerMemory[0];
    const demand = result.updated.business.offers[0]!.lastDemand!;

    expect(demand.lostToCapacity).toBeGreaterThan(0);
    expect(memory).toBeDefined();
    // Servis dans de mauvaises conditions -> satisfaction pénalisée malgré la qualité intrinsèque élevée.
    expect(memory!.lastSatisfactionScore!).toBeLessThan(95);
    expect(memory!.lastDiagnosis!.operationsUnderStrain).toBe(true);
  });
});

describe("Bouche-à-oreille (spec M11.2.3 §10)", () => {
  it("une entreprise neuve ne bénéficie d'aucun bouche-à-oreille dès le premier mois (aucune mémoire encore)", () => {
    const offer = makeOffer({ id: "offer", price: 45, qualityLevel: 90 });
    const owned = withOffer(createOwnedBusiness("biz", SERVICE_SPEC), offer);
    const result = resolveBusinessMonth(owned, serviceAction({ targetHeadcount: 6 }), 0.05, LEADERSHIP_SKILL, createRng(SEED), DATE0, SERVICE_MARKET);
    // Le premier mois n'a par construction aucune mémoire préalable -> wom = 0,
    // donc la visibilité n'a pas encore reçu de bonus organique.
    expect(result.updated.business.offers[0]!.lastDemand!.visibilityLevel).not.toBe("high");
  });

  it("plusieurs mois d'excellente expérience font progressivement grossir la demande captée au-delà de l'effet réputation seul", () => {
    const offer = makeOffer({ id: "offer", price: 45, qualityLevel: 95 });
    const action = serviceAction({ targetHeadcount: 8 });
    const { history } = runMonths(withOffer(createOwnedBusiness("biz", SERVICE_SPEC), offer), () => action, 10, 0.05, SERVICE_MARKET);

    const earlyDemand = history[1]!.updated.business.offers[0]!.lastDemand!.demand;
    const lateDemand = history[history.length - 1]!.updated.business.offers[0]!.lastDemand!.demand;
    expect(lateDemand).toBeGreaterThan(earlyDemand);
  });
});

describe("Subscription — satisfaction et churn (spec M11.2.3 §13)", () => {
  const SUBSCRIPTION_SPEC: CreateBusinessSpec = {
    family: "subscription",
    name: "Test Subscription",
    marketId: SUBSCRIPTION_MARKET.id,
    arpu: 29,
    churnRateBase: 0.04,
    cogsRatio: 0.2,
    initialActiveSubscribers: 3_000,
    averageMonthlySalary: 3_000,
    creditLineLimit: 200_000,
    creditLineInterestRateAnnual: 0.08,
  };

  function subscriptionAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
    return {
      businessId: "biz",
      founderHoursAllocated: 100,
      founderProspectionHoursAllocated: 0,
      decisions: { family: "subscription" },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
      targetHeadcount: 6, // effectif support adéquat pour isoler l'effet satisfaction du sous-effectif.
      ...overrides,
    };
  }

  it("une satisfaction basse (offre médiocre) réduit davantage les abonnés en fin de mois qu'une satisfaction haute, à effectif support égal", () => {
    const goodOffer = makeOffer({ id: "offer", price: 29, qualityLevel: 95 });
    const badOffer = makeOffer({ id: "offer", price: 29, qualityLevel: 10 });

    const good = runMonths(withOffer(createOwnedBusiness("biz", SUBSCRIPTION_SPEC), goodOffer), () => subscriptionAction(), 6, 0.05, SUBSCRIPTION_MARKET);
    const bad = runMonths(withOffer(createOwnedBusiness("biz", SUBSCRIPTION_SPEC), badOffer), () => subscriptionAction(), 6, 0.05, SUBSCRIPTION_MARKET);

    const goodState = familyState(good.final);
    const badState = familyState(bad.final);
    if (goodState.family !== "subscription" || badState.family !== "subscription") throw new Error("familyState devrait rester 'subscription'");

    expect(goodState.activeSubscribers).toBeGreaterThan(badState.activeSubscribers);
    expect(goodState.reputationScore).toBeGreaterThan(badState.reputationScore);
  });
});

describe("Les 5 familles économiques produisent toutes mémoire client + réputation pilotée par la satisfaction", () => {
  const cases: readonly {
    readonly family: "service" | "hospitality" | "retail" | "agency";
    readonly market: Market;
    readonly spec: CreateBusinessSpec;
    readonly price: number;
  }[] = [
    {
      family: "service",
      market: SERVICE_MARKET,
      price: 45,
      spec: { family: "service", name: "S", marketId: SERVICE_MARKET.id, costPerLaborHour: 8, averageMonthlySalary: 2_000, creditLineLimit: 200_000, creditLineInterestRateAnnual: 0.08 },
    },
    {
      family: "hospitality",
      market: HOSPITALITY_MARKET,
      price: 24,
      spec: { family: "hospitality", name: "H", marketId: HOSPITALITY_MARKET.id, foodCostPerCover: 6, averageMonthlySalary: 1_900, creditLineLimit: 200_000, creditLineInterestRateAnnual: 0.08 },
    },
    {
      family: "retail",
      market: RETAIL_MARKET,
      price: 15,
      spec: { family: "retail", name: "R", marketId: RETAIL_MARKET.id, unitCostOfGoods: 6, averageMonthlySalary: 1_800, creditLineLimit: 200_000, creditLineInterestRateAnnual: 0.08 },
    },
    {
      family: "agency",
      market: AGENCY_MARKET,
      price: 6_000,
      spec: { family: "agency", name: "A", marketId: AGENCY_MARKET.id, averageMonthlyFeePerMandate: 6_000, deliveryCostRatio: 0.2, averageMonthlySalary: 3_500, creditLineLimit: 200_000, creditLineInterestRateAnnual: 0.08 },
    },
  ];

  for (const { family, market, spec, price } of cases) {
    it(`${family} : la mémoire client se construit et la réputation évolue avec la satisfaction`, () => {
      const offer = makeOffer({ id: "offer", price, qualityLevel: 90 });
      const owned = withOffer(createOwnedBusiness("biz", spec), offer);
      const action: BusinessAction = {
        businessId: "biz",
        founderHoursAllocated: 150,
        founderProspectionHoursAllocated: 0,
        decisions: family === "retail" ? { family: "retail", stockUnits: 100_000 } : ({ family } as BusinessFamilyDecisions),
        marketingBudget: 0,
        rentBudget: 0,
        adminBudget: 0,
        headcountCapacity: Number.POSITIVE_INFINITY,
        storageCapacity: Number.POSITIVE_INFINITY,
        targetHeadcount: 10,
      };

      const { final } = runMonths(owned, () => action, 4, 0.05, market);
      const finalOffer = final.business.offers[0]!;
      expect(finalOffer.customerMemory.length).toBeGreaterThan(0);
      const state = final.familyState;
      expect(state.family).toBe(family);
      expect((state as { reputationScore: number }).reputationScore).toBeGreaterThan(0);
      expect((state as { reputationScore: number }).reputationScore).toBeLessThanOrEqual(1);
    });
  }
});
