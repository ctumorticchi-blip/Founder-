import type { BusinessFamilyDecisions, CreateBusinessSpec, Market } from "@founder/engine";
import {
  AGENCY_MARKET,
  HOSPITALITY_MARKET,
  RETAIL_MARKET,
  SERVICE_MARKET,
  SUBSCRIPTION_MARKET,
} from "@founder/scenarios/markets.js";

/**
 * Catalogue d'opportunités proposées au joueur (spec M10 : "découvrir des
 * opportunités" / "créer une entreprise parmi les 5 familles"). Les
 * marchés viennent du moteur (src/scenarios/markets.ts, déjà utilisés par
 * les vertical slices testées) ; seuls le texte et les valeurs de départ
 * recommandées sont propres à l'UI — aucune logique économique ici, juste
 * des paramètres d'entrée pour `createBusiness`/`simulateMonth`.
 */
export interface Opportunity {
  readonly family: CreateBusinessSpec["family"];
  readonly title: string;
  readonly pitch: string;
  readonly icon: string;
  readonly market: Market;
  readonly recommendedCreateSpec: CreateBusinessSpec;
  readonly recommendedDecisions: BusinessFamilyDecisions;
  readonly recommendedHeadcount: number;
  readonly recommendedBudgets: {
    readonly marketingBudget: number;
    readonly rentBudget: number;
    readonly adminBudget: number;
    readonly capex: number;
  };
}

export const OPPORTUNITIES: readonly Opportunity[] = [
  {
    family: "service",
    title: "Société de nettoyage",
    pitch: "Peu de capital pour démarrer. Vous vendez vos heures, puis celles de vos salariés.",
    icon: "🧹",
    market: SERVICE_MARKET,
    recommendedCreateSpec: {
      family: "service",
      marketId: SERVICE_MARKET.id,
      costPerLaborHour: 8,
      averageMonthlySalary: 2_200,
      creditLineLimit: 15_000,
      creditLineInterestRateAnnual: 0.08,
    },
    recommendedDecisions: { family: "service", price: 45, targetHours: 400 },
    recommendedHeadcount: 0,
    recommendedBudgets: { marketingBudget: 300, rentBudget: 400, adminBudget: 150, capex: 0 },
  },
  {
    family: "hospitality",
    title: "Café / petit restaurant",
    pitch: "Capital de lancement plus élevé (aménagement) et personnel dès l'ouverture.",
    icon: "🍽️",
    market: HOSPITALITY_MARKET,
    recommendedCreateSpec: {
      family: "hospitality",
      marketId: HOSPITALITY_MARKET.id,
      foodCostPerCover: 9,
      averageMonthlySalary: 2_000,
      creditLineLimit: 80_000,
      creditLineInterestRateAnnual: 0.09,
    },
    recommendedDecisions: { family: "hospitality", averageTicketPrice: 26, expectedDemandCovers: 1_500 },
    recommendedHeadcount: 3,
    recommendedBudgets: { marketingBudget: 300, rentBudget: 1_500, adminBudget: 200, capex: 40_000 },
  },
  {
    family: "subscription",
    title: "Abonnement SaaS",
    pitch: "Croissance par acquisition de clients ; attention au churn et au support.",
    icon: "💻",
    market: SUBSCRIPTION_MARKET,
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
    recommendedDecisions: { family: "subscription", newSubscribers: 40 },
    recommendedHeadcount: 0,
    recommendedBudgets: { marketingBudget: 500, rentBudget: 300, adminBudget: 200, capex: 0 },
  },
  {
    family: "retail",
    title: "Boutique (fleuriste, épicerie...)",
    pitch: "Vous achetez du stock et le revendez ; le trafic client fait la différence.",
    icon: "🌷",
    market: RETAIL_MARKET,
    recommendedCreateSpec: {
      family: "retail",
      marketId: RETAIL_MARKET.id,
      unitCostOfGoods: 6,
      averageMonthlySalary: 1_800,
      creditLineLimit: 20_000,
      creditLineInterestRateAnnual: 0.08,
    },
    recommendedDecisions: { family: "retail", unitPrice: 15, stockUnits: 600, expectedFootTraffic: 2_500 },
    recommendedHeadcount: 0,
    recommendedBudgets: { marketingBudget: 200, rentBudget: 500, adminBudget: 100, capex: 0 },
  },
  {
    family: "agency",
    title: "Agence de conseil / marketing",
    pitch: "Vous vendez des mandats ; votre réputation et votre équipe font la capacité.",
    icon: "📈",
    market: AGENCY_MARKET,
    recommendedCreateSpec: {
      family: "agency",
      marketId: AGENCY_MARKET.id,
      averageMonthlyFeePerMandate: 6_000,
      deliveryCostRatio: 0.2,
      averageMonthlySalary: 3_500,
      creditLineLimit: 30_000,
      creditLineInterestRateAnnual: 0.08,
    },
    recommendedDecisions: { family: "agency", targetMandates: 20 },
    recommendedHeadcount: 0,
    recommendedBudgets: { marketingBudget: 300, rentBudget: 400, adminBudget: 150, capex: 0 },
  },
];

export function findOpportunity(family: string): Opportunity | undefined {
  return OPPORTUNITIES.find((opportunity) => opportunity.family === family);
}
