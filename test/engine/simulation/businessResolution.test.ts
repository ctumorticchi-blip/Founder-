import { describe, expect, it } from "vitest";
import { createRng } from "../../../src/engine/rng/rng.js";
import { createOwnedBusiness, resolveBusinessMonth } from "../../../src/engine/simulation/businessResolution.js";
import type { BusinessAction, CreateBusinessSpec } from "../../../src/engine/simulation/types.js";

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

const LEADERSHIP_SKILL = 50;
const DEMAND_SHARE = 1; // isole l'effet de capacité/effectif de la variance de part de marché.

function serviceAction(overrides: Partial<BusinessAction> = {}): BusinessAction {
  return {
    businessId: "svc",
    founderHoursAllocated: 150,
    founderProspectionHoursAllocated: 0,
    decisions: { family: "service", price: 40, targetHours: 100_000 }, // capacity-bound par défaut
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
    );
    const staffedResult = resolveBusinessMonth(
      owned,
      serviceAction({ targetHeadcount: 5 }),
      DEMAND_SHARE,
      LEADERSHIP_SKILL,
      createRng(1),
    );

    expect(staffedResult.statement.revenue).toBeGreaterThan(soloResult.statement.revenue);
  });

  it("un meilleur leadership du fondateur augmente la capacité apportée par le même effectif", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const action = serviceAction({ targetHeadcount: 5 });

    const lowLeadership = resolveBusinessMonth(owned, action, DEMAND_SHARE, 0, createRng(1));
    const highLeadership = resolveBusinessMonth(owned, action, DEMAND_SHARE, 100, createRng(1));

    expect(highLeadership.statement.revenue).toBeGreaterThanOrEqual(lowLeadership.statement.revenue);
  });
});

describe("resolveBusinessMonth — payroll dans le P&L et cash-flow", () => {
  it("le payroll du P&L est exactement effectif * salaire moyen", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const result = resolveBusinessMonth(owned, serviceAction({ targetHeadcount: 4 }), DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));
    expect(result.statement.payroll).toBeCloseTo(4 * SERVICE_SPEC.averageMonthlySalary);
  });

  it("le coût réel d'une embauche (recrutement) est imputé au P&L le mois de l'embauche", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const withoutHire = resolveBusinessMonth(owned, serviceAction({ targetHeadcount: 0 }), DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));
    const withHire = resolveBusinessMonth(owned, serviceAction({ targetHeadcount: 3 }), DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));

    // 3 embauches * 1 mois de salaire de coût de recrutement, imputé en admin.
    expect(withHire.recruitmentCost).toBeCloseTo(3 * SERVICE_SPEC.averageMonthlySalary);
    expect(withHire.statement.admin - withoutHire.statement.admin).toBeCloseTo(3 * SERVICE_SPEC.averageMonthlySalary);
  });

  it("le licenciement facture un coût de séparation réel", () => {
    const owned = { ...createOwnedBusiness("svc", SERVICE_SPEC), workforce: { headcount: 5, averageMonthlySalary: SERVICE_SPEC.averageMonthlySalary } };
    const result = resolveBusinessMonth(owned, serviceAction({ targetHeadcount: 1 }), DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));
    expect(result.fired).toBe(4);
    expect(result.severanceCost).toBeCloseTo(4 * SERVICE_SPEC.averageMonthlySalary);
  });
});

describe("resolveBusinessMonth — sur-effectif (masse salariale gaspillée sans revenu additionnel)", () => {
  it("un effectif excédentaire face à une demande limitée augmente le payroll sans augmenter le revenu", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    // targetHours très faible : la vente est bornée par la demande, pas par la capacité.
    const lowDemandAction = (headcount: number): BusinessAction =>
      serviceAction({ targetHeadcount: headcount, decisions: { family: "service", price: 40, targetHours: 5 } });

    const lean = resolveBusinessMonth(owned, lowDemandAction(0), DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));
    const overstaffed = resolveBusinessMonth(owned, lowDemandAction(20), DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));

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
      decisions: { family: "subscription", newSubscribers: 0 },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    };

    const understaffed = resolveBusinessMonth(owned, { ...action, targetHeadcount: 0 }, DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));
    const adequatelyStaffed = resolveBusinessMonth(owned, { ...action, targetHeadcount: 4 }, DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1));

    if (understaffed.updated.familyState.family !== "subscription" || adequatelyStaffed.updated.familyState.family !== "subscription") {
      throw new Error("familyState devrait rester 'subscription'");
    }
    expect(understaffed.updated.familyState.activeSubscribers).toBeLessThan(adequatelyStaffed.updated.familyState.activeSubscribers);
  });
});

describe("resolveBusinessMonth — rejette une famille de décisions incompatible", () => {
  it("lève une erreur si les décisions ne correspondent pas à la famille de l'entreprise", () => {
    const owned = createOwnedBusiness("svc", SERVICE_SPEC);
    const wrongAction: BusinessAction = {
      businessId: "svc",
      founderHoursAllocated: 100,
      founderProspectionHoursAllocated: 0,
      decisions: { family: "subscription", newSubscribers: 10 },
      marketingBudget: 0,
      rentBudget: 0,
      adminBudget: 0,
      headcountCapacity: Number.POSITIVE_INFINITY,
      storageCapacity: Number.POSITIVE_INFINITY,
    };
    expect(() => resolveBusinessMonth(owned, wrongAction, DEMAND_SHARE, LEADERSHIP_SKILL, createRng(1))).toThrow(RangeError);
  });
});
