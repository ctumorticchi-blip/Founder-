#!/usr/bin/env node
import { ageInYears, formatGameDate } from "../engine/time/clock.js";
import { simulateMonth } from "../engine/simulation/simulateMonth.js";
import type { GameState, MonthActions } from "../engine/simulation/types.js";
import {
  SERVICE_SCENARIO_BIRTH_DATE,
  buildServiceScenarioActions,
  createServiceScenarioInitialState,
} from "../scenarios/service.js";
import {
  HOSPITALITY_SCENARIO_BIRTH_DATE,
  buildHospitalityScenarioActions,
  createHospitalityScenarioInitialState,
} from "../scenarios/hospitality.js";
import {
  SUBSCRIPTION_SCENARIO_BIRTH_DATE,
  buildSubscriptionScenarioActions,
  createSubscriptionScenarioInitialState,
} from "../scenarios/subscription.js";
import type { GameDate } from "../engine/time/clock.js";

/**
 * Démonstrateur headless de FOUNDER : joue une partie seedée mois après
 * mois avec un scénario canné (voir src/scenarios/*) et imprime un journal
 * lisible. Ne calcule RIEN lui-même : il ne fait qu'appeler `simulateMonth`
 * et afficher l'état retourné (spec §3 : "l'UI ne calcule rien").
 *
 * Usage :
 *   node dist/cli/run.js --scenario service --seed 20260906 --years 20
 *   node dist/cli/run.js --scenario subscription --verify-determinism
 */

interface ScenarioDefinition {
  readonly name: string;
  readonly birthDate: GameDate;
  createInitialState(seed: number): GameState;
  buildActions(monthIndex: number, state: GameState): MonthActions;
}

const SCENARIOS: Readonly<Record<string, ScenarioDefinition>> = {
  service: {
    name: "Service",
    birthDate: SERVICE_SCENARIO_BIRTH_DATE,
    createInitialState: createServiceScenarioInitialState,
    buildActions: buildServiceScenarioActions,
  },
  hospitality: {
    name: "Hospitality",
    birthDate: HOSPITALITY_SCENARIO_BIRTH_DATE,
    createInitialState: createHospitalityScenarioInitialState,
    buildActions: buildHospitalityScenarioActions,
  },
  subscription: {
    name: "Subscription",
    birthDate: SUBSCRIPTION_SCENARIO_BIRTH_DATE,
    createInitialState: createSubscriptionScenarioInitialState,
    buildActions: buildSubscriptionScenarioActions,
  },
};

interface CliOptions {
  readonly scenario: string;
  readonly seed: number;
  readonly years: number;
  readonly verifyDeterminism: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let scenario = "service";
  let seed = 20260906;
  let years = 20;
  let verifyDeterminism = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--scenario") {
      scenario = argv[++i] ?? scenario;
    } else if (arg === "--seed") {
      seed = Number(argv[++i]);
    } else if (arg === "--years") {
      years = Number(argv[++i]);
    } else if (arg === "--verify-determinism") {
      verifyDeterminism = true;
    }
  }

  if (!SCENARIOS[scenario]) {
    throw new Error(`Scénario inconnu : "${scenario}". Options : ${Object.keys(SCENARIOS).join(", ")}.`);
  }
  if (!Number.isFinite(seed)) {
    throw new Error("--seed doit être un nombre.");
  }
  if (!Number.isFinite(years) || years <= 0) {
    throw new Error("--years doit être un nombre entier positif.");
  }

  return { scenario, seed, years, verifyDeterminism };
}

function runFullGame(definition: ScenarioDefinition, seed: number, months: number): GameState {
  let state = definition.createInitialState(seed);
  for (let month = 0; month < months; month++) {
    state = simulateMonth(state, definition.buildActions(month, state), seed);
  }
  return state;
}

function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} €`;
}

function printYearLine(definition: ScenarioDefinition, state: GameState, yearEvents: readonly string[]): void {
  const age = ageInYears(definition.birthDate, state.date);
  const businessSummaries = state.businesses.map((business) => {
    const statement = business.lastStatement;
    const revenue = statement ? formatMoney(statement.revenue) : "n/d";
    const netIncome = statement ? formatMoney(statement.netIncome) : "n/d";
    return (
      `${business.id} [${business.familyState.family}]: ` +
      `cash=${formatMoney(business.business.treasury.cash)} ` +
      `(dont crédit tiré ${formatMoney(business.business.treasury.creditLine.drawn)}), ` +
      `salariés=${business.workforce.headcount.toFixed(1)}, ` +
      `CA/mois=${revenue}, résultat/mois=${netIncome}`
    );
  });

  console.log(
    `— ${formatGameDate(state.date)} (${age} ans) — cash perso: ${formatMoney(state.character.cash)}` +
      (businessSummaries.length > 0 ? `\n    ${businessSummaries.join("\n    ")}` : "\n    (aucune entreprise)") +
      (yearEvents.length > 0 ? `\n    événements: ${yearEvents.join(", ")}` : ""),
  );
}

function runAndPrintJournal(definition: ScenarioDefinition, seed: number, years: number): GameState {
  console.log(`FOUNDER — démonstrateur headless — scénario "${definition.name}", seed=${seed}, ${years} ans\n`);

  let state = definition.createInitialState(seed);
  let yearEvents: string[] = [];

  for (let month = 0; month < years * 12; month++) {
    state = simulateMonth(state, definition.buildActions(month, state), seed);
    for (const event of state.events) {
      yearEvents.push(event.kind);
    }
    if (month % 12 === 11) {
      printYearLine(definition, state, yearEvents);
      yearEvents = [];
    }
  }
  if (yearEvents.length > 0) {
    printYearLine(definition, state, yearEvents);
  }

  return state;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const definition = SCENARIOS[options.scenario]!;

  if (options.verifyDeterminism) {
    console.log(`Vérification du déterminisme — scénario "${definition.name}", seed=${options.seed}, ${options.years} ans...`);
    const runA = runFullGame(definition, options.seed, options.years * 12);
    const runB = runFullGame(definition, options.seed, options.years * 12);
    const identical = JSON.stringify(runA) === JSON.stringify(runB);
    console.log(identical ? "OK : les deux runs sont strictement identiques." : "ÉCHEC : les deux runs diffèrent.");
    process.exitCode = identical ? 0 : 1;
    return;
  }

  runAndPrintJournal(definition, options.seed, options.years);
}

main();
