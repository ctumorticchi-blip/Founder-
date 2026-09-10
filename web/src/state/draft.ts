import type { BusinessAction, GameState, MonthActions, OfferAction, OwnedProperty } from "@founder/engine";
import { MONTHLY_TIME_BUDGET_HOURS } from "@founder/engine";
import {
  computeAdminMonthlyCost,
  computeEffectiveHeadcountCapacity,
  computeEffectiveStorageCapacity,
  computeInfrastructureMonthlyCost,
  computeInfrastructureSetupCost,
  computePurchasesCost,
} from "./businessCosts";
import { deriveDecisions } from "./commercialTranslation";
import { findPropertyListing } from "../data/realEstate";
import type { BusinessDraft, MonthDraft } from "./types";

export function createEmptyDraft(): MonthDraft {
  return {
    timeAllocation: { emploi: 0, apprentissage: 0, business: 0, reseau: 0 },
    job: null,
    businesses: [],
  };
}

export const TOTAL_MONTHLY_HOURS = MONTHLY_TIME_BUDGET_HOURS;

export function totalAllocatedHours(draft: MonthDraft): number {
  const { emploi, apprentissage, business, reseau } = draft.timeAllocation;
  return emploi + apprentissage + business + reseau;
}

export function remainingHours(draft: MonthDraft): number {
  return TOTAL_MONTHLY_HOURS - totalAllocatedHours(draft);
}

/**
 * Somme des heures fondateur (production + prospection + développement
 * d'offre) allouées à toutes les entreprises (spec M11.1.5 §5.3, §7.2,
 * étendue M11.2 §3.3).
 */
export function totalFounderBusinessHours(draft: MonthDraft): number {
  return draft.businesses.reduce(
    (sum, b) => sum + b.founderHoursAllocated + b.prospectionHours + offerDevelopmentHours(b.offerActions),
    0,
  );
}

function ownedPropertiesFor(gameState: GameState | null, businessId: string): readonly OwnedProperty[] {
  return gameState?.businesses.find((business) => business.id === businessId)?.business.properties ?? [];
}

/**
 * Prix de l'offre active de l'entreprise (spec M11.2 §3.4) : la première
 * offre `status === "launched"` par ordre de création (le tableau n'est
 * jamais réordonné), ou `null` si aucune offre n'est encore lancée — la
 * traduction `deriveDecisions` transforme alors ce `null` en prix `0`.
 */
function activeOfferPriceFor(gameState: GameState | null, businessId: string): number | null {
  const offers = gameState?.businesses.find((business) => business.id === businessId)?.business.offers ?? [];
  return offers.find((offer) => offer.status === "launched")?.price ?? null;
}

/** Somme des heures de développement d'offre demandées ce mois-ci pour une entreprise. */
export function offerDevelopmentHours(offerActions: readonly OfferAction[]): number {
  return offerActions.reduce((sum, action) => sum + (action.kind === "develop" ? action.hours : 0), 0);
}

/**
 * Traduit les choix catalogue du brouillon en `rentBudget`/`adminBudget`/
 * `capex`/capacités (spec M11.1/M11.1.5 §2, §3, §4) : agrégation pure de
 * prix et capacités affichés, jamais une conséquence économique — la
 * conséquence reste calculée à 100 % par `simulateMonth`.
 */
function buildBusinessAction(b: BusinessDraft, gameState: GameState | null): BusinessAction {
  const properties = ownedPropertiesFor(gameState, b.businessId);
  const infrastructureChanged = !b.isNew && b.infrastructureId !== b.committedInfrastructureId;
  const setupCost = b.isNew || infrastructureChanged ? computeInfrastructureSetupCost(b.infrastructureId) : 0;
  const capex = computePurchasesCost(b.purchases) + setupCost;

  const listing = b.propertyPurchase ? findPropertyListing(b.propertyPurchase.listingId) : null;
  const activeOfferPrice = activeOfferPriceFor(gameState, b.businessId);

  return {
    businessId: b.businessId,
    founderHoursAllocated: b.founderHoursAllocated,
    founderProspectionHoursAllocated: b.prospectionHours,
    decisions: deriveDecisions(b.family, b.prospectionHours, b.decisions, activeOfferPrice),
    marketingBudget: b.marketingBudget,
    rentBudget: computeInfrastructureMonthlyCost(b.infrastructureId),
    adminBudget: computeAdminMonthlyCost(b.adminOptionalIds),
    headcountCapacity: computeEffectiveHeadcountCapacity(b.infrastructureId, properties),
    storageCapacity: computeEffectiveStorageCapacity(b.infrastructureId, properties),
    ...(b.isNew && b.createSpec ? { create: b.createSpec } : {}),
    ...(capex > 0 ? { capex } : {}),
    ...(b.offerActions.length > 0 ? { offerActions: b.offerActions } : {}),
    ...(b.targetHeadcount !== null ? { targetHeadcount: b.targetHeadcount } : {}),
    ...(b.capitalInjection > 0 ? { capitalInjection: b.capitalInjection } : {}),
    ...(listing && b.propertyPurchase
      ? {
          propertyPurchase: {
            purchasePrice: listing.purchasePrice,
            monthlyMaintenance: listing.monthlyMaintenance,
            downPaymentFromPersonalCash: b.propertyPurchase.downPaymentFromPersonalCash,
            mortgageTermMonths: listing.mortgageTermMonths,
            mortgageRateAnnual: listing.mortgageRateAnnual,
            headcountCapacity: listing.headcountCapacity,
            storageCapacity: listing.storageCapacity,
          },
        }
      : {}),
    ...(b.saleDecision ? { saleDecision: b.saleDecision } : {}),
    ...(infrastructureChanged ? { note: `Déménagement vers ${b.infrastructureId}.` } : {}),
  };
}

/** Construit le `MonthActions` du moteur à partir du brouillon courant. */
export function buildMonthActions(draft: MonthDraft, gameState: GameState | null = null): MonthActions {
  const businessActions: BusinessAction[] = draft.businesses.map((b) => buildBusinessAction(b, gameState));

  return {
    timeAllocation: draft.timeAllocation,
    jobHourlyWage: draft.job ? draft.job.hourlyWage : null,
    businessActions,
  };
}

/** Reconduit le brouillon pour le mois suivant à partir du nouvel état moteur. */
export function deriveNextDraft(previousDraft: MonthDraft, nextState: GameState): MonthDraft {
  const businesses: BusinessDraft[] = previousDraft.businesses
    .filter((b) => nextState.businesses.some((business) => business.id === b.businessId))
    .map((b) => ({
      ...b,
      isNew: false,
      createSpec: null,
      targetHeadcount: null,
      capitalInjection: 0,
      purchases: [],
      propertyPurchase: null,
      saleDecision: null,
      offerActions: [],
      committedInfrastructureId: b.infrastructureId,
    }));

  return {
    timeAllocation: {
      ...previousDraft.timeAllocation,
      business: businesses.length > 0 ? previousDraft.timeAllocation.business : 0,
    },
    job: nextState.job ? previousDraft.job : null,
    businesses,
  };
}

/** Validation côté UI, en plus (jamais à la place) des validations du moteur. */
export function draftValidationError(draft: MonthDraft): string | null {
  const total = totalAllocatedHours(draft);
  if (total > TOTAL_MONTHLY_HOURS) {
    return `Vous avez alloué ${Math.round(total)} h, mais vous n'avez que ${TOTAL_MONTHLY_HOURS} h par mois.`;
  }
  const founderHours = totalFounderBusinessHours(draft);
  if (founderHours > draft.timeAllocation.business) {
    return `Vous avez réparti ${Math.round(founderHours)} h de production + prospection entre vos entreprises, mais seulement ${Math.round(draft.timeAllocation.business)} h "entreprise" sont allouées. Ajustez votre temps ou vos allocations.`;
  }
  const newBusinessWithoutTime = draft.businesses.find(
    (b) => b.isNew && b.founderHoursAllocated <= 0 && b.prospectionHours <= 0 && !b.targetHeadcount,
  );
  if (newBusinessWithoutTime) {
    return "Allouez du temps (production ou prospection), ou recrutez, pour que votre nouvelle activité produise dès son premier mois.";
  }
  return null;
}
