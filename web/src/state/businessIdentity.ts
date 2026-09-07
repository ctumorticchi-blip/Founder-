import type { EconomicFamily, GameDate } from "@founder/engine";
import { findOpportunity } from "../data/opportunities";
import type { BusinessIdentity } from "./types";

/**
 * Identité par défaut (spec M11.1 §3.2, §6.2) : utilisée pour pré-remplir
 * `CreateBusinessScreen` et pour synthétiser une identité lisible pour une
 * entreprise migrée depuis une sauvegarde M10 (dont on ne connaît ni le nom
 * choisi par le joueur, ni la date de création réelle — limite assumée,
 * documentée dans la spec §6.2).
 */
export function defaultBusinessIdentity(family: EconomicFamily, createdAt: GameDate): BusinessIdentity {
  const opportunity = findOpportunity(family);
  return {
    displayName: opportunity?.defaultName ?? "Mon entreprise",
    description: opportunity?.pitch ?? "",
    activity: opportunity?.defaultActivity ?? "",
    targetCustomers: opportunity?.defaultTargetCustomers ?? "",
    createdAt,
  };
}
