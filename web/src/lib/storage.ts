import type { EconomicFamily, GameDate } from "@founder/engine";
import { findOpportunity } from "../data/opportunities";
import { defaultBusinessIdentity } from "../state/businessIdentity";
import type { BusinessDraft, BusinessIdentity, SaveGameV1 } from "../state/types";

const STORAGE_KEY = "founder.save.v1";

/**
 * Migration défensive au chargement (spec M11.1 §6.2) : une sauvegarde M10
 * n'a ni `businessIdentities`, ni la nouvelle forme de `BusinessDraft`
 * (`infrastructureId`/`adminOptionalIds`/`purchases`). On ne bump pas la
 * version — on synthétise en mémoire des valeurs par défaut lisibles,
 * jamais un crash. `gameState` (source de vérité moteur) n'est jamais
 * modifié : seules les structures web (`businessIdentities`, `draft`) le
 * sont. Idempotente : une sauvegarde déjà à jour traverse sans changement.
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

  const legacyBusiness = save.draft.business as (BusinessDraft & { readonly infrastructureId?: string }) | null;
  const business: BusinessDraft | null =
    legacyBusiness && legacyBusiness.infrastructureId === undefined
      ? migrateLegacyBusinessDraft(legacyBusiness, businessIdentities)
      : legacyBusiness;

  return {
    ...save,
    businessIdentities,
    draft: { ...save.draft, business },
  };
}

function migrateLegacyBusinessDraft(
  legacy: BusinessDraft,
  businessIdentities: Readonly<Record<string, BusinessIdentity>>,
): BusinessDraft {
  const identity = businessIdentities[legacy.businessId];
  const recommendedInfrastructureId = findOpportunity(legacy.family)?.recommendedInfrastructureId ?? "domicile";
  return {
    ...legacy,
    name: identity?.displayName ?? legacy.businessId,
    description: identity?.description ?? "",
    activity: identity?.activity ?? "",
    targetCustomers: identity?.targetCustomers ?? "",
    infrastructureId: recommendedInfrastructureId,
    adminOptionalIds: [],
    purchases: [],
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
