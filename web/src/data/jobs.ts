/**
 * Offres d'emploi proposées à un joueur de 18 ans sans diplôme. Le moteur
 * n'a pas de marché du travail simulé (le salaire horaire est un simple
 * paramètre de décision) : cette liste est un habillage éditorial côté UI
 * qui borne les choix à des valeurs réalistes pour le profil de départ.
 */
export interface JobOffer {
  readonly id: string;
  readonly label: string;
  readonly hourlyWage: number;
  readonly description: string;
}

export const JOB_OFFERS: readonly JobOffer[] = [
  { id: "vendeur", label: "Vendeur en supermarché", hourlyWage: 11, description: "Horaires flexibles, accessible sans expérience." },
  { id: "livreur", label: "Livreur à vélo", hourlyWage: 12, description: "Mieux payé, plus fatigant, dépend de la météo." },
  { id: "serveur", label: "Serveur en café", hourlyWage: 11.5, description: "Pourboires possibles, bon contact clientèle." },
  { id: "teleconseiller", label: "Téléconseiller", hourlyWage: 11.8, description: "Assis, répétitif, mais stable." },
];
