import type { EconomicFamily, GameDate } from "@founder/engine";
import { findOpportunity } from "../data/opportunities";
import { defaultBusinessIdentity } from "../state/businessIdentity";
import type { BusinessDraft, BusinessIdentity, MonthDraft, SaveGameV1 } from "../state/types";

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

  const gameState = {
    ...save.gameState,
    businesses: save.gameState.businesses.map((owned) => ({
      ...owned,
      business: { ...owned.business, properties: owned.business.properties ?? [] },
      saleProcess: owned.saleProcess ?? null,
    })),
  };

  const legacyDraft = save.draft as MonthDraft & { readonly business?: BusinessDraft | null };
  const rawBusinesses: readonly BusinessDraft[] = legacyDraft.businesses ?? (legacyDraft.business ? [legacyDraft.business] : []);
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
