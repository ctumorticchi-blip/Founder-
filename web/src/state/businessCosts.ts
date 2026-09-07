import { ADMIN_COMPONENTS, requiredAdminComponents } from "../data/adminServices";
import { findCapexItem } from "../data/capexCatalog";
import { findInfrastructureOption } from "../data/infrastructure";
import type { Purchase } from "./types";

/**
 * Fonctions d'agrégation pures (spec M11.1 §2, §4) : traduisent un choix
 * catalogue en un nombre transmis tel quel au moteur (`rentBudget`,
 * `adminBudget`, `capex`). Aucun aléa, aucune règle économique — seulement
 * une somme de prix catalogue ("panier"), jamais une conséquence.
 */

export function computeInfrastructureMonthlyCost(infrastructureId: string): number {
  return findInfrastructureOption(infrastructureId)?.monthlyCost ?? 0;
}

export function computeInfrastructureSetupCost(infrastructureId: string): number {
  return findInfrastructureOption(infrastructureId)?.setupCost ?? 0;
}

export function computeAdminMonthlyCost(optionalIds: readonly string[]): number {
  const requiredTotal = requiredAdminComponents().reduce((sum, component) => sum + component.monthlyCost, 0);
  const optionalTotal = optionalIds.reduce((sum, id) => {
    const component = ADMIN_COMPONENTS.find((candidate) => candidate.id === id && !candidate.required);
    return sum + (component?.monthlyCost ?? 0);
  }, 0);
  return requiredTotal + optionalTotal;
}

export function computePurchasesCost(purchases: readonly Purchase[]): number {
  return purchases.reduce((sum, purchase) => {
    const item = findCapexItem(purchase.itemId);
    return sum + (item?.unitCost ?? 0) * purchase.quantity;
  }, 0);
}
