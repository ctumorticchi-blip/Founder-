import { createRng, deriveSeed } from "../rng/rng.js";
import { addMonths, toMonthIndex } from "../time/clock.js";
import { clamp } from "../util/math.js";
import { advanceMacro } from "../world/world.js";
import { advanceMarket, detectMarketInefficiency } from "../market/market.js";
import { advanceAggregateCompetition, availableDemandShare } from "../competition/competition.js";
import { allocateTime, applySkillGain } from "../character/character.js";
import { TIME_CATEGORIES, type SkillName, type TimeCategory } from "../../types/character.js";
import { computeMonthlyFinancials } from "../business/accounting.js";
import { applyCashFlow, createBusiness } from "../business/cash.js";
import { computeServiceMonth, type ServiceEngineState } from "../economic-models/service.js";
import { appendToMemory } from "../narrative/narrative.js";
import type { GameEvent } from "../../types/narrative.js";
import type { GameState, MonthActions, PlayerBusinessState } from "./types.js";

/**
 * Mois consécutifs à trésorerie négative avant liquidation forcée. Le
 * compteur (`consecutiveNegativeCashMonths`, engine/business/cash.ts) est le
 * signal précurseur exigé par la spec §3.7 : ce seuil ne se déclenche jamais
 * sur un seul mois isolé.
 */
const LIQUIDATION_THRESHOLD_MONTHS = 6;

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

function computeBusinessCapacityHours(actions: MonthActions, orgCapacityHours: number): number {
  return actions.timeAllocation.business + orgCapacityHours;
}

/**
 * Résout un mois de simulation (spec §10, ordre imposé) :
 * 1. macro · 2. marchés · 3. concurrence · 4. demande · 5. ventes ·
 * 6. opérations · 7. employés (no-op en P0, pas de headcount) ·
 * 8. comptabilité · 9. cash · 10. personnage · 11. événements · 12. mémoire.
 *
 * Fonction pure : `state` n'est jamais muté, tout l'aléa vient de `seed`
 * (dérivée déterministe par mois via `deriveSeed`).
 */
export function simulateMonth(state: GameState, actions: MonthActions, seed: number): GameState {
  if (state.playerBusiness && actions.createBusiness) {
    throw new RangeError("simulateMonth: une entreprise existe déjà, createBusiness est invalide ce mois-ci.");
  }
  if (!state.playerBusiness && !actions.createBusiness && actions.businessDecisions) {
    throw new RangeError("simulateMonth: businessDecisions fournies mais aucune entreprise n'existe.");
  }
  const willHaveBusiness = Boolean(state.playerBusiness) || Boolean(actions.createBusiness);
  if (willHaveBusiness && !actions.businessDecisions) {
    throw new RangeError("simulateMonth: une entreprise active nécessite businessDecisions ce mois-ci.");
  }

  const nextDate = addMonths(state.date, 1);
  const monthSeed = deriveSeed(seed, "month", toMonthIndex(nextDate));
  const rng = createRng(monthSeed);
  const events: GameEvent[] = [];

  // 1. macro
  const macro = advanceMacro(state.macro, nextDate, rng.fork("macro"));

  // 2. marchés
  const market = advanceMarket(state.market, macro, rng.fork("market"));

  // 3. concurrence
  const competition = advanceAggregateCompetition(state.competition, market, rng.fork("competition"));

  // 4. demande : part du marché non déjà captée par la concurrence de fond
  const demandShare = availableDemandShare(competition);

  // 5. ventes + 6. opérations (moteur Service, capacité = temps business alloué)
  let playerBusiness: PlayerBusinessState | null = state.playerBusiness;

  if (!playerBusiness && actions.createBusiness) {
    playerBusiness = {
      business: createBusiness("Activité de service du joueur", ["service"]),
      reputationScore: 0.1,
      costPerLaborHour: actions.createBusiness.costPerLaborHour,
    };
    events.push({
      kind: "business-created",
      date: nextDate,
      message: "Création d'une activité de service.",
    });
  }

  if (playerBusiness && actions.businessDecisions) {
    const capacityHours = computeBusinessCapacityHours(actions, state.character.orgCapacity.delegatedHoursPerMonth);
    const serviceState: ServiceEngineState = {
      hourlyRate: actions.businessDecisions.price,
      costPerLaborHour: playerBusiness.costPerLaborHour,
      reputationScore: playerBusiness.reputationScore,
    };
    const contribution = computeServiceMonth(
      serviceState,
      {
        capacityHours,
        targetHours: actions.businessDecisions.targetHours * demandShare,
      },
      { rng: rng.fork("business:service") },
    );

    // 8. comptabilité
    const statement = computeMonthlyFinancials({
      revenue: contribution.revenue,
      variableCosts: contribution.variableCosts,
      payroll: actions.businessDecisions.payrollBudget,
      marketing: actions.businessDecisions.marketingBudget,
      rent: actions.businessDecisions.rentBudget,
      admin: actions.businessDecisions.adminBudget,
      depreciation: 0,
      interest: 0,
      taxRate: 0.25,
      capex: 0,
      workingCapitalChange: 0,
    });

    // 9. cash
    const updatedBusiness = applyCashFlow(playerBusiness.business, statement);
    const reputationScore = clamp(playerBusiness.reputationScore + contribution.hoursSold * 0.0005, 0, 1);
    playerBusiness = { ...playerBusiness, business: updatedBusiness, reputationScore };

    if (updatedBusiness.consecutiveNegativeCashMonths >= LIQUIDATION_THRESHOLD_MONTHS) {
      events.push({
        kind: "business-liquidated",
        date: nextDate,
        message: `Liquidation forcée après ${updatedBusiness.consecutiveNegativeCashMonths} mois consécutifs de trésorerie négative.`,
      });
      playerBusiness = null;
    } else if (updatedBusiness.consecutiveNegativeCashMonths === LIQUIDATION_THRESHOLD_MONTHS - 1) {
      events.push({
        kind: "cash-crisis-warning",
        date: nextDate,
        message: "Trésorerie négative depuis plusieurs mois : liquidation proche si rien ne change.",
      });
    }
  }

  // 7. employés : hors périmètre P0 (pas de modèle de headcount), no-op documenté.

  // 10. personnage
  let character = allocateTime(state.character, actions.timeAllocation);
  let cash = character.cash;
  if (actions.jobHourlyWage !== null) {
    cash += actions.jobHourlyWage * actions.timeAllocation.emploi;
  }
  let skills = character.skills;
  for (const category of TIME_CATEGORIES) {
    const hours = actions.timeAllocation[category];
    if (hours > 0) {
      const gain = SKILL_GAIN_PER_HOUR[category];
      skills = applySkillGain(skills, gain.skill, hours * gain.ratePerHour);
    }
  }
  character = { ...character, cash, skills };

  const job = actions.jobHourlyWage !== null ? { hourlyWage: actions.jobHourlyWage } : null;
  if (job && !state.job) {
    events.push({ kind: "job-started", date: nextDate, message: "Prise d'un emploi." });
  }

  // 11. événements
  if (detectMarketInefficiency(market, competition)) {
    events.push({
      kind: "market-opportunity-detected",
      date: nextDate,
      message: `Opportunité détectée sur le marché ${market.id}.`,
    });
  }

  // 12. mémoire
  const memory = appendToMemory(state.memory, events);

  return {
    date: nextDate,
    macro,
    market,
    competition,
    character,
    job,
    playerBusiness,
    events,
    memory,
  };
}
