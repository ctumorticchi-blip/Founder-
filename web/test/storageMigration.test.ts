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

  it("l'offre historique synthétisée porte customerMemory: [] (spec M11.2.3 §20)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.gameState.businesses[0]!.business.offers[0]!.customerMemory).toEqual([]);
  });

  it("une sauvegarde M11.2.2 (offres avec lastDemand, sans customerMemory) complète customerMemory: [] sans fabriquer d'historique", () => {
    const legacyM1122Save = {
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
                  name: "Offre M11.2.2",
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
                  lastDemand: null,
                  // customerMemory absent : sauvegarde antérieure à M11.2.3.
                },
              ],
            },
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyM1122Save);
    const offer = migrated.gameState.businesses[0]!.business.offers[0]!;
    expect(offer.customerMemory).toEqual([]);
    expect(offer.price).toBe(45);
  });

  it("une entreprise subscription sans reputationScore (antérieure à M11.2.3) reçoit la réputation initiale, jamais un historique fabriqué", () => {
    const legacySubscriptionSave = {
      ...LEGACY_M10_SAVE,
      gameState: {
        ...LEGACY_M10_SAVE.gameState,
        businesses: [
          {
            id: "sub-abc123",
            business: { name: "sub-abc123", families: ["subscription"], treasury: { cash: 0 } },
            workforce: { headcount: 0 },
            marketId: "market-2",
            familyState: { family: "subscription", activeSubscribers: 500, arpu: 29, churnRateBase: 0.04, cogsRatio: 0.2 },
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacySubscriptionSave);
    const familyState = migrated.gameState.businesses[0]!.familyState as { readonly reputationScore: number };
    expect(familyState.reputationScore).toBeGreaterThanOrEqual(0);
    expect(familyState.reputationScore).toBeLessThanOrEqual(1);
  });

  it("la migration M11.2.3 est idempotente (customerMemory/reputationScore stables sur double passage)", () => {
    const legacySubscriptionSave = {
      ...LEGACY_M10_SAVE,
      gameState: {
        ...LEGACY_M10_SAVE.gameState,
        businesses: [
          {
            id: "sub-abc123",
            business: { name: "sub-abc123", families: ["subscription"], treasury: { cash: 0 } },
            workforce: { headcount: 0 },
            marketId: "market-2",
            familyState: { family: "subscription", activeSubscribers: 500, arpu: 29, churnRateBase: 0.04, cogsRatio: 0.2 },
          },
        ],
      },
    };
    const migratedOnce = migrateSaveGame(legacySubscriptionSave);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice).toEqual(migratedOnce);
  });

  it("une sauvegarde M11.2.3 (customerMemory sans les champs de repeat demand/frustration) complète chaque entrée à 0 sans fabriquer d'historique (spec M11.2.3.1 §7)", () => {
    const legacyM1123Save = {
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
                  name: "Offre M11.2.3",
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
                  lastDemand: null,
                  customerMemory: [
                    {
                      segmentId: "seg-1",
                      segmentLabel: "Particuliers",
                      retainedBaseVolume: 42,
                      newVolumeThisMonth: 10,
                      retainedVolumeThisMonth: 32,
                      cumulativeAcquiredVolume: 100,
                      lastSatisfactionScore: 70,
                      smoothedSatisfactionScore: 70,
                      lastDiagnosis: null,
                      consecutiveGoodMonths: 1,
                      consecutiveBadMonths: 0,
                      monthsSinceFirstSale: 5,
                      // repeatDemandThisMonth/unservedRepeatDemandThisMonth/availabilityFrustration absents : sauvegarde antérieure à M11.2.3.1.
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyM1123Save);
    const memory = migrated.gameState.businesses[0]!.business.offers[0]!.customerMemory[0]!;
    expect(memory.repeatDemandThisMonth).toBe(0);
    expect(memory.unservedRepeatDemandThisMonth).toBe(0);
    expect(memory.availabilityFrustration).toBe(0);
    expect(memory.retainedBaseVolume).toBe(42); // valeur existante jamais modifiée
  });

  it("la migration M11.2.3.1 est idempotente (customerMemory stable sur double passage)", () => {
    const legacyM1123Save = {
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
                  name: "Offre M11.2.3",
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
                  lastDemand: null,
                  customerMemory: [
                    {
                      segmentId: "seg-1",
                      segmentLabel: "Particuliers",
                      retainedBaseVolume: 42,
                      newVolumeThisMonth: 10,
                      retainedVolumeThisMonth: 32,
                      cumulativeAcquiredVolume: 100,
                      lastSatisfactionScore: 70,
                      smoothedSatisfactionScore: 70,
                      lastDiagnosis: null,
                      consecutiveGoodMonths: 1,
                      consecutiveBadMonths: 0,
                      monthsSinceFirstSale: 5,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    };
    const migratedOnce = migrateSaveGame(legacyM1123Save);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice).toEqual(migratedOnce);
  });

  it("un lastRecap antérieur à M11.2.3 (sans businessNarratives) se charge sans crash et reçoit []", () => {
    const legacyRecapSave = {
      ...LEGACY_M10_SAVE,
      lastRecap: {
        date: { year: 2025, month: 6 },
        ageYears: 19,
        cashBefore: 900,
        cashAfter: 1000,
        events: [],
        businessSummaries: [],
        // businessNarratives absent : sauvegarde antérieure à M11.2.3.
      },
    };
    const migrated = migrateSaveGame(legacyRecapSave);
    expect(migrated.lastRecap?.businessNarratives).toEqual([]);
  });

  it("lastRecap: null reste null après migration (aucun mois en attente)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.lastRecap).toBeNull();
  });

  it("une entreprise sans strategicAccounts/strategicAccountOpportunities (antérieure à M11.2.4) reçoit [] pour les deux, jamais un compte fabriqué (spec M11.2.4 §14)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    const business = migrated.gameState.businesses[0]!;
    expect(business.strategicAccounts).toEqual([]);
    expect(business.strategicAccountOpportunities).toEqual([]);
  });

  it("la migration M11.2.4 est idempotente (strategicAccounts/strategicAccountOpportunities stables sur double passage)", () => {
    const migratedOnce = migrateSaveGame(LEGACY_M10_SAVE);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice).toEqual(migratedOnce);
  });

  it("une sauvegarde portant déjà des opportunités les préserve telles quelles (pas de perte lors d'une remigration)", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const withOpportunity = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        businesses: [
          {
            ...alreadyMigrated.gameState.businesses[0]!,
            strategicAccountOpportunities: [
              {
                id: "x",
                businessId: "service-abc123",
                offerId: "o1",
                segmentId: "s1",
                companyName: "Groupe Meridien",
                contactName: "Camille Marchand",
                contactRole: "Directrice générale",
                source: "network",
                discoveredAt: { year: 2025, month: 6 },
                status: "researching",
              },
            ],
          },
        ],
      },
    };
    const remigrated = migrateSaveGame(withOpportunity);
    const migratedOpportunity = remigrated.gameState.businesses[0]!.strategicAccountOpportunities[0]!;
    const original = withOpportunity.gameState.businesses[0]!.strategicAccountOpportunities[0]!;
    // Les champs d'identité M11.2.4.1 sont préservés tels quels — seuls les
    // 4 nouveaux champs M11.2.4.2 (absents de ce fixture antérieur) sont
    // complétés par la migration (voir tests dédiés ci-dessous).
    expect(migratedOpportunity.id).toBe(original.id);
    expect(migratedOpportunity.companyName).toBe(original.companyName);
    expect(migratedOpportunity.status).toBe(original.status);
  });

  it("une opportunité M11.2.4.1 (sans researchHoursInvested/budgetEstimate/lastAccountProposal/contract) est complétée sans fabriquer d'historique de négociation (spec M11.2.4.2 §14)", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const legacyOpportunitySave = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        businesses: [
          {
            ...alreadyMigrated.gameState.businesses[0]!,
            familyState: { family: "service" as const, reputationScore: 0.5, costPerLaborHour: 8 },
            strategicAccountOpportunities: [
              {
                id: "biz-1:offer-1:service-entreprises-exigeantes:24305",
                businessId: "service-abc123",
                offerId: "offer-1",
                segmentId: "service-entreprises-exigeantes",
                companyName: "Groupe Meridien",
                contactName: "Camille Marchand",
                contactRole: "Directrice générale",
                source: "network",
                discoveredAt: { year: 2025, month: 6 },
                status: "researching",
                // researchHoursInvested/budgetEstimate/lastAccountProposal/contract absents : sauvegarde M11.2.4.1.
              },
            ],
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyOpportunitySave);
    const opportunity = migrated.gameState.businesses[0]!.strategicAccountOpportunities[0]!;
    expect(opportunity.researchHoursInvested).toBe(0);
    expect(opportunity.lastAccountProposal).toBeNull();
    expect(opportunity.contract).toBeNull();
    expect(opportunity.budgetEstimate.price.value).toBeGreaterThan(0);
    expect(opportunity.budgetEstimate.price.uncertainty).toBeGreaterThan(0);
  });

  it("un contrat signé M11.2.4.2 (sans lastMonthServedVolume/lastMonthUnservedVolume) est complété à 0, jamais un historique de livraison fabriqué (spec M11.2.4.3 §5)", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const legacyContractSave = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        businesses: [
          {
            ...alreadyMigrated.gameState.businesses[0]!,
            familyState: { family: "service" as const, reputationScore: 0.5, costPerLaborHour: 8 },
            strategicAccountOpportunities: [
              {
                id: "biz-1:offer-1:service-entreprises-exigeantes:24305",
                businessId: "service-abc123",
                offerId: "offer-1",
                segmentId: "service-entreprises-exigeantes",
                companyName: "Groupe Meridien",
                contactName: "Camille Marchand",
                contactRole: "Directrice générale",
                source: "network",
                discoveredAt: { year: 2025, month: 6 },
                status: "won",
                researchHoursInvested: 20,
                lastAccountProposal: null,
                contract: {
                  price: 12_000,
                  volume: 40,
                  qualityCommitment: 70,
                  durationMonths: 6,
                  monthsRemaining: 6,
                  signedAt: { year: 2025, month: 6 },
                  // lastMonthServedVolume/lastMonthUnservedVolume absents : sauvegarde M11.2.4.2.
                },
              },
            ],
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyContractSave);
    const contract = migrated.gameState.businesses[0]!.strategicAccountOpportunities[0]!.contract!;
    expect(contract.lastMonthServedVolume).toBe(0);
    expect(contract.lastMonthUnservedVolume).toBe(0);
    expect(contract.volume).toBe(40);
  });

  it("une opportunité signée M11.2.4.3 (sans relationship) reçoit relationship: null, jamais un historique de relation fabriqué (spec M11.2.4.4 §9)", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const legacyRelationshipSave = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        businesses: [
          {
            ...alreadyMigrated.gameState.businesses[0]!,
            familyState: { family: "service" as const, reputationScore: 0.5, costPerLaborHour: 8 },
            strategicAccountOpportunities: [
              {
                id: "biz-1:offer-1:service-entreprises-exigeantes:24305",
                businessId: "service-abc123",
                offerId: "offer-1",
                segmentId: "service-entreprises-exigeantes",
                companyName: "Groupe Meridien",
                contactName: "Camille Marchand",
                contactRole: "Directrice générale",
                source: "network",
                discoveredAt: { year: 2025, month: 6 },
                status: "won",
                researchHoursInvested: 20,
                lastAccountProposal: null,
                contract: {
                  price: 12_000,
                  volume: 40,
                  qualityCommitment: 70,
                  durationMonths: 6,
                  monthsRemaining: 5,
                  signedAt: { year: 2025, month: 6 },
                  lastMonthServedVolume: 40,
                  lastMonthUnservedVolume: 0,
                },
                // relationship absent au niveau de l'opportunité : sauvegarde M11.2.4.3.
              },
            ],
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyRelationshipSave);
    const opportunity = migrated.gameState.businesses[0]!.strategicAccountOpportunities[0]!;
    expect(opportunity.relationship).toBeNull();
  });

  it("un contrat signé antérieur à M11.2.4.5 (sans renewalProposal/renewalDeadlineMonthsRemaining) reçoit null pour les deux, jamais un renouvellement fabriqué (spec M11.2.4.5 §12)", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const legacyRenewalSave = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        businesses: [
          {
            ...alreadyMigrated.gameState.businesses[0]!,
            familyState: { family: "service" as const, reputationScore: 0.5, costPerLaborHour: 8 },
            strategicAccountOpportunities: [
              {
                id: "biz-1:offer-1:service-entreprises-exigeantes:24305",
                businessId: "service-abc123",
                offerId: "offer-1",
                segmentId: "service-entreprises-exigeantes",
                companyName: "Groupe Meridien",
                contactName: "Camille Marchand",
                contactRole: "Directrice générale",
                source: "network",
                discoveredAt: { year: 2025, month: 6 },
                status: "won",
                researchHoursInvested: 20,
                lastAccountProposal: null,
                contract: {
                  price: 12_000,
                  volume: 40,
                  qualityCommitment: 70,
                  durationMonths: 6,
                  monthsRemaining: 0,
                  signedAt: { year: 2025, month: 6 },
                  lastMonthServedVolume: 40,
                  lastMonthUnservedVolume: 0,
                  // renewalProposal/renewalDeadlineMonthsRemaining absents : sauvegarde M11.2.4.4.
                },
                relationship: null,
              },
            ],
          },
        ],
      },
    };
    const migrated = migrateSaveGame(legacyRenewalSave);
    const contract = migrated.gameState.businesses[0]!.strategicAccountOpportunities[0]!.contract!;
    expect(contract.renewalProposal).toBeNull();
    expect(contract.renewalDeadlineMonthsRemaining).toBeNull();
    expect(contract.volume).toBe(40);
  });

  it("la migration M11.2.4.2 est idempotente (researchHoursInvested/budgetEstimate stables sur double passage)", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const legacyOpportunitySave = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        businesses: [
          {
            ...alreadyMigrated.gameState.businesses[0]!,
            familyState: { family: "service" as const, reputationScore: 0.5, costPerLaborHour: 8 },
            strategicAccountOpportunities: [
              {
                id: "biz-1:offer-1:service-entreprises-exigeantes:24305",
                businessId: "service-abc123",
                offerId: "offer-1",
                segmentId: "service-entreprises-exigeantes",
                companyName: "Groupe Meridien",
                contactName: "Camille Marchand",
                contactRole: "Directrice générale",
                source: "network",
                discoveredAt: { year: 2025, month: 6 },
                status: "researching",
              },
            ],
          },
        ],
      },
    };
    const migratedOnce = migrateSaveGame(legacyOpportunitySave);
    const migratedTwice = migrateSaveGame(migratedOnce);
    expect(migratedTwice).toEqual(migratedOnce);
  });

  it("une sauvegarde antérieure à M11.2.5 (sans competitors) reçoit {}, jamais un concurrent fabriqué (spec M11.2.5 §4/§7)", () => {
    const migrated = migrateSaveGame(LEGACY_M10_SAVE);
    expect(migrated.gameState.competitors).toEqual({});
  });

  it("une sauvegarde portant déjà des concurrents identifiés les préserve telles quelles", () => {
    const alreadyMigrated = migrateSaveGame(LEGACY_M10_SAVE);
    const saveWithCompetitors = {
      ...alreadyMigrated,
      gameState: {
        ...alreadyMigrated.gameState,
        competitors: {
          "market-1": [
            { id: "market-1:competitor:0", name: "Ateliers Berthier", marketId: "market-1", tier: "identified" as const, strength: 0.6, qualityLevel: 0.4 },
          ],
        },
      },
    };
    const migrated = migrateSaveGame(saveWithCompetitors);
    expect(migrated.gameState.competitors).toEqual(saveWithCompetitors.gameState.competitors);
  });
});
