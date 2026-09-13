import type { Rng } from "../rng/rng.js";
import { clamp } from "../util/math.js";
import type { AggregateCompetition, Competitor } from "../../types/competition.js";

/**
 * Nombre de concurrents identifiés générés par marché (spec M11.2.5 §3) —
 * calibrage, pas une vérité produit figée.
 */
export const IDENTIFIED_COMPETITORS_PER_MARKET = 4;

/** Force minimale d'un concurrent (jamais 0 — évite une part de marché qui s'effondre à rien). */
const MIN_STRENGTH = 0.05;
const MAX_STRENGTH = 1;
const STRENGTH_DRIFT_STD_DEV = 0.03;
const QUALITY_MEAN_REVERSION_STD_DEV = 0.05;

const COMPANY_NAME_PREFIXES: readonly string[] = [
  "Groupe",
  "Établissements",
  "Ateliers",
  "Société",
  "Cabinet",
  "Maison",
  "Compagnie",
];
const COMPANY_NAME_ROOTS: readonly string[] = [
  "Berthier",
  "Chastain",
  "Duvernay",
  "Lacaze",
  "Monteil",
  "Ravier",
  "Solane",
  "Tourville",
  "Verdier",
  "Aubertin",
  "Cassagne",
  "Delorme",
  "Fabregas",
  "Lantier",
  "Ormont",
  "Serpolet",
];
const COMPANY_NAME_SUFFIXES: readonly string[] = ["", "", "& Associés", "Group", "International", "Frères"];

function generateCompetitorName(rng: Rng): string {
  const prefix = rng.pick(COMPANY_NAME_PREFIXES);
  const root = rng.pick(COMPANY_NAME_ROOTS);
  const suffix = rng.pick(COMPANY_NAME_SUFFIXES);
  return [prefix, root, suffix].filter((part) => part.length > 0).join(" ");
}

/**
 * Génère les concurrents identifiés initiaux d'un marché (spec M11.2.5 §3).
 * Fonction pure et déterministe : `strength` est un poids relatif — PAS une
 * part de marché (voir `computeCompetitorMarketShare`, §1) — et
 * `qualityLevel` est centré sur `aggregate.averageQuality`.
 */
export function createIdentifiedCompetitors(
  marketId: string,
  aggregate: AggregateCompetition,
  rng: Rng,
): readonly Competitor[] {
  const marketRng = rng.fork(`identified-competitors:${marketId}`);
  const usedNames = new Set<string>();
  const competitors: Competitor[] = [];
  for (let i = 0; i < IDENTIFIED_COMPETITORS_PER_MARKET; i++) {
    const competitorRng = marketRng.fork(`competitor:${i}`);
    let name = generateCompetitorName(competitorRng.fork("name"));
    let attempt = 0;
    while (usedNames.has(name) && attempt < 20) {
      name = generateCompetitorName(competitorRng.fork(`name:retry:${attempt}`));
      attempt += 1;
    }
    usedNames.add(name);
    const strength = clamp(competitorRng.fork("strength").nextFloat(0.2, 1), MIN_STRENGTH, MAX_STRENGTH);
    const qualityLevel = clamp(competitorRng.fork("quality").nextGaussian(aggregate.averageQuality, 0.15), 0, 1);
    competitors.push({
      id: `${marketId}:competitor:${i}`,
      name,
      marketId,
      tier: "identified",
      strength,
      qualityLevel,
    });
  }
  return competitors;
}

/**
 * Fait évoluer les concurrents identifiés d'un marché d'un mois : dérive
 * lente de `strength` (bruit gaussien) et de `qualityLevel` (mean-reverting
 * vers `aggregate.averageQuality`, même esprit que `advanceAggregateCompetition`).
 * Identité/nombre/marché des concurrents inchangés — seules ces deux
 * grandeurs dérivent. Pure, aléa uniquement via `rng` fourni.
 */
export function advanceIdentifiedCompetitors(
  competitors: readonly Competitor[],
  aggregate: AggregateCompetition,
  rng: Rng,
): readonly Competitor[] {
  return competitors.map((competitor, index) => {
    const competitorRng = rng.fork(`advance:${competitor.id}:${index}`);
    const strength = clamp(
      competitor.strength + competitorRng.fork("strength").nextGaussian(0, STRENGTH_DRIFT_STD_DEV),
      MIN_STRENGTH,
      MAX_STRENGTH,
    );
    const qualityReversion = (aggregate.averageQuality - competitor.qualityLevel) * 0.1;
    const qualityLevel = clamp(
      competitor.qualityLevel + qualityReversion + competitorRng.fork("quality").nextGaussian(0, QUALITY_MEAN_REVERSION_STD_DEV),
      0,
      1,
    );
    return { ...competitor, strength, qualityLevel };
  });
}

/**
 * Part de marché d'un concurrent identifié — TOUJOURS dérivée à la lecture
 * (spec M11.2.5 §1), jamais stockée : garantit par construction que la
 * somme des parts de tous les concurrents d'un marché égale exactement
 * `aggregate.totalCapturedRevenueShare`, sans invariant à synchroniser à la
 * main. Pure, aucun aléa.
 */
export function computeCompetitorMarketShare(
  competitor: Competitor,
  marketCompetitors: readonly Competitor[],
  aggregate: AggregateCompetition,
): number {
  const totalStrength = marketCompetitors.reduce((sum, c) => sum + c.strength, 0);
  if (totalStrength <= 0) {
    return 0;
  }
  return (competitor.strength / totalStrength) * aggregate.totalCapturedRevenueShare;
}
