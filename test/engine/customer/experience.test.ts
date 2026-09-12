import { describe, expect, it } from "vitest";
import { computeDeliveredExperience, computeOperationalPenalty } from "../../../src/engine/customer/experience.js";

describe("computeOperationalPenalty (spec M11.2.3 §4)", () => {
  it("aucune pénalité sous le seuil de confort", () => {
    expect(computeOperationalPenalty({ saturationRatio: 0 })).toBe(0);
    expect(computeOperationalPenalty({ saturationRatio: 0.5 })).toBe(0);
    expect(computeOperationalPenalty({ saturationRatio: 0.8 })).toBe(0);
  });

  it("une forte saturation produit une pénalité positive et croissante", () => {
    const low = computeOperationalPenalty({ saturationRatio: 1.0 });
    const high = computeOperationalPenalty({ saturationRatio: 3.0 });
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
  });

  it("la pénalité est toujours plafonnée", () => {
    const extreme = computeOperationalPenalty({ saturationRatio: 1_000 });
    expect(extreme).toBeLessThanOrEqual(40);
  });

  it("est déterministe", () => {
    expect(computeOperationalPenalty({ saturationRatio: 2 })).toBe(computeOperationalPenalty({ saturationRatio: 2 }));
  });
});

describe("computeDeliveredExperience (spec M11.2.3 §4)", () => {
  it("sans pénalité opérationnelle, l'expérience délivrée égale la qualité intrinsèque", () => {
    expect(computeDeliveredExperience(90, 0)).toBe(90);
  });

  it("une pénalité opérationnelle dégrade l'expérience sous la qualité intrinsèque", () => {
    const experience = computeDeliveredExperience(90, computeOperationalPenalty({ saturationRatio: 3 }));
    expect(experience).toBeLessThan(90);
  });

  it("une offre de qualité 90 fortement sous tension peut délivrer une expérience nettement dégradée", () => {
    const experience = computeDeliveredExperience(90, computeOperationalPenalty({ saturationRatio: 5 }));
    expect(experience).toBeLessThanOrEqual(60);
  });

  it("reste toujours borné [0,100]", () => {
    expect(computeDeliveredExperience(10, 100)).toBeGreaterThanOrEqual(0);
    expect(computeDeliveredExperience(150, 0)).toBeLessThanOrEqual(100);
  });

  it("est déterministe", () => {
    expect(computeDeliveredExperience(70, 10)).toBe(computeDeliveredExperience(70, 10));
  });
});
