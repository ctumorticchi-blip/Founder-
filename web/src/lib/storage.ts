import type { SaveGameV1 } from "../state/types";

const STORAGE_KEY = "founder.save.v1";

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
      return parsed as SaveGameV1;
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
