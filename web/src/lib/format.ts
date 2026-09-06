import { formatGameDate, type GameDate } from "@founder/engine";
import { OPPORTUNITIES } from "../data/opportunities";

/**
 * Aides d'affichage pures (formatage). Aucune logique économique : les
 * valeurs affichées viennent toujours du moteur, ce module se contente de
 * les mettre en forme pour l'écran.
 */

const MONEY_FORMATTER = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const MONEY_FORMATTER_PRECISE = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number, precise = false): string {
  if (!Number.isFinite(amount)) return "—";
  return (precise ? MONEY_FORMATTER_PRECISE : MONEY_FORMATTER).format(amount);
}

export function formatSignedMoney(amount: number): string {
  const formatted = formatMoney(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `−${formatted}`;
  return formatted;
}

export function formatHours(hours: number): string {
  return `${Math.round(hours * 10) / 10} h`;
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)} %`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatMonthLabel(date: GameDate): string {
  const name = MONTH_NAMES[date.month - 1] ?? formatGameDate(date);
  return `${name} ${date.year}`;
}

/**
 * Remplace les identifiants techniques de marché par leur nom lisible dans
 * un message d'événement du moteur (ex. "marché saas-niche-b2b" ->
 * "marché Abonnement SaaS"). Purement cosmétique : le message lui-même
 * vient du moteur, on ne fait que l'habiller pour l'écran.
 */
export function prettifyEventMessage(message: string): string {
  return OPPORTUNITIES.reduce((text, opportunity) => text.split(opportunity.market.id).join(opportunity.title), message);
}
