import { describe, expect, it } from "vitest";
import { migrateSaveGame } from "../src/lib/storage";

const LEGACY_M10_SAVE = {
  version: 1,
  seed: 42,
  birthDate: { year: 2007, month: 1 },
  startDate: { year: 2025, month: 1 },
  gameState: {
    date: { year: 2025, month: 6 },
    macro: {},
    markets: {},
    competitions: {},
    character: { cash: 1000 },
    job: null,
    businesses: [
      {
        id: "service-abc123",
        business: { name: "service-abc123", families: ["service"], treasury: { cash: 0 } },
        workforce: { headcount: 0 },
        marketId: "market-1",
        familyState: { family: "service", reputationScore: 0.1, costPerLaborHour: 8 },
      },
    ],
    events: [],
    memory: [],
  },
  draft: {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 150, reseau: 0 },
    job: null,
    business: {
      businessId: "service-abc123",
      family: "service",
      isNew: false,
      createSpec: null,
      decisions: { family: "service", price: 40, targetHours: 100 },
      marketingBudget: 100,
      rentBudget: 400,
      adminBudget: 150,
      capex: 0,
      targetHeadcount: null,
      capitalInjection: 0,
    },
  },
  lastRecap: null,
};

describe("migrateSaveGame", () => {
  it("migre une sauvegarde M10 sans businessIdentities sans exception", () => {
    expect(() => migrateSaveGame(LEGACY_M10_SAVE)).not.toThrow();
  });

  it("synthétise une identité par défaut pour chaque entreprise sans entrée", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.businessIdentities["service-abc123"]).toBeDefined();
    expect(migrated.businessIdentities["service-abc123"]!.displayName.length).toBeGreaterThan(0);
    expect(migrated.businessIdentities["service-abc123"]!.displayName).not.toBe("service-abc123");
  });

  it("reconstruit un BusinessDraft valide (infrastructureId/adminOptionalIds/purchases) depuis l'ancienne forme", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    const business = migrated.draft.business;
    expect(business).not.toBeNull();
    expect(typeof business!.infrastructureId).toBe("string");
    expect(business!.infrastructureId.length).toBeGreaterThan(0);
    expect(business!.adminOptionalIds).toEqual([]);
    expect(business!.purchases).toEqual([]);
    // Les champs inchangés doivent être conservés tels quels.
    expect(business!.businessId).toBe("service-abc123");
    expect(business!.family).toBe("service");
    expect(business!.decisions).toEqual({ family: "service", price: 40, targetHours: 100 });
  });

  it("est idempotente : une sauvegarde déjà migrée traverse sans modification", () => {
    const migratedOnce = migrateSaveGame(LEGACY_M10_SAVE);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice).toEqual(migratedOnce);
  });

  it("ne modifie jamais gameState (source de vérité moteur)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.gameState).toEqual(LEGACY_M10_SAVE.gameState);
  });
});
