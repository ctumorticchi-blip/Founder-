import type { Rng } from "../rng/rng.js";

/**
 * Catalogue déterministe de noms d'entreprises/interlocuteurs fictifs pour
 * les opportunités de comptes stratégiques (spec M11.2.4 §5) — jamais un
 * id technique affiché au joueur (invariant transverse). Donnée pure,
 * aucun état : un Strategic Account est une entreprise cliente B2B
 * générique, pas un personnage du Human Engine (hors scope, §0.7/§17).
 */
const COMPANY_NAME_PREFIXES: readonly string[] = [
  "Groupe",
  "Établissements",
  "Ateliers",
  "Société",
  "Cabinet",
  "Maison",
  "Domaine",
  "Compagnie",
];
const COMPANY_NAME_ROOTS: readonly string[] = [
  "Meridien",
  "Vasseur",
  "Lorenzi",
  "Delacroix",
  "Bertrand",
  "Norvia",
  "Castel",
  "Auberval",
  "Fontenay",
  "Girard",
  "Lambert",
  "Roussel",
  "Vauban",
  "Ferrand",
  "Montclair",
  "Serrano",
];
const COMPANY_NAME_SUFFIXES: readonly string[] = ["", "", "& Associés", "Group", "International", "Frères"];

const CONTACT_FIRST_NAMES: readonly string[] = [
  "Camille",
  "Julien",
  "Nadia",
  "Thomas",
  "Sophie",
  "Karim",
  "Elodie",
  "Antoine",
  "Laëtitia",
  "Vincent",
];
const CONTACT_LAST_NAMES: readonly string[] = [
  "Marchand",
  "Perrot",
  "Bouchard",
  "Levasseur",
  "Guérin",
  "Charrier",
  "Aubry",
  "Delmas",
  "Faucher",
  "Renard",
];
const CONTACT_ROLES: readonly string[] = [
  "Directeur des achats",
  "Responsable des opérations",
  "Directrice générale",
  "Responsable achats",
  "Directeur administratif et financier",
  "Chargée de développement",
  "Directeur des opérations",
];

export interface StrategicAccountIdentity {
  readonly companyName: string;
  readonly contactName: string;
  readonly contactRole: string;
}

/** Génère une identité fictive déterministe (spec §5) : même `rng` -> même identité, toujours. */
export function generateStrategicAccountIdentity(rng: Rng): StrategicAccountIdentity {
  const prefix = rng.pick(COMPANY_NAME_PREFIXES);
  const root = rng.pick(COMPANY_NAME_ROOTS);
  const suffix = rng.pick(COMPANY_NAME_SUFFIXES);
  const companyName = [prefix, root, suffix].filter((part) => part.length > 0).join(" ");
  const contactName = `${rng.pick(CONTACT_FIRST_NAMES)} ${rng.pick(CONTACT_LAST_NAMES)}`;
  const contactRole = rng.pick(CONTACT_ROLES);
  return { companyName, contactName, contactRole };
}
