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

  it("reconstruit un BusinessDraft valide (infrastructureId/adminOptionalIds/purchases) depuis l'ancienne forme, dans un portefeuille (spec M11.1.5 §5.1)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.draft.businesses).toHaveLength(1);
    const business = migrated.draft.businesses[0]!;
    expect(typeof business.infrastructureId).toBe("string");
    expect(business.infrastructureId.length).toBeGreaterThan(0);
    expect(business.adminOptionalIds).toEqual([]);
    expect(business.purchases).toEqual([]);
    // Nouveaux champs M11.1.5 : valeurs par défaut cohérentes, jamais undefined.
    expect(business.founderHoursAllocated).toBe(0);
    expect(business.prospectionHours).toBe(0);
    expect(business.committedInfrastructureId).toBe(business.infrastructureId);
    expect(business.propertyPurchase).toBeNull();
    expect(business.saleDecision).toBeNull();
    // Les champs inchangés doivent être conservés tels quels.
    expect(business.businessId).toBe("service-abc123");
    expect(business.family).toBe("service");
    expect(business.decisions).toEqual({ family: "service", price: 40, targetHours: 100 });
  });

  it("est idempotente : une sauvegarde déjà migrée traverse sans modification", () => {
    const migratedOnce = migrateSaveGame(LEGACY_M10_SAVE);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice).toEqual(migratedOnce);
  });

  it("ne modifie jamais les valeurs existantes de gameState, complète seulement les champs structurels manquants introduits par M11.1.5 (§9)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.gameState.date).toEqual(LEGACY_M10_SAVE.gameState.date);
    expect(migrated.gameState.character).toEqual(LEGACY_M10_SAVE.gameState.character);
    const migratedBusiness = migrated.gameState.businesses[0]!;
    const originalBusiness = LEGACY_M10_SAVE.gameState.businesses[0]!;
    expect(migratedBusiness.id).toBe(originalBusiness.id);
    expect(migratedBusiness.business.name).toBe(originalBusiness.business.name);
    expect(migratedBusiness.business.treasury).toEqual(originalBusiness.business.treasury);
    expect(migratedBusiness.workforce).toEqual(originalBusiness.workforce);
    // Champs manquants d'une sauvegarde antérieure à M11.1.5, complétés par défaut :
    expect(migratedBusiness.business.properties).toEqual([]);
    expect(migratedBusiness.saleProcess).toBeNull();
  });

  it("synthétise une offre historique déjà lancée pour préserver la continuité de revenu (spec M11.2 §3.7)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    const offers = migrated.gameState.businesses[0]!.business.offers;
    expect(offers).toHaveLength(1);
    expect(offers[0]!.status).toBe("launched");
    expect(offers[0]!.maturity).toBe(100);
    // Le prix historique (decisions.price = 40) est préservé, pas remis à 0.
    expect(offers[0]!.price).toBe(40);
    expect(offers[0]!.name).not.toContain("service-abc123"); // jamais d'id technique dans un champ affiché
  });

  it("l'id de l'offre historique est stable : une double migration ne crée pas de doublon (idempotence)", () => {
    const migratedOnce = migrateSaveGame(LEGACY_M10_SAVE);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice.gameState.businesses[0]!.business.offers).toHaveLength(1);
    expect(migratedTwice.gameState.businesses[0]!.business.offers[0]!.id).toBe(
      migratedOnce.gameState.businesses[0]!.business.offers[0]!.id,
    );
  });

  it("draft.businesses[i].offerActions est initialisé à [] par la migration", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.draft.businesses[0]!.offerActions).toEqual([]);
  });

  it("l'offre historique synthétisée porte lastDemand: null (spec M11.2.2 §10)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.gameState.businesses[0]!.business.offers[0]!.lastDemand).toBeNull();
  });

  it("une sauvegarde M11.2.1 (offres déjà présentes, sans lastDemand) se charge sans crash et complète lastDemand: null", () => {
    const legacyM1121Save = {
      ...LEGACY_M10_SAVE,
      gameState: {
        ...LEGACY_M10_SAVE.gameState,
        businesses: [
          {
            ...LEGACY_M10_SAVE.gameState.businesses[0]!,
            business: {
              ...LEGACY_M10_SAVE.gameState.businesses[0]!.business,
              offers: [
                {
                  id: "service-abc123-offer-1",
                  name: "Offre M11.2.1",
                  businessModel: "service-hours",
                  positioning: "standard",
                  targetSegment: "Particuliers",
                  price: 45,
                  status: "launched",
                  maturity: 100,
                  qualityLevel: 60,
                  developmentHoursInvested: 0,
                  developmentBudgetInvested: 0,
                  createdAt: { year: 2025, month: 3 },
                  launchedAt: { year: 2025, month: 3 },
                  // lastDemand absent : sauvegarde antérieure à M11.2.2.
                },
              ],
            },
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyM1121Save);
    const offer = migrated.gameState.businesses[0]!.business.offers[0]!;
    expect(offer.id).toBe("service-abc123-offer-1");
    expect(offer.lastDemand).toBeNull();
    expect(offer.price).toBe(45); // continuité de revenu : rien d'autre ne change.
  });
});
