import { useState } from "react";
import type { OfferAction, OfferBusinessModel, OfferPositioning } from "@founder/engine";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { generateOfferId } from "../lib/ids";
import { findOpportunity } from "../data/opportunities";
import { offerModelLabel, offerModelsForFamily } from "../data/offerModels";
import { totalFounderBusinessHours } from "../state/draft";
import { TextField } from "../components/ui/TextField";
import { NumberField } from "../components/ui/NumberField";

const POSITIONING_OPTIONS: readonly { readonly id: OfferPositioning; readonly label: string }[] = [
  { id: "economy", label: "Économique" },
  { id: "standard", label: "Standard" },
  { id: "premium", label: "Premium" },
];

/**
 * Construction d'une première offre (spec M11.2 §3.5) : nom, modèle
 * économique (vocabulaire métier), positionnement, cible, prix, + temps &
 * budget de développement du premier mois — tout en un seul écran, comme
 * `CreateBusinessScreen` le fait déjà pour infrastructure/admin/capex.
 */
export function CreateOfferScreen({ businessId }: { readonly businessId: string }) {
  const { state, setOfferActions } = useGame();
  const { navigate } = useNavigation();
  const draftBusiness = state.draft.businesses.find((b) => b.businessId === businessId) ?? null;

  const opportunity = draftBusiness ? findOpportunity(draftBusiness.family) : undefined;
  const modelOptions = draftBusiness ? offerModelsForFamily(draftBusiness.family) : [];

  const [name, setName] = useState("");
  const [businessModel, setBusinessModel] = useState<OfferBusinessModel | null>(modelOptions[0] ?? null);
  const [positioning, setPositioning] = useState<OfferPositioning>("standard");
  const [targetSegment, setTargetSegment] = useState(draftBusiness?.targetCustomers ?? "");
  const [price, setPrice] = useState(opportunity?.recommendedOfferPrice ?? 0);
  const [developmentHours, setDevelopmentHours] = useState(0);
  const [developmentBudget, setDevelopmentBudget] = useState(0);

  if (!draftBusiness || !businessModel) {
    return (
      <div className="empty-state">
        <p>Entreprise introuvable.</p>
      </div>
    );
  }

  const remainingForDevelopment = Math.max(0, state.draft.timeAllocation.business - totalFounderBusinessHours(state.draft));
  const nameIsValid = name.trim().length > 0;

  const handleCreate = () => {
    if (!nameIsValid) return;
    const offerId = generateOfferId(businessId);
    const createAction: OfferAction = {
      kind: "create",
      spec: { id: offerId, name: name.trim(), businessModel, positioning, targetSegment, price },
    };
    const actions: OfferAction[] = [createAction];
    if (developmentHours > 0 || developmentBudget > 0) {
      actions.push({ kind: "develop", offerId, hours: developmentHours, budget: developmentBudget });
    }
    setOfferActions(businessId, [...draftBusiness.offerActions, ...actions]);
    navigate({ screen: "business", businessId });
  };

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "business", businessId })}>
        ← Entreprise
      </button>
      <h1 className="screen-title">Nouvelle offre</h1>
      <p className="screen-subtitle">Construisez ce que vous allez réellement vendre : un produit ou un service, pas un chiffre.</p>

      <div className="card stack">
        <div className="section-title">Identité de l'offre</div>
        <TextField label="Nom de l'offre" value={name} onChange={setName} required hint="Ex. « Formule Essentiel », « Pack Découverte »." />
        {!nameIsValid ? <span className="text-sm" style={{ color: "var(--danger)" }}>Le nom est obligatoire.</span> : null}
        <TextField label="Cible" value={targetSegment} onChange={setTargetSegment} hint="À qui s'adresse cette offre ?" />
      </div>

      <div className="card stack">
        <div className="section-title">Type d'offre</div>
        {modelOptions.map((model) => (
          <button
            key={model}
            type="button"
            className="card card--interactive"
            style={{
              textAlign: "left",
              width: "100%",
              border: model === businessModel ? "1px solid var(--accent)" : undefined,
              background: model === businessModel ? "var(--accent-soft)" : undefined,
            }}
            onClick={() => setBusinessModel(model)}
          >
            <strong>{offerModelLabel(model, draftBusiness.family)}</strong>
          </button>
        ))}
      </div>

      <div className="card stack">
        <div className="section-title">Positionnement</div>
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
      </div>

      <div className="card stack">
        <div className="section-title">Temps & budget de développement ce mois-ci</div>
        <p className="text-sm text-secondary">
          Temps professionnel disponible pour développer cette offre : {Math.round(remainingForDevelopment)} h.
        </p>
        <NumberField label="Heures de développement" value={developmentHours} suffix="h/mois" onChange={setDevelopmentHours} max={remainingForDevelopment} />
        <NumberField label="Budget de développement" value={developmentBudget} suffix="€/mois" onChange={setDevelopmentBudget} />
      </div>

      <button className="btn btn--primary" onClick={handleCreate} disabled={!nameIsValid}>
        Créer l'offre
      </button>
    </div>
  );
}
