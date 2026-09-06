/**
 * Horloge du monde FOUNDER. 1 tour moteur = 1 mois (spec P0 §3.1) : tout le
 * temps de jeu se manipule via `GameDate`, jamais via `Date` (interdit dans
 * le moteur par la config ESLint).
 */

export interface GameDate {
  readonly year: number;
  readonly month: number; // 1-12
}

function assertValidGameDate(date: GameDate): void {
  if (!Number.isInteger(date.month) || date.month < 1 || date.month > 12) {
    throw new RangeError(`GameDate invalide : month=${date.month} (attendu 1-12).`);
  }
  if (!Number.isInteger(date.year)) {
    throw new RangeError(`GameDate invalide : year=${date.year} doit être un entier.`);
  }
}

/** Index mensuel absolu (année*12 + mois-1), utile pour les comparaisons/arithmétique. */
export function toMonthIndex(date: GameDate): number {
  assertValidGameDate(date);
  return date.year * 12 + (date.month - 1);
}

export function fromMonthIndex(monthIndex: number): GameDate {
  const year = Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12; // gère les monthIndex négatifs
  return { year, month: month + 1 };
}

/** Avance (ou recule si négatif) une date d'un nombre de mois entier. */
export function addMonths(date: GameDate, months: number): GameDate {
  if (!Number.isInteger(months)) {
    throw new RangeError(`addMonths: months=${months} doit être un entier.`);
  }
  return fromMonthIndex(toMonthIndex(date) + months);
}

/** Nombre de mois entre `from` et `to` (positif si `to` est après `from`). */
export function monthsBetween(from: GameDate, to: GameDate): number {
  return toMonthIndex(to) - toMonthIndex(from);
}

/** -1 si a < b, 0 si égales, 1 si a > b. */
export function compareGameDates(a: GameDate, b: GameDate): number {
  const diff = toMonthIndex(a) - toMonthIndex(b);
  return diff === 0 ? 0 : diff < 0 ? -1 : 1;
}

/** Âge en années pleines révolues à `currentDate`, étant né le `birthDate`. */
export function ageInYears(birthDate: GameDate, currentDate: GameDate): number {
  if (compareGameDates(currentDate, birthDate) < 0) {
    throw new RangeError("ageInYears: currentDate est antérieure à birthDate.");
  }
  return Math.floor(monthsBetween(birthDate, currentDate) / 12);
}

export function formatGameDate(date: GameDate): string {
  assertValidGameDate(date);
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}
