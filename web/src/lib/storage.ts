import {
  INITIAL_QUALITY_LEVEL,
  INITIAL_REPUTATION_SCORE,
  computeBudgetEstimate,
  getMarketSegments,
  type BusinessFamilyState,
  type EconomicFamily,
  type GameDate,
  type Offer,
  type OfferBusinessModel,
  type SegmentCustomerMemory,
  type StrategicAccountOpportunity,
} from "@founder/engine";
import { findOpportunity } from "../data/opportunities";
import { defaultBusinessIdentity } from "../state/businessIdentity";
import type { BusinessDraft, BusinessIdentity, MonthDraft, SaveGameV1 } from "../state/types";

/** Modèle économique par défaut d'une offre historique synthétisée par migration (spec M11.2 §3.7). */
function defaultBusinessModelForFamily(family: EconomicFamily): OfferBusinessModel {
  switch (family) {
    case "service":
      return "service-hours";
    case "hospitality":
      return "unit-sale";
    case "subscription":
      return "recurring";
    case "retail":
      return "unit-sale";
    case "agency":
      return "project";
  }
}

/**
 * Forme des décisions telles que persistées par des sauvegardes antérieures
 * à M11.2.2 — `price`/`averageTicketPrice`/`unitPrice` existaient alors
 * dans les décisions du brouillon. Le type courant `BusinessFamilyDecisions`
 * ne les porte plus (spec M11.2.2 §9) : cette forme lâche sert uniquement à
 * relire une sauvegarde JSON plus ancienne, jamais à écrire de nouvelles
 * décisions.
 */
interface LegacyPricedDecisions {
  readonly family: string;
  readonly price?: number;
  readonly averageTicketPrice?: number;
  readonly unitPrice?: number;
}

/**
 * Prix effectif d'une entreprise avant M11.2 (spec §3.7) : lu depuis les
 * décisions du brouillon pour les familles à prix éditable
 * (service/hospitality/retail), depuis `familyState` pour les familles à
 * prix figé à la création (subscription/agency, spec §0.2, §3.6).
 */
function extractLegacyPrice(familyState: BusinessFamilyState, decisions: LegacyPricedDecisions | undefined): number {
  switch (familyState.family) {
    case "service":
      return decisions?.family === "service" ? (decisions.price ?? 0) : 0;
    case "hospitality":
      return decisions?.family === "hospitality" ? (decisions.averageTicketPrice ?? 0) : 0;
    case "retail":
      return decisions?.family === "retail" ? (decisions.unitPrice ?? 0) : 0;
    case "subscription":
      return familyState.arpu;
    case "agency":
      return familyState.averageMonthlyFeePerMandate;
  }
}

/**
 * Synthétise une offre historique déjà lancée pour une entreprise migrée
 * (spec M11.2 §3.7) : préserve la continuité de revenu — aucune
 * interruption au moment de la mise à jour, même prix qu'avant.
 */
function synthesizeLegacyOffer(
  businessId: string,
  familyState: BusinessFamilyState,
  decisions: LegacyPricedDecisions | undefined,
  date: GameDate,
): Offer {
  return {
    id: `${businessId}-legacy-offer`,
    name: "Offre historique",
    businessModel: defaultBusinessModelForFamily(familyState.family),
    positioning: "standard",
    targetSegment: "Clientèle existante",
    price: extractLegacyPrice(familyState, decisions),
    status: "launched",
    maturity: 100,
    qualityLevel: INITIAL_QUALITY_LEVEL,
    developmentHoursInvested: 0,
    developmentBudgetInvested: 0,
    createdAt: date,
    launchedAt: date,
    lastDemand: null,
    customerMemory: [],
  };
}

/**
 * Réputation d'une entreprise "subscription" antérieure à M11.2.3 (spec
 * §11) : ce champ n'existait pas avant que la réputation soit pilotée par
 * la satisfaction pour les 5 familles — initialisée au même niveau qu'une
 * nouvelle entreprise, jamais une valeur fabriquée à partir d'un historique
 * fictif (spec §20).
 */
function migrateFamilyState(familyState: BusinessFamilyState): BusinessFamilyState {
  if (familyState.family === "subscription" && familyState.reputationScore === undefined) {
    return { ...familyState, reputationScore: INITIAL_REPUTATION_SCORE };
  }
  return familyState;
}

/**
 * Complète une mémoire client antérieure à M11.2.3.1 avec les 3 champs de
 * repeat demand/frustration de disponibilité (spec M11.2.3.1 §7) — jamais de
 * valeur fabriquée : `0` signifie "aucun signal connu", cohérent avec l'état
 * initial produit par le moteur pour une mémoire neuve.
 */
function migrateSegmentCustomerMemory(memory: SegmentCustomerMemory): SegmentCustomerMemory {
  return {
    ...memory,
    repeatDemandThisMonth: memory.repeatDemandThisMonth ?? 0,
    unservedRepeatDemandThisMonth: memory.unservedRepeatDemandThisMonth ?? 0,
    availabilityFrustration: memory.availabilityFrustration ?? 0,
  };
}

/**
 * Complète une opportunité de compte stratégique antérieure à M11.2.4.2
 * avec les 4 champs de négociation (spec M11.2.4.2 §14) — jamais un
 * historique de négociation fabriqué : `researchHoursInvested: 0`
 * signifie "aucune recherche encore investie", `lastAccountProposal`/
 * `contract: null` signifient "aucune négociation en cours/aboutie",
 * cohérents avec l'état initial produit par le moteur pour une
 * opportunité neuve. `budgetEstimate` est recalculé (jamais persisté
 * comme une vérité figée) via `computeBudgetEstimate`, la même fonction
 * pure que le moteur utilise à la création — aucune valeur inventée hors
 * du catalogue réel de segments.
 */
function migrateStrategicAccountOpportunity(opportunity: StrategicAccountOpportunity, family: EconomicFamily): StrategicAccountOpportunity {
  const researchHoursInvested = opportunity.researchHoursInvested ?? 0;
  const referencePrice = getMarketSegments(family).find((segment) => segment.id === opportunity.segmentId)?.referencePrice ?? 0;
  return {
    ...opportunity,
    researchHoursInvested,
    lastAccountProposal: opportunity.lastAccountProposal ?? null,
    contract: opportunity.contract ? migrateAccountContract(opportunity.contract) : null,
    budgetEstimate: opportunity.budgetEstimate ?? computeBudgetEstimate(opportunity.id, referencePrice, researchHoursInvested),
    // Complète une opportunité signée antérieure à M11.2.4.4 (spec §9) —
    // jamais un historique de relation fabriqué : `null` signifie "aucun
    // mois encore résolu sous ce contrat", cohérent avec l'état initial
    // produit par le moteur à la signature.
    relationship: opportunity.relationship ?? null,
  };
}

/**
 * Complète un contrat signé antérieur à M11.2.4.3 avec les 2 champs
 * d'exécution mensuelle (spec M11.2.4.3 §5) — `0` signifie "aucune
 * exécution mesurée encore", jamais un historique de livraison fabriqué.
 */
function migrateAccountContract(contract: StrategicAccountOpportunity["contract"]): StrategicAccountOpportunity["contract"] {
  if (!contract) return null;
  return {
    ...contract,
    lastMonthServedVolume: contract.lastMonthServedVolume ?? 0,
    lastMonthUnservedVolume: contract.lastMonthUnservedVolume ?? 0,
  };
}

const STORAGE_KEY = "founder.save.v1";

/**
 * Migration défensive au chargement (spec M11.1 §6.2, étendue M11.1.5 §9).
 * Gère deux générations de sauvegardes plus anciennes que la forme actuelle,
 * jamais un crash :
 * - M10 : `BusinessDraft` sans catalogues (`rentBudget`/`adminBudget`/`capex`
 *   bruts), `businessIdentities` absent, `draft.business` singulier.
 * - M11.1 : `BusinessDraft` avec catalogues mais `draft.business` toujours
 *   singulier (pas encore de portefeuille), sans `founderHoursAllocated`/
 *   `prospectionHours`/`committedInfrastructureId`/`propertyPurchase`/
 *   `saleDecision`, et `gameState` sans `properties`/`saleProcess`
 *   (M11.1.5 §3-6). On ne bump pas la version — synthèse de valeurs par
 *   défaut lisibles. `gameState` n'est modifié que pour compléter les
 *   champs structurels manquants introduits par M11.1.5 (jamais pour
 *   changer une valeur existante). Idempotente.
 */
export function migrateSaveGame(raw: unknown): SaveGameV1 {
  const save = raw as SaveGameV1;
  const gameStateDate: GameDate = save.gameState.date;

  const businessIdentities: Record<string, BusinessIdentity> = { ...(save.businessIdentities ?? {}) };
  for (const owned of save.gameState.businesses) {
    if (!businessIdentities[owned.id]) {
      const family = owned.familyState.family as EconomicFamily;
      businessIdentities[owned.id] = defaultBusinessIdentity(family, gameStateDate);
    }
  }

  const legacyDraft = save.draft as MonthDraft & { readonly business?: BusinessDraft | null };
  const rawBusinesses: readonly BusinessDraft[] = legacyDraft.businesses ?? (legacyDraft.business ? [legacyDraft.business] : []);
  const decisionsByBusinessId = new Map(rawBusinesses.map((business) => [business.businessId, business.decisions]));

  const gameState = {
    ...save.gameState,
    businesses: save.gameState.businesses.map((owned) => {
      const offers: readonly Offer[] = (
        owned.business.offers ?? [
          synthesizeLegacyOffer(
            owned.id,
            owned.familyState,
            decisionsByBusinessId.get(owned.id),
            businessIdentities[owned.id]?.createdAt ?? gameStateDate,
          ),
        ]
      ).map((offer) => ({
        ...offer,
        lastDemand: offer.lastDemand ?? null,
        customerMemory: (offer.customerMemory ?? []).map(migrateSegmentCustomerMemory),
      }));
      return {
        ...owned,
        business: { ...owned.business, properties: owned.business.properties ?? [], offers },
        familyState: migrateFamilyState(owned.familyState),
        saleProcess: owned.saleProcess ?? null,
        strategicAccounts: owned.strategicAccounts ?? [],
        strategicAccountOpportunities: (owned.strategicAccountOpportunities ?? []).map((opportunity) =>
          migrateStrategicAccountOpportunity(opportunity, owned.familyState.family as EconomicFamily),
        ),
      };
    }),
  };

  const businesses = rawBusinesses.map((business) => migrateBusinessDraft(business, businessIdentities));

  // `lastRecap.businessNarratives` (spec M11.2.3 §16) n'existait pas avant :
  // complété à `[]`, jamais une narration fabriquée pour un mois déjà résolu.
  const lastRecap = save.lastRecap
    ? { ...save.lastRecap, businessNarratives: save.lastRecap.businessNarratives ?? [] }
    : save.lastRecap;

  return {
    ...save,
    gameState,
    businessIdentities,
    draft: { timeAllocation: save.draft.timeAllocation, job: save.draft.job, businesses },
    lastRecap,
  };
}

function migrateBusinessDraft(
  legacy: BusinessDraft & { readonly infrastructureId?: string; readonly founderHoursAllocated?: number },
  businessIdentities: Readonly<Record<string, BusinessIdentity>>,
): BusinessDraft {
  const identity = businessIdentities[legacy.businessId];
  const hasCatalogFields = legacy.infrastructureId !== undefined;
  const recommendedInfrastructureId = findOpportunity(legacy.family)?.recommendedInfrastructureId ?? "domicile";

  const base: BusinessDraft = hasCatalogFields
    ? legacy
    : {
        ...legacy,
        name: identity?.displayName ?? legacy.businessId,
        description: identity?.description ?? "",
        activity: identity?.activity ?? "",
        targetCustomers: identity?.targetCustomers ?? "",
        infrastructureId: recommendedInfrastructureId,
        adminOptionalIds: [],
        purchases: [],
      };

  return {
    ...base,
    founderHoursAllocated: legacy.founderHoursAllocated ?? 0,
    prospectionHours: (base as { readonly prospectionHours?: number }).prospectionHours ?? 0,
    committedInfrastructureId:
      (base as { readonly committedInfrastructureId?: string }).committedInfrastructureId ?? base.infrastructureId,
    propertyPurchase: (base as { readonly propertyPurchase?: BusinessDraft["propertyPurchase"] }).propertyPurchase ?? null,
    saleDecision: (base as { readonly saleDecision?: BusinessDraft["saleDecision"] }).saleDecision ?? null,
    offerActions: (base as { readonly offerActions?: BusinessDraft["offerActions"] }).offerActions ?? [],
    strategicAccountActions:
      (base as { readonly strategicAccountActions?: BusinessDraft["strategicAccountActions"] }).strategicAccountActions ?? [],
  };
}

/**
 * Persistance locale de la partie (spec M10 : "un refresh ne doit pas faire
 * perdre la progression"). Le seed et l'état complet du moteur sont
 * sérialisés tels quels (GameState est un objet JSON pur, sans fonctions).
 */
export function loadSave(): SaveGameV1 | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      (parsed as { version: unknown }).version === 1
    ) {
      return migrateSaveGame(parsed);
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSave(save: SaveGameV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Stockage indisponible (navigation privée, quota...) : la partie continue en mémoire.
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignoré
  }
}
