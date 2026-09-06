import type { Market } from "../types/market.js";

/**
 * Marchés de démonstration pour les vertical slices (test/scenarios,
 * démonstrateur CLI). Valeurs plausibles mais fictives — ce ne sont pas des
 * données économiques réelles.
 */
export const SERVICE_MARKET: Market = {
  id: "nettoyage-local",
  family: "service",
  sizeMonthlyRevenuePotential: 2_000_000,
  growthRateMonthly: 0.007,
  averageMargin: 0.4,
  fragmentation: 0.8,
  competitiveIntensity: 0.25,
  capitalIntensity: 0.1,
  regulation: 0.15,
  innovationRate: 0.1,
  priceSensitivity: 0.4,
  entryBarriers: 0.15,
  cyclicality: 0.2,
};

export const HOSPITALITY_MARKET: Market = {
  id: "restauration-quartier",
  family: "hospitality",
  sizeMonthlyRevenuePotential: 3_000_000,
  growthRateMonthly: 0.005,
  averageMargin: 0.25,
  fragmentation: 0.7,
  competitiveIntensity: 0.5,
  capitalIntensity: 0.5,
  regulation: 0.4,
  innovationRate: 0.15,
  priceSensitivity: 0.6,
  entryBarriers: 0.4,
  cyclicality: 0.5,
};

export const SUBSCRIPTION_MARKET: Market = {
  id: "saas-niche-b2b",
  family: "subscription",
  sizeMonthlyRevenuePotential: 5_000_000,
  growthRateMonthly: 0.015,
  averageMargin: 0.7,
  fragmentation: 0.6,
  competitiveIntensity: 0.4,
  capitalIntensity: 0.2,
  regulation: 0.1,
  innovationRate: 0.5,
  priceSensitivity: 0.3,
  entryBarriers: 0.2,
  cyclicality: 0.1,
};
