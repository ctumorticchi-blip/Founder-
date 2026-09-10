import { INITIAL_QUALITY_LEVEL, type BusinessFamilyDecisions, type BusinessFamilyState, type EconomicFamily, type GameDate, type Offer, type OfferBusinessModel } from "@founder/engine";
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
 * Prix effectif d'une entreprise avant M11.2 (spec §3.7) : lu depuis les
 * décisions du brouillon pour les familles à prix éditable
 * (service/hospitality/retail), depuis `familyState` pour les familles à
 * prix figé à la création (subscription/agency, spec §0.2, §3.6).
 */
function extractLegacyPrice(familyState: BusinessFamilyState, decisions: BusinessFamilyDecisions | undefined): number {
  switch (familyState.family) {
    case "service":
      return decisions?.family === "service" ? decisions.price : 0;
    case "hospitality":
      return decisions?.family === "hospitality" ? decisions.averageTicketPrice : 0;
    case "retail":
      return decisions?.family === "retail" ? decisions.unitPrice : 0;
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
  decisions: BusinessFamilyDecisions | undefined,
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
      const offers: readonly Offer[] = owned.business.offers ?? [
        synthesizeLegacyOffer(
          owned.id,
          owned.familyState,
          decisionsByBusinessId.get(owned.id),
          businessIdentities[owned.id]?.createdAt ?? gameStateDate,
        ),
      ];
      return {
        ...owned,
        business: { ...owned.business, properties: owned.business.properties ?? [], offers },
        saleProcess: owned.saleProcess ?? null,
      };
    }),
  };

  const businesses = rawBusinesses.map((business) => migrateBusinessDraft(business, businessIdentities));

  return {
    ...save,
    gameState,
    businessIdentities,
    draft: { timeAllocation: save.draft.timeAllocation, job: save.draft.job, businesses },
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
