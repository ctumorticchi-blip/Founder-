import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import {
  MIN_MONTHS_LISTED_BEFORE_OFFER,
  advanceSaleProcess,
  closeSale,
  resolveSaleDecision,
  startSaleProcess,
} from "../../../src/engine/business/sale.js";
import type { ValuationResult } from "../../../src/types/valuation.js";

const GOOD_VALUATION: ValuationResult = { low: 800_000, mid: 1_000_000, high: 1_200_000, factors: [] };
const WORTHLESS_VALUATION: ValuationResult = { low: 0, mid: 0, high: 0, factors: [] };

describe("startSaleProcess", () => {
  it("démarre en 'listed', sans offre, 0 mois écoulés", () => {
    const process = startSaleProcess();
    expect(process).toEqual({ status: "listed", monthsListed: 0, currentOffer: null });
  });
});

describe("advanceSaleProcess", () => {
  it("est déterministe : même seed -> même déroulé sur plusieurs mois", () => {
    function runMonths(seed: number, months: number) {
      let process = startSaleProcess();
      const rng = createRng(seed);
      for (let i = 0; i < months; i++) {
        process = advanceSaleProcess(process, GOOD_VALUATION, rng.fork(`sale:${i}`));
      }
      return process;
    }
    const a = runMonths(42, 10);
    const b = runMonths(42, 10);
    expect(a).toEqual(b);
  });

  it("aucune offre avant MIN_MONTHS_LISTED_BEFORE_OFFER", () => {
    const rng = createRng(1);
    let process = startSaleProcess();
    for (let i = 0; i < MIN_MONTHS_LISTED_BEFORE_OFFER; i++) {
      process = advanceSaleProcess(process, GOOD_VALUATION, rng.fork(`early:${i}`));
      expect(process.currentOffer).toBeNull();
    }
  });

  it("une société sans aucune valeur (valorisation nulle) ne reçoit jamais d'offre (invendable)", () => {
    let process = startSaleProcess();
    for (let i = 0; i < 24; i++) {
      const rng = createRng(1000 + i);
      process = advanceSaleProcess(process, WORTHLESS_VALUATION, rng);
      expect(process.currentOffer).toBeNull();
      expect(process.status).toBe("listed");
    }
  });

  it("une société de bonne valeur finit par recevoir une offre dans une fourchette raisonnable de mois", () => {
    let process = startSaleProcess();
    let gotOffer = false;
    for (let i = 0; i < 24 && !gotOffer; i++) {
      process = advanceSaleProcess(process, GOOD_VALUATION, createRng(7).fork(`m:${i}`));
      if (process.currentOffer) {
        gotOffer = true;
        expect(process.currentOffer.amount).toBeGreaterThanOrEqual(GOOD_VALUATION.low);
        expect(process.currentOffer.amount).toBeLessThanOrEqual(GOOD_VALUATION.high);
        expect(process.status).toBe("offer-pending");
      }
    }
    expect(gotOffer).toBe(true);
  });

  it("n'avance plus une fois le statut différent de 'listed'", () => {
    const offerPending = { status: "offer-pending" as const, monthsListed: 3, currentOffer: { amount: 900_000, buyerQuality: 0.8 } };
    const result = advanceSaleProcess(offerPending, GOOD_VALUATION, createRng(1));
    expect(result).toEqual(offerPending);
  });
});

describe("resolveSaleDecision", () => {
  const pending = { status: "offer-pending" as const, monthsListed: 2, currentOffer: { amount: 900_000, buyerQuality: 0.75 } };

  it("accept clôture le processus en conservant le montant de l'offre", () => {
    const result = resolveSaleDecision(pending, { action: "accept" });
    expect(result.status).toBe("closed");
    expect(result.currentOffer?.amount).toBe(900_000);
  });

  it("reject remet le processus en recherche, sans offre", () => {
    const result = resolveSaleDecision(pending, { action: "reject" });
    expect(result.status).toBe("listed");
    expect(result.currentOffer).toBeNull();
  });

  it("withdraw clôture définitivement sans transaction", () => {
    const result = resolveSaleDecision(pending, { action: "withdraw" });
    expect(result.status).toBe("withdrawn");
  });

  it("une contre-offre raisonnable est acceptée par l'acheteur", () => {
    const result = resolveSaleDecision(pending, { action: "counter", counterAmount: 950_000 });
    expect(result.status).toBe("closed");
    expect(result.currentOffer?.amount).toBe(950_000);
  });

  it("une contre-offre trop agressive fait échouer la négociation (retour en recherche)", () => {
    const result = resolveSaleDecision(pending, { action: "counter", counterAmount: 5_000_000 });
    expect(result.status).toBe("listed");
    expect(result.currentOffer).toBeNull();
  });

  it("accepter/refuser/contre-offrir sans offre en attente ne change rien", () => {
    const listed = startSaleProcess();
    expect(resolveSaleDecision(listed, { action: "accept" })).toEqual(listed);
    expect(resolveSaleDecision(listed, { action: "reject" })).toEqual(listed);
  });
});

describe("closeSale", () => {
  it("calcule le produit net = offre − dette − frais de transaction", () => {
    const closing = closeSale(1_000_000, 200_000);
    expect(closing.transactionCosts).toBeCloseTo(50_000, 6);
    expect(closing.debtRepaid).toBe(200_000);
    expect(closing.netProceeds).toBeCloseTo(750_000, 6);
  });

  it("le produit net ne devient jamais négatif, même si la dette dépasse le produit après frais", () => {
    const closing = closeSale(100_000, 500_000);
    expect(closing.netProceeds).toBeGreaterThanOrEqual(0);
    expect(closing.debtRepaid).toBeLessThanOrEqual(100_000);
  });

  it("sans dette, tout le produit net (moins les frais) revient au vendeur", () => {
    const closing = closeSale(200_000, 0);
    expect(closing.debtRepaid).toBe(0);
    expect(closing.netProceeds).toBeCloseTo(190_000, 6);
  });
});
