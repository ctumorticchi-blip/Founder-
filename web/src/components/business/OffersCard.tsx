import type { EconomicFamily, Offer, OfferAction } from "@founder/engine";
import { useNavigation } from "../../state/Navigation";
import { demandSignalLabel, offerModelLabel } from "../../data/offerModels";
import { Money } from "../ui/Money";

/**
 * Offres d'une entreprise (spec M11.2 §3.5) : liste compacte + accès à la
 * fiche de chacune. Les offres créées ce mois-ci n'existent pas encore
 * côté moteur (`gameState`) — affichées comme "en attente", même motif que
 * la création d'entreprise elle-même (spec M11.1).
 */
export function OffersCard({
  businessId,
  family,
  offers,
  pendingCreateActions,
}: {
  readonly businessId: string;
  readonly family: EconomicFamily;
  readonly offers: readonly Offer[];
  readonly pendingCreateActions: readonly OfferAction[];
}) {
  const { navigate } = useNavigation();
  const pendingCreations = pendingCreateActions.filter((a): a is Extract<OfferAction, { kind: "create" }> => a.kind === "create");

  return (
    <div className="card stack">
      <div className="section-title">Offres</div>
      {offers.length === 0 && pendingCreations.length === 0 ? (
        <p className="text-sm text-secondary">
          Vous n'avez pas encore construit d'offre : sans offre lancée, votre entreprise ne vend rien. Construisez-en une pour fixer votre prix.
        </p>
      ) : (
        <div className="stack stack--tight">
          {offers.map((offer) => (
            <button
              key={offer.id}
              type="button"
              className="card card--interactive"
              style={{ textAlign: "left", width: "100%" }}
              onClick={() => navigate({ screen: "offer", businessId, offerId: offer.id })}
            >
              <div className="row row--between">
                <strong>{offer.name}</strong>
                <span className="pill">{offer.status === "launched" ? "Lancée" : `${Math.round(offer.maturity)}% développée`}</span>
              </div>
              <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                {offerModelLabel(offer.businessModel, family)} · <Money amount={offer.price} />
                {offer.lastDemand ? ` · Demande ${demandSignalLabel(offer.lastDemand.demandSignal)}` : ""}
              </p>
            </button>
          ))}
          {pendingCreations.map((action) => (
            <div key={action.spec.id} className="card" style={{ opacity: 0.7 }}>
              <div className="row row--between">
                <strong>{action.spec.name}</strong>
                <span className="pill">En attente</span>
              </div>
              <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                🚀 Sera officiellement créée à la fin de ce mois.
              </p>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn--secondary" onClick={() => navigate({ screen: "createOffer", businessId })}>
        + Nouvelle offre
      </button>
    </div>
  );
}
