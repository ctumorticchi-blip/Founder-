import type { BusinessFamilyDecisions, CreateBusinessSpec, Market } from "@founder/engine";
import {
  AGENCY_MARKET,
  HOSPITALITY_MARKET,
  RETAIL_MARKET,
  SERVICE_MARKET,
  SUBSCRIPTION_MARKET,
} from "@founder/scenarios/markets.js";
import type { Purchase } from "../state/types";

/** Omit distributif : préserve les variantes discriminées de `CreateBusinessSpec` (un `Omit` simple les aplatit). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** `CreateBusinessSpec` sans `name` : le nom vient du choix du joueur, ajouté par `CreateBusinessScreen`. */
export type RecommendedCreateSpec = DistributiveOmit<CreateBusinessSpec, "name">;

/**
 * Catalogue d'opportunités proposées au joueur (spec M10 : "découvrir des
 * opportunités" / "créer une entreprise parmi les 5 familles"). Les
 * marchés viennent du moteur (src/scenarios/markets.ts, déjà utilisés par
 * les vertical slices testées) ; seuls le texte et les valeurs de départ
 * recommandées sont propres à l'UI — aucune logique économique ici, juste
 * des paramètres d'entrée pour `createBusiness`/`simulateMonth`.
 *
 * M11.1 : les recommandations de lieu de travail/administratif/investissement
 * pointent vers les catalogues `infrastructure.ts`/`adminServices.ts`/
 * `capexCatalog.ts` (choix d'entrepreneur) ; `defaultName` pré-remplit le nom
 * commercial, toujours éditable par le joueur dans `CreateBusinessScreen`.
 */
export interface Opportunity {
  readonly family: CreateBusinessSpec["family"];
  readonly title: string;
  readonly pitch: string;
  readonly icon: string;
  readonly market: Market;
  /** Nom commercial par défaut, pré-rempli dans `CreateBusinessScreen` (éditable par le joueur). */
  readonly defaultName: string;
  readonly defaultActivity: string;
  readonly defaultTargetCustomers: string;
  readonly recommendedCreateSpec: RecommendedCreateSpec;
  readonly recommendedDecisions: BusinessFamilyDecisions;
  readonly recommendedHeadcount: number;
  readonly recommendedMarketingBudget: number;
  /** Heures de prospection par défaut (spec M11.1.5 §7) : calibrées pour retrouver la cible de `recommendedDecisions` via `commercialTranslation.ts`. */
  readonly recommendedProspectionHours: number;
  readonly recommendedInfrastructureId: string;
  readonly recommendedAdminOptionalIds: readonly string[];
  readonly recommendedPurchases: readonly Purchase[];
  /** Prix suggéré pour la première offre (spec M11.2 §3.5) : repris des anciens montants recommandés (`recommendedDecisions`). */
  readonly recommendedOfferPrice: number;
}

export const OPPORTUNITIES: readonly Opportunity[] = [
  {
    family: "service",
    title: "Société de nettoyage",
    pitch: "Peu de capital pour démarrer. Vous vendez vos heures, puis celles de vos salariés.",
    icon: "🧹",
    market: SERVICE_MARKET,
    defaultName: "Clean & Co",
    defaultActivity: "Prestations de nettoyage pour particuliers et professionnels.",
    defaultTargetCustomers: "Particuliers et petites entreprises locales.",
    recommendedCreateSpec: {
      family: "service",
      marketId: SERVICE_MARKET.id,
      costPerLaborHour: 8,
      averageMonthlySalary: 2_200,
      creditLineLimit: 15_000,
      creditLineInterestRateAnnual: 0.08,
    },
    recommendedDecisions: { family: "service" },
    recommendedHeadcount: 0,
    recommendedMarketingBudget: 300,
    recommendedProspectionHours: 40,
    recommendedInfrastructureId: "domicile",
    recommendedAdminOptionalIds: [],
    recommendedPurchases: [],
    recommendedOfferPrice: 45,
  },
  {
    family: "hospitality",
    title: "Café / petit restaurant",
    pitch: "Capital de lancement plus élevé (aménagement) et personnel dès l'ouverture.",
    icon: "🍽️",
    market: HOSPITALITY_MARKET,
    defaultName: "Café des Artisans",
    defaultActivity: "Café-restaurant de quartier.",
    defaultTargetCustomers: "Habitants et travailleurs du quartier.",
    recommendedCreateSpec: {
      family: "hospitality",
      marketId: HOSPITALITY_MARKET.id,
      foodCostPerCover: 9,
      averageMonthlySalary: 2_000,
      creditLineLimit: 80_000,
      creditLineInterestRateAnnual: 0.09,
    },
    recommendedDecisions: { family: "hospitality" },
    recommendedHeadcount: 3,
    recommendedMarketingBudget: 300,
    recommendedProspectionHours: 40,
    recommendedInfrastructureId: "petit-bureau",
    recommendedAdminOptionalIds: ["conformite"],
    recommendedPurchases: [{ itemId: "materiel-pro", quantity: 1 }, { itemId: "amenagement", quantity: 1 }],
    recommendedOfferPrice: 26,
  },
  {
    family: "subscription",
    title: "Abonnement SaaS",
    pitch: "Croissance par acquisition de clients ; attention au churn et au support.",
    icon: "💻",
    market: SUBSCRIPTION_MARKET,
    defaultName: "Nimbus SaaS",
    defaultActivity: "Logiciel en ligne par abonnement.",
    defaultTargetCustomers: "Petites entreprises et indépendants.",
    recommendedCreateSpec: {
      family: "subscription",
      marketId: SUBSCRIPTION_MARKET.id,
      arpu: 29,
      churnRateBase: 0.04,
      cogsRatio: 0.2,
      initialActiveSubscribers: 0,
      averageMonthlySalary: 3_500,
      creditLineLimit: 40_000,
      creditLineInterestRateAnnual: 0.08,
    },
    recommendedDecisions: { family: "subscription" },
    recommendedHeadcount: 0,
    recommendedMarketingBudget: 500,
    recommendedProspectionHours: 40,
    recommendedInfrastructureId: "domicile",
    recommendedAdminOptionalIds: ["logiciels"],
    recommendedPurchases: [{ itemId: "ordinateur", quantity: 1 }],
    recommendedOfferPrice: 29,
  },
  {
    family: "retail",
    title: "Boutique (fleuriste, épicerie...)",
    pitch: "Vous achetez du stock et le revendez ; le trafic client fait la différence.",
    icon: "🌷",
    market: RETAIL_MARKET,
    defaultName: "Boutique Fleur de Ville",
    defaultActivity: "Vente au détail en boutique physique.",
    defaultTargetCustomers: "Particuliers du quartier, passage à pied.",
    recommendedCreateSpec: {
      family: "retail",
      marketId: RETAIL_MARKET.id,
      unitCostOfGoods: 6,
      averageMonthlySalary: 1_800,
      creditLineLimit: 20_000,
      creditLineInterestRateAnnual: 0.08,
    },
    // stockUnits <= 200 : capacité de stockage du "petit-bureau" recommandé ci-dessous (spec M11.1.5 §3.1).
    recommendedDecisions: { family: "retail", stockUnits: 150 },
    recommendedHeadcount: 0,
    recommendedMarketingBudget: 200,
    recommendedProspectionHours: 40,
    recommendedInfrastructureId: "petit-bureau",
    recommendedAdminOptionalIds: [],
    recommendedPurchases: [{ itemId: "mobilier", quantity: 1 }],
    recommendedOfferPrice: 15,
  },
  {
    family: "agency",
    title: "Agence de conseil / marketing",
    pitch: "Vous vendez des mandats ; votre réputation et votre équipe font la capacité.",
    icon: "📈",
    market: AGENCY_MARKET,
    defaultName: "Agence Horizon",
    defaultActivity: "Conseil et prestations marketing pour entreprises.",
    defaultTargetCustomers: "PME en recherche de croissance.",
    recommendedCreateSpec: {
      family: "agency",
      marketId: AGENCY_MARKET.id,
      averageMonthlyFeePerMandate: 6_000,
      deliveryCostRatio: 0.2,
      averageMonthlySalary: 3_500,
      creditLineLimit: 30_000,
      creditLineInterestRateAnnual: 0.08,
    },
    recommendedDecisions: { family: "agency" },
    recommendedHeadcount: 0,
    recommendedMarketingBudget: 300,
    recommendedProspectionHours: 40,
    recommendedInfrastructureId: "coworking",
    recommendedAdminOptionalIds: [],
    recommendedPurchases: [{ itemId: "ordinateur", quantity: 1 }],
    recommendedOfferPrice: 6_000,
  },
];

export function findOpportunity(family: string): Opportunity | undefined {
  return OPPORTUNITIES.find((opportunity) => opportunity.family === family);
}
