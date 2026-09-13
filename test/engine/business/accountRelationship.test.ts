import { describe, expect, it } from "vitest";
import {
  CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA,
  INITIAL_ACCOUNT_TRUST,
  TRUST_EWMA_ALPHA,
  computeAccountConcentration,
  computeAccountRelationshipUpdate,
} from "../../../src/engine/business/accountRelationship.js";
import { getMarketSegments } from "../../../src/engine/market/segments.js";
import type { Offer } from "../../../src/types/offer.js";
import type { AccountContract, AccountRelationshipState } from "../../../src/types/strategicAccount.js";

const DATE = { year: 2026, month: 6 };
const SEGMENT = getMarketSegments("agency").find((s) => s.id === "agency-grands-comptes")!;

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: "offer-1",
    name: "Mandat conseil",
    businessModel: "service-hours",
    positioning: "premium",
    targetSegment: "agency-grands-comptes",
    price: SEGMENT.referencePrice,
    status: "launched",
    maturity: 100,
    qualityLevel: 75,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: DATE,
    launchedAt: DATE,
    lastDemand: null,
    customerMemory: [],
    ...overrides,
  };
}

function makeContract(overrides: Partial<AccountContract> = {}): AccountContract {
  return {
    price: SEGMENT.referencePrice,
    volume: 40,
    qualityCommitment: 70,
    durationMonths: 6,
    monthsRemaining: 6,
    signedAt: DATE,
    lastMonthServedVolume: 40,
    lastMonthUnservedVolume: 0,
    ...overrides,
  };
}

describe("computeAccountRelationshipUpdate (spec M11.2.4.4 §9)", () => {
  it("un contrat sous-livré ce mois produit une satisfaction strictement inférieure à un contrat intégralement servi, toutes choses égales par ailleurs", () => {
    const fullyServed = computeAccountRelationshipUpdate({
      previous: null,
      contract: makeContract({ volume: 40, lastMonthServedVolume: 40, lastMonthUnservedVolume: 0 }),
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    const halfServed = computeAccountRelationshipUpdate({
      previous: null,
      contract: makeContract({ volume: 40, lastMonthServedVolume: 20, lastMonthUnservedVolume: 20 }),
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });

    expect(fullyServed.satisfaction.scoreThisMonth).not.toBeNull();
    expect(halfServed.satisfaction.scoreThisMonth).not.toBeNull();
    expect(halfServed.satisfaction.scoreThisMonth!).toBeLessThan(fullyServed.satisfaction.scoreThisMonth!);
  });

  it("previous: null -> smoothedScore initialisé au score du mois lui-même (pas de lissage vers une valeur neutre arbitraire)", () => {
    const result = computeAccountRelationshipUpdate({
      previous: null,
      contract: makeContract(),
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    expect(result.satisfaction.smoothedScore).toBe(result.satisfaction.scoreThisMonth);
  });

  it("previous: null -> trust part de INITIAL_ACCOUNT_TRUST puis dérive légèrement vers le signal du mois (jamais un saut immédiat)", () => {
    const result = computeAccountRelationshipUpdate({
      previous: null,
      contract: makeContract(),
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    expect(result.trust).not.toBe(INITIAL_ACCOUNT_TRUST);
    expect(Math.abs(result.trust - INITIAL_ACCOUNT_TRUST)).toBeLessThanOrEqual(TRUST_EWMA_ALPHA);
  });

  it("une sous-livraison isolée pèse peu sur la confiance ; des sous-livraisons répétées l'érodent nettement (vitesses différentes, critère de complétude)", () => {
    const badMonthContract = makeContract({ volume: 40, lastMonthServedVolume: 10, lastMonthUnservedVolume: 30 });
    const offer = makeOffer();

    let state: AccountRelationshipState | null = null;
    state = computeAccountRelationshipUpdate({
      previous: state,
      contract: badMonthContract,
      offer,
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    const trustAfterOneBadMonth = state.trust;

    for (let i = 0; i < 5; i++) {
      state = computeAccountRelationshipUpdate({
        previous: state,
        contract: badMonthContract,
        offer,
        segment: SEGMENT,
        genericOperationalPenalty: 0,
        reputationScore: 0.5,
        date: DATE,
      });
    }
    const trustAfterSixBadMonths = state.trust;

    // Un mois isolé s'écarte peu de la confiance neutre initiale ; l'érosion
    // après plusieurs mois consécutifs est nettement plus prononcée.
    const driftAfterOneMonth = Math.abs(trustAfterOneBadMonth - INITIAL_ACCOUNT_TRUST);
    const driftAfterSixMonths = Math.abs(trustAfterSixBadMonths - INITIAL_ACCOUNT_TRUST);
    expect(driftAfterSixMonths).toBeGreaterThan(driftAfterOneMonth * 2);
    expect(trustAfterSixBadMonths).toBeLessThan(trustAfterOneBadMonth);
  });

  it("breachFrustration s'accumule en EWMA depuis le taux de sous-livraison, jamais un saut brutal", () => {
    const contract = makeContract({ volume: 40, lastMonthServedVolume: 0, lastMonthUnservedVolume: 40 }); // déni total
    const result = computeAccountRelationshipUpdate({
      previous: null,
      contract,
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    expect(result.breachFrustration).toBeCloseTo(CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA, 6); // 0 * (1-a) + 1 * a
  });

  it("history s'allonge d'une entrée par appel, jamais réécrite (append-only)", () => {
    const offer = makeOffer();
    const contract = makeContract();
    const afterMonth1 = computeAccountRelationshipUpdate({
      previous: null,
      contract,
      offer,
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: { year: 2026, month: 6 },
    });
    expect(afterMonth1.history).toHaveLength(1);

    const afterMonth2 = computeAccountRelationshipUpdate({
      previous: afterMonth1,
      contract,
      offer,
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: { year: 2026, month: 7 },
    });
    expect(afterMonth2.history).toHaveLength(2);
    expect(afterMonth2.history[0]).toEqual(afterMonth1.history[0]);
  });

  it("contract.volume <= 0 (ne devrait jamais arriver) -> aucun signal, état précédent conservé tel quel", () => {
    const previous = computeAccountRelationshipUpdate({
      previous: null,
      contract: makeContract(),
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    const result = computeAccountRelationshipUpdate({
      previous,
      contract: makeContract({ volume: 0, lastMonthServedVolume: 0, lastMonthUnservedVolume: 0 }),
      offer: makeOffer(),
      segment: SEGMENT,
      genericOperationalPenalty: 0,
      reputationScore: 0.5,
      date: DATE,
    });
    expect(result).toEqual(previous);
  });
});

describe("computeAccountConcentration (spec M11.2.4 §10)", () => {
  it("calcule la part de CA attribuable au compte", () => {
    expect(computeAccountConcentration(24_000, 48_000)).toBe(0.5);
  });
  it("CA de l'entreprise nul -> 0, jamais une division par zéro", () => {
    expect(computeAccountConcentration(1_000, 0)).toBe(0);
  });
  it("jamais plafonnée : un compte peut représenter 100% ou plus du CA affiché", () => {
    expect(computeAccountConcentration(60_000, 48_000)).toBeCloseTo(1.25);
  });
});
