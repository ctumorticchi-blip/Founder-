import { describe, expect, it } from "vitest";
import {
  HOURS_PER_EMPLOYEE_PER_MONTH,
  adjustHeadcount,
  computePayrollCost,
  computeRequiredHeadcountForHours,
  computeStaffingRatio,
  computeWorkforceCapacityHours,
  createWorkforce,
} from "../../../src/engine/employees/employees.js";

describe("createWorkforce", () => {
  it("démarre sans salarié", () => {
    const workforce = createWorkforce(2_500);
    expect(workforce.headcount).toBe(0);
  });

  it("rejette un salaire négatif", () => {
    expect(() => createWorkforce(-1)).toThrow(RangeError);
  });
});

describe("adjustHeadcount", () => {
  it("recrute et facture un coût de recrutement réel (spec : coût réel d'une embauche)", () => {
    const workforce = createWorkforce(2_000);
    const result = adjustHeadcount(workforce, 3);
    expect(result.workforce.headcount).toBe(3);
    expect(result.hired).toBe(3);
    expect(result.fired).toBe(0);
    expect(result.recruitmentCost).toBeCloseTo(3 * 2_000);
    expect(result.severanceCost).toBe(0);
  });

  it("licencie et facture un coût de licenciement", () => {
    const workforce = { headcount: 5, averageMonthlySalary: 2_000 };
    const result = adjustHeadcount(workforce, 2);
    expect(result.workforce.headcount).toBe(2);
    expect(result.fired).toBe(3);
    expect(result.hired).toBe(0);
    expect(result.severanceCost).toBeCloseTo(3 * 2_000);
  });

  it("ne facture rien si l'effectif cible est inchangé", () => {
    const workforce = { headcount: 4, averageMonthlySalary: 2_000 };
    const result = adjustHeadcount(workforce, 4);
    expect(result.hired).toBe(0);
    expect(result.fired).toBe(0);
    expect(result.recruitmentCost).toBe(0);
    expect(result.severanceCost).toBe(0);
  });

  it("rejette un effectif cible négatif", () => {
    expect(() => adjustHeadcount(createWorkforce(2_000), -1)).toThrow(RangeError);
  });
});

describe("computePayrollCost", () => {
  it("est le produit effectif * salaire moyen", () => {
    expect(computePayrollCost({ headcount: 10, averageMonthlySalary: 2_500 })).toBe(25_000);
  });
});

describe("computeWorkforceCapacityHours / computeRequiredHeadcountForHours", () => {
  it("un effectif nul apporte 0 heure de capacité", () => {
    expect(computeWorkforceCapacityHours({ headcount: 0, averageMonthlySalary: 2_000 }, 50)).toBe(0);
  });

  it("un meilleur leadership augmente la capacité apportée par le même effectif", () => {
    const workforce = { headcount: 10, averageMonthlySalary: 2_000 };
    const low = computeWorkforceCapacityHours(workforce, 0);
    const high = computeWorkforceCapacityHours(workforce, 100);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeCloseTo(10 * HOURS_PER_EMPLOYEE_PER_MONTH);
  });

  it("computeRequiredHeadcountForHours est l'inverse de computeWorkforceCapacityHours", () => {
    const leadership = 60;
    const requiredHours = 1_000;
    const requiredHeadcount = computeRequiredHeadcountForHours(requiredHours, leadership);
    const capacity = computeWorkforceCapacityHours({ headcount: requiredHeadcount, averageMonthlySalary: 2_000 }, leadership);
    expect(capacity).toBeCloseTo(requiredHours);
  });

  it("rejette des heures requises négatives", () => {
    expect(() => computeRequiredHeadcountForHours(-1, 50)).toThrow(RangeError);
  });
});

describe("computeStaffingRatio", () => {
  it("détecte le sous-effectif (< 1)", () => {
    expect(computeStaffingRatio(5, 10)).toBeCloseTo(0.5);
  });

  it("détecte le sur-effectif (> 1)", () => {
    expect(computeStaffingRatio(15, 10)).toBeCloseTo(1.5);
  });

  it("retourne 1 quand aucun effectif n'est requis et qu'aucun n'est en poste", () => {
    expect(computeStaffingRatio(0, 0)).toBe(1);
  });
});
