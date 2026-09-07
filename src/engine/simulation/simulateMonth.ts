import { createRng, deriveSeed } from "../rng/rng.js";
import { addMonths, toMonthIndex } from "../time/clock.js";
import { advanceMacro } from "../world/world.js";
import { advanceMarket, detectMarketInefficiency } from "../market/market.js";
import { advanceAggregateCompetition, availableDemandShare } from "../competition/competition.js";
import { allocateTime, applySkillGain } from "../character/character.js";
import { TIME_CATEGORIES, type SkillName, type TimeCategory } from "../../types/character.js";
import { INSOLVENCY_THRESHOLD_MONTHS } from "../business/treasury.js";
import { advanceSaleProcess, closeSale, resolveSaleDecision, startSaleProcess } from "../business/sale.js";
import { computeValuation } from "../business/valuation.js";
import { appendToMemory } from "../narrative/narrative.js";
import { createOwnedBusiness, resolveBusinessMonth } from "./businessResolution.js";
import type { GameEvent } from "../../types/narrative.js";
import type { Market } from "../../types/market.js";
import type { AggregateCompetition } from "../../types/competition.js";
import type { SaleProcessState } from "../../types/sale.js";
import type { GameState, MonthActions, OwnedBusiness } from "./types.js";

/**
 * Simplification P0 : chaque catégorie de temps fait progresser une seule
 * compétence proxy. Un modèle plus riche (apprentissage ciblé, mentorat...)
 * viendra dans un milestone ultérieur sans changer la forme de la boucle.
 */
const SKILL_GAIN_PER_HOUR: Readonly<Record<TimeCategory, { skill: SkillName; ratePerHour: number }>> = {
  emploi: { skill: "operations", ratePerHour: 0.02 },
  apprentissage: { skill: "technologie", ratePerHour: 0.05 },
  business: { skill: "vente", ratePerHour: 0.03 },
  reseau: { skill: "reseau", ratePerHour: 0.04 },
};

function validateActions(state: GameState, actions: MonthActions): void {
  const seenIds = new Set<string>();
  for (const action of actions.businessActions) {
    if (seenIds.has(action.businessId)) {
      throw new RangeError(`simulateMonth: businessId="${action.businessId}" apparaît plusieurs fois dans businessActions.`);
    }
    seenIds.add(action.businessId);

    const existing = state.businesses.find((business) => business.id === action.businessId);
    if (existing && action.create) {
      throw new RangeError(`simulateMonth: l'entreprise "${action.businessId}" existe déjà, "create" est invalide ce mois-ci.`);
    }
    if (!existing && !action.create) {
      throw new RangeError(`simulateMonth: businessId="${action.businessId}" inconnu et aucun "create" fourni.`);
    }
    if (!action.decisions) {
      throw new RangeError(`simulateMonth: businessId="${action.businessId}" nécessite "decisions" ce mois-ci.`);
    }
    if (action.create && !state.markets[action.create.marketId]) {
      throw new RangeError(`simulateMonth: marché "${action.create.marketId}" inconnu pour businessId="${action.businessId}".`);
    }
    if (action.capitalInjection !== undefined && action.capitalInjection < 0) {
      throw new RangeError(`simulateMonth: capitalInjection négatif pour businessId="${action.businessId}".`);
    }

    // Contrainte de capacité physique (spec M11.1.5 §3.2) : rejet explicite,
    // jamais un simple avertissement UI ni un clamp silencieux.
    if (action.targetHeadcount !== undefined && action.targetHeadcount > action.headcountCapacity) {
      const current = existing?.workforce.headcount ?? 0;
      throw new RangeError(
        `simulateMonth: businessId="${action.businessId}" — capacité atteinte (${current}/${action.headcountCapacity} postes utilisés). Agrandissez vos locaux avant de recruter.`,
      );
    }
    if (action.decisions.family === "retail" && action.decisions.stockUnits > action.storageCapacity) {
      throw new RangeError(
        `simulateMonth: businessId="${action.businessId}" — stock demandé (${action.decisions.stockUnits}) dépasse la capacité de stockage de vos locaux (${action.storageCapacity}). Agrandissez vos locaux avant d'augmenter le stock.`,
      );
    }
  }

  for (const owned of state.businesses) {
    if (!seenIds.has(owned.id)) {
      throw new RangeError(`simulateMonth: l'entreprise active "${owned.id}" nécessite une BusinessAction ce mois-ci.`);
    }
  }

  // Budget de temps fondateur partagé (spec M11.1.5 §5.3, §7.2) : production
  // ET prospection de TOUTES les entreprises comptent contre le même budget
  // global — jamais un levier gratuit, jamais un dédoublement de temps.
  const totalFounderHours = actions.businessActions.reduce(
    (sum, action) => sum + action.founderHoursAllocated + action.founderProspectionHoursAllocated,
    0,
  );
  if (totalFounderHours > actions.timeAllocation.business) {
    throw new RangeError(
      `simulateMonth: la somme des heures fondateur allouées aux entreprises (${totalFounderHours}h, production + prospection) dépasse le temps "business" alloué (${actions.timeAllocation.business}h).`,
    );
  }
}

/**
 * Résout un mois de simulation (spec §10, ordre imposé) :
 * 1. macro · 2. marchés · 3. concurrence · 4. demande · 5. ventes ·
 * 6. opérations · 7. employés · 8. comptabilité · 9. cash · 10. personnage ·
 * 11. événements · 12. mémoire.
 *
 * Fonction pure : `state` n'est jamais muté, tout l'aléa vient de `seed`
 * (dérivée déterministe par mois via `deriveSeed`). Le portefeuille
 * d'entreprises n'est plus limité à une seule (spec de consolidation §3).
 */
export function simulateMonth(state: GameState, actions: MonthActions, seed: number): GameState {
  validateActions(state, actions);

  const nextDate = addMonths(state.date, 1);
  const monthSeed = deriveSeed(seed, "month", toMonthIndex(nextDate));
  const rng = createRng(monthSeed);
  const events: GameEvent[] = [];

  // 1. macro
  const macro = advanceMacro(state.macro, nextDate, rng.fork("macro"));

  // 2. marchés
  const markets: Record<string, Market> = {};
  for (const [marketId, market] of Object.entries(state.markets)) {
    markets[marketId] = advanceMarket(market, macro, rng.fork(`market:${marketId}`));
  }

  // 3. concurrence
  const competitions: Record<string, AggregateCompetition> = {};
  for (const [marketId, competition] of Object.entries(state.competitions)) {
    competitions[marketId] = advanceAggregateCompetition(competition, markets[marketId]!, rng.fork(`competition:${marketId}`));
  }

  // 4. demande + 5. ventes + 6. opérations + 7. employés + 8. comptabilité + 9. cash
  // (résolus ensemble par entreprise : chaque famille traduit différemment
  // effectif/temps -> capacité, voir engine/simulation/businessResolution.ts)
  let availableCharacterCash =
    state.character.cash + (actions.jobHourlyWage !== null ? actions.jobHourlyWage * actions.timeAllocation.emploi : 0);

  const businesses: OwnedBusiness[] = [];
  for (const action of actions.businessActions) {
    const existing = state.businesses.find((business) => business.id === action.businessId);
    const owned: OwnedBusiness = existing ?? createOwnedBusiness(action.businessId, action.create!);
    const isNew = !existing;

    if (action.capitalInjection && action.capitalInjection > availableCharacterCash) {
      throw new RangeError(
        `simulateMonth: apport de ${action.capitalInjection} dans "${action.businessId}" dépasse le cash personnel disponible (${availableCharacterCash}).`,
      );
    }
    if (action.capitalInjection) {
      availableCharacterCash -= action.capitalInjection;
      events.push({
        kind: "capital-injected",
        date: nextDate,
        message: `Apport personnel de ${action.capitalInjection} dans "${owned.business.name}".`,
      });
    }

    if (action.propertyPurchase && action.propertyPurchase.downPaymentFromPersonalCash > availableCharacterCash) {
      throw new RangeError(
        `simulateMonth: apport immobilier de ${action.propertyPurchase.downPaymentFromPersonalCash} dans "${owned.business.name}" dépasse le cash personnel disponible (${availableCharacterCash}).`,
      );
    }
    if (action.propertyPurchase) {
      availableCharacterCash -= action.propertyPurchase.downPaymentFromPersonalCash;
    }

    const demandShare = availableDemandShare(competitions[owned.marketId]!);
    const resolved = resolveBusinessMonth(owned, action, demandShare, state.character.skills.leadership, rng);

    if (isNew) {
      events.push({
        kind: "business-created",
        date: nextDate,
        message: `Création de l'entreprise "${owned.business.name}" (${action.create!.family}).`,
      });
    }

    if (action.propertyPurchase) {
      events.push({
        kind: "property-purchased",
        date: nextDate,
        message: `"${resolved.updated.business.name}" a acheté un bien immobilier pour ${Math.round(action.propertyPurchase.purchasePrice)} €.`,
      });
    }

    if (action.note) {
      events.push({ kind: "business-note", date: nextDate, message: action.note });
    }

    // Cession (spec M11.1.5 §6.2) : avance le processus en cours et/ou
    // applique la décision du joueur, avant de statuer sur la sortie
    // (vendue) ou le maintien de l'entreprise dans le portefeuille.
    let saleProcess: SaleProcessState | null = owned.saleProcess;
    let saleDecisionResolvedThisMonth = false;
    if (action.saleDecision) {
      if (action.saleDecision.action === "list") {
        if (saleProcess === null) {
          saleProcess = startSaleProcess();
          events.push({
            kind: "business-listed-for-sale",
            date: nextDate,
            message: `"${resolved.updated.business.name}" est mise en vente.`,
          });
        }
      } else if (saleProcess !== null) {
        saleProcess = resolveSaleDecision(saleProcess, action.saleDecision);
        // Une décision (accept/reject/counter/withdraw) tranchée ce mois-ci
        // n'est jamais immédiatement suivie d'un nouveau tirage le même
        // mois : refuser une offre, par exemple, ne fait pas apparaître un
        // nouvel acheteur instantanément.
        saleDecisionResolvedThisMonth = true;
      }
    }
    if (!saleDecisionResolvedThisMonth && saleProcess !== null && saleProcess.status === "listed") {
      const valuation = computeValuation(resolved.updated.business, resolved.statement, resolved.updated.workforce);
      const beforeAdvance = saleProcess;
      saleProcess = advanceSaleProcess(saleProcess, valuation, rng.fork(`business:${owned.id}:sale`));
      if (beforeAdvance.status === "listed" && saleProcess.status === "offer-pending" && saleProcess.currentOffer) {
        events.push({
          kind: "sale-offer-received",
          date: nextDate,
          message: `Une offre de ${Math.round(saleProcess.currentOffer.amount)} € a été reçue pour "${resolved.updated.business.name}".`,
        });
      }
    }

    if (saleProcess !== null && saleProcess.status === "closed" && saleProcess.currentOffer) {
      const outstandingDebt =
        resolved.updated.business.treasury.creditLine.drawn +
        resolved.updated.business.treasury.unpaidObligations +
        resolved.updated.business.properties.reduce((sum, property) => sum + (property.mortgage?.principalRemaining ?? 0), 0);
      const closing = closeSale(saleProcess.currentOffer.amount, outstandingDebt);
      availableCharacterCash += closing.netProceeds;
      events.push({
        kind: "business-sold",
        date: nextDate,
        message: `"${resolved.updated.business.name}" vendue pour ${Math.round(closing.grossAmount)} € (produit net : ${Math.round(closing.netProceeds)} €).`,
      });
      // Vendue : ne rejoint pas `businesses`, sort définitivement du portefeuille.
    } else if (resolved.updated.business.treasury.isInsolvent) {
      events.push({
        kind: "business-liquidated",
        date: nextDate,
        message: `Liquidation forcée de "${resolved.updated.business.name}" après ${resolved.updated.business.treasury.consecutiveUnpaidMonths} mois d'obligations impayées (solde dû : ${Math.round(resolved.updated.business.treasury.unpaidObligations)}).`,
      });
    } else {
      if (resolved.updated.business.treasury.consecutiveUnpaidMonths === INSOLVENCY_THRESHOLD_MONTHS - 1) {
        events.push({
          kind: "cash-crisis-warning",
          date: nextDate,
          message: `"${resolved.updated.business.name}" : obligations impayées depuis plusieurs mois (solde dû : ${Math.round(resolved.updated.business.treasury.unpaidObligations)}), liquidation proche si rien ne change.`,
        });
      }
      const finalSaleProcess = saleProcess?.status === "withdrawn" ? null : saleProcess;
      businesses.push({ ...resolved.updated, saleProcess: finalSaleProcess });
    }
  }

  // 10. personnage
  let character = allocateTime(state.character, actions.timeAllocation);
  let skills = character.skills;
  for (const category of TIME_CATEGORIES) {
    const hours = actions.timeAllocation[category];
    if (hours > 0) {
      const gain = SKILL_GAIN_PER_HOUR[category];
      skills = applySkillGain(skills, gain.skill, hours * gain.ratePerHour);
    }
  }
  character = { ...character, cash: availableCharacterCash, skills };

  const job = actions.jobHourlyWage !== null ? { hourlyWage: actions.jobHourlyWage } : null;
  if (job && !state.job) {
    events.push({ kind: "job-started", date: nextDate, message: "Prise d'un emploi." });
  }

  // 11. événements
  for (const [marketId, market] of Object.entries(markets)) {
    if (detectMarketInefficiency(market, competitions[marketId]!)) {
      events.push({
        kind: "market-opportunity-detected",
        date: nextDate,
        message: `Opportunité détectée sur le marché ${marketId}.`,
      });
    }
  }

  // 12. mémoire
  const memory = appendToMemory(state.memory, events);

  return {
    date: nextDate,
    macro,
    markets,
    competitions,
    character,
    job,
    businesses,
    events,
    memory,
  };
}
