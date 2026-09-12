import type { GameState } from "@founder/engine";
import { activeDiagnosisLines } from "../data/satisfactionLabels";
import type { BusinessIdentity } from "./types";

export interface BusinessNarrative {
  readonly businessId: string;
  readonly displayName: string;
  readonly sentences: readonly string[];
}

/** Écart de réputation en-dessous duquel on ne narre rien (bruit d'affichage, pas un vrai mouvement). */
const REPUTATION_NARRATIVE_EPSILON = 0.002;

/**
 * Agrège la mémoire client de toutes les offres lancées d'une entreprise
 * (spec M11.2.3 §16) : le récap parle de l'ENTREPRISE, jamais offre par
 * offre — chaque offre garde sa mémoire séparée en interne (spec §14),
 * seule cette narration les combine pour l'affichage.
 */
function aggregateAcrossOffers(business: GameState["businesses"][number]) {
  const allMemory = business.business.offers.flatMap((offer) => offer.customerMemory);
  const newThisMonth = allMemory.reduce((sum, m) => sum + m.newVolumeThisMonth, 0);
  const recurrentThisMonth = allMemory.reduce((sum, m) => sum + m.retainedVolumeThisMonth, 0);
  const dominant = allMemory.length > 0 ? allMemory.reduce((a, b) => (b.retainedBaseVolume > a.retainedBaseVolume ? b : a)) : null;
  return { newThisMonth, recurrentThisMonth, dominant };
}

/**
 * Narration causale par entreprise (spec M11.2.3 §16) : jamais de simples
 * nombres, toujours une conséquence dérivée de grandeurs déjà calculées par
 * le moteur (mémoire client, diagnostic de satisfaction, réputation) —
 * jamais une explication reconstruite après coup. Pure, déterministe.
 */
export function computeBusinessNarratives(
  prev: GameState,
  next: GameState,
  businessIdentities: Readonly<Record<string, BusinessIdentity>>,
): readonly BusinessNarrative[] {
  const prevById = new Map(prev.businesses.map((b) => [b.id, b]));

  const narratives: BusinessNarrative[] = [];
  for (const business of next.businesses) {
    const displayName = businessIdentities[business.id]?.displayName ?? business.business.name;
    const { newThisMonth, recurrentThisMonth, dominant } = aggregateAcrossOffers(business);
    const sentences: string[] = [];

    if (newThisMonth >= 1) {
      sentences.push(`${displayName} a gagné ${Math.round(newThisMonth).toLocaleString("fr-FR")} nouveaux clients ce mois-ci.`);
    } else if (recurrentThisMonth >= 1) {
      sentences.push(`${displayName} a été portée par ${Math.round(recurrentThisMonth).toLocaleString("fr-FR")} clients fidèles ce mois-ci.`);
    }

    const prevBusiness = prevById.get(business.id);
    if (prevBusiness && prevBusiness.familyState.family === business.familyState.family) {
      const delta = business.familyState.reputationScore - prevBusiness.familyState.reputationScore;
      if (delta > REPUTATION_NARRATIVE_EPSILON) {
        sentences.push("Sa réputation progresse, portée par une expérience client satisfaisante.");
      } else if (delta < -REPUTATION_NARRATIVE_EPSILON) {
        sentences.push("Sa réputation recule : l'expérience délivrée déçoit une partie de la clientèle.");
      }
    }

    if (dominant?.lastDiagnosis) {
      const lines = activeDiagnosisLines(dominant.lastDiagnosis);
      if (lines.length > 0) {
        sentences.push(lines.map((line) => line.label).join(", ") + ".");
      }
    }

    if (sentences.length > 0) {
      narratives.push({ businessId: business.id, displayName, sentences });
    }
  }
  return narratives;
}
