import { useState } from "react";
import type { OfferAction, OfferPositioning } from "@founder/engine";
import { computeLaunchThreshold } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { offerModelLabel, offerQualityLabel } from "../data/offerModels";
import { totalFounderBusinessHours } from "../state/draft";
import { NumberField } from "../components/ui/NumberField";

const POSITIONING_OPTIONS: readonly { readonly id: OfferPositioning; readonly label: string }[] = [
  { id: "economy", label: "Économique" },
  { id: "standard", label: "Standard" },
  { id: "premium", label: "Premium" },
];

/** Remplace toute action antérieure du même type sur la même offre par la nouvelle (évite d'empiler deux "develop" le même mois). */
function replaceOfferAction(actions: readonly OfferAction[], offerId: string, next: OfferAction): readonly OfferAction[] {
  return [...actions.filter((a) => !("offerId" in a && a.offerId === offerId && a.kind === next.kind)), next];
}

/**
 * Fiche d'une offre existante (spec M11.2 §3.5) : lit l'état réel depuis
 * `gameState` (jamais depuis le brouillon, qui ne porte que des actions en
 * attente) — barre de maturité + lancement si en développement, barre de
 * qualité + amélioration si lancée, prix/positionnement toujours éditables.
 */
export function OfferScreen({ businessId, offerId }: { readonly businessId: string; readonly offerId: string }) {
  const { state, setOfferActions } = useGame();
  const { navigate } = useNavigation();
  const gameState = state.gameState;
  const draftBusiness = state.draft.businesses.find((b) => b.businessId === businessId) ?? null;
  const business = gameState?.businesses.find((b) => b.id === businessId) ?? null;
  const offer = business?.business.offers.find((o) => o.id === offerId) ?? null;

  const [price, setPrice] = useState(offer?.price ?? 0);
  const [positioning, setPositioning] = useState<OfferPositioning>(offer?.positioning ?? "standard");
  const [developmentHours, setDevelopmentHours] = useState(0);
  const [developmentBudget, setDevelopmentBudget] = useState(0);

  if (!draftBusiness || !offer) {
    return (
      <div className="empty-state">
        <p>Offre introuvable.</p>
      </div>
    );
  }

  const pendingLaunch = draftBusiness.offerActions.some((a) => a.kind === "launch" && a.offerId === offerId);
  const threshold = computeLaunchThreshold(offer.businessModel);
  const canLaunch = offer.status === "in-development" && offer.maturity >= threshold && !pendingLaunch;
  const remainingForDevelopment = Math.max(0, state.draft.timeAllocation.business - totalFounderBusinessHours(state.draft));

  const queueDevelop = () => {
    if (developmentHours <= 0 && developmentBudget <= 0) return;
    setOfferActions(
      businessId,
      replaceOfferAction(draftBusiness.offerActions, offerId, { kind: "develop", offerId, hours: developmentHours, budget: developmentBudget }),
    );
    setDevelopmentHours(0);
    setDevelopmentBudget(0);
  };

  const queuePricing = () => {
    setOfferActions(businessId, replaceOfferAction(draftBusiness.offerActions, offerId, { kind: "update-pricing", offerId, price, positioning }));
  };

  const queueLaunch = () => {
    setOfferActions(businessId, replaceOfferAction(draftBusiness.offerActions, offerId, { kind: "launch", offerId }));
  };

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "business", businessId })}>
        ← Entreprise
      </button>
      <div className="row row--between">
        <h1 className="screen-title" style={{ marginBottom: 0 }}>{offer.name}</h1>
        <span className={`pill${offer.status === "launched" ? " pill--accent" : ""}`}>
          {offer.status === "launched" ? "Lancée" : "En développement"}
        </span>
      </div>
      <p className="screen-subtitle">{offerModelLabel(offer.businessModel, draftBusiness.family)} · {offer.targetSegment}</p>

      {offer.status === "in-development" ? (
        <div className="card stack">
          <div className="section-title">Développement</div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Maturité</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>
              {Math.round(offer.maturity)}% {threshold > 0 ? `— ${threshold}% requis pour lancer` : ""}
            </span>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 999, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, offer.maturity)}%`, background: "var(--accent)", height: "100%" }} />
          </div>
          {pendingLaunch ? (
            <p className="text-sm text-secondary">🚀 Lancement prévu à la fin de ce mois.</p>
          ) : (
            <button className="btn btn--primary" onClick={queueLaunch} disabled={!canLaunch}>
              Lancer l'offre
            </button>
          )}
          {!canLaunch && !pendingLaunch ? (
            <p className="text-sm text-secondary">
              Développement insuffisant ({Math.round(offer.maturity)}% / {threshold}% requis). Continuez à investir du temps et de l'argent ci-dessous.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="card stack">
          <div className="section-title">{offerQualityLabel(draftBusiness.family)}</div>
          <div className="row row--between">
            <span className="text-sm text-secondary">Niveau actuel</span>
            <span className="text-sm" style={{ fontWeight: 700 }}>{Math.round(offer.qualityLevel)}%</span>
          </div>
          <div style={{ background: "var(--bg-elevated)", borderRadius: 999, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, offer.qualityLevel)}%`, background: "var(--accent)", height: "100%" }} />
          </div>
        </div>
      )}

      <div className="card stack">
        <div className="section-title">{offer.status === "launched" ? "Améliorer l'offre" : "Investir dans le développement"}</div>
        <p className="text-sm text-secondary">Temps professionnel disponible : {Math.round(remainingForDevelopment)} h.</p>
        <NumberField label="Heures ce mois-ci" value={developmentHours} suffix="h/mois" onChange={setDevelopmentHours} max={remainingForDevelopment} />
        <NumberField label="Budget ce mois-ci" value={developmentBudget} suffix="€/mois" onChange={setDevelopmentBudget} />
        <button className="btn btn--secondary" onClick={queueDevelop} disabled={developmentHours <= 0 && developmentBudget <= 0}>
          Investir ce mois-ci
        </button>
      </div>

      <div className="card stack">
        <div className="section-title">Prix & positionnement</div>
        <div className="row" style={{ gap: 8 }}>
          {POSITIONING_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`pill${option.id === positioning ? " pill--accent" : ""}`}
              onClick={() => setPositioning(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <NumberField label="Prix" value={price} suffix="€" onChange={setPrice} />
        <button className="btn btn--ghost" onClick={queuePricing} disabled={price === offer.price && positioning === offer.positioning}>
          Mettre à jour
        </button>
      </div>
    </div>
  );
}
