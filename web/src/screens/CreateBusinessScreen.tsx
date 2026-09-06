import { useState } from "react";
import type { BusinessFamilyDecisions, CreateBusinessSpec } from "@founder/engine";
import { findOpportunity } from "../data/opportunities";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { generateBusinessId } from "../lib/ids";
import { NumberField } from "../components/ui/NumberField";
import { DecisionFields } from "../components/business/DecisionFields";
import type { BusinessDraft } from "../state/types";

type Budgets = { marketingBudget: number; rentBudget: number; adminBudget: number; capex: number };

export function CreateBusinessScreen({ family }: { readonly family: string }) {
  const opportunity = findOpportunity(family);
  const { startBusiness } = useGame();
  const { navigate } = useNavigation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [createSpec, setCreateSpec] = useState<CreateBusinessSpec | null>(opportunity?.recommendedCreateSpec ?? null);
  const [decisions, setDecisions] = useState<BusinessFamilyDecisions | null>(opportunity?.recommendedDecisions ?? null);
  const [budgets, setBudgets] = useState<Budgets | null>(opportunity?.recommendedBudgets ?? null);
  const [headcount, setHeadcount] = useState(opportunity?.recommendedHeadcount ?? 0);

  if (!opportunity || !createSpec || !decisions || !budgets) {
    return (
      <div className="empty-state">
        <p>Opportunité introuvable.</p>
      </div>
    );
  }

  const handleCreate = () => {
    const draft: BusinessDraft = {
      businessId: generateBusinessId(opportunity.family),
      family: opportunity.family,
      isNew: true,
      createSpec: { ...createSpec, marketId: opportunity.market.id },
      decisions,
      marketingBudget: budgets.marketingBudget,
      rentBudget: budgets.rentBudget,
      adminBudget: budgets.adminBudget,
      capex: budgets.capex,
      targetHeadcount: headcount > 0 ? headcount : null,
      capitalInjection: 0,
    };
    startBusiness(draft);
    navigate({ screen: "business" });
  };

  return (
    <div className="stack">
      <button className="top-back" onClick={() => navigate({ screen: "opportunities" })}>
        ← Opportunités
      </button>
      <div>
        <span style={{ fontSize: 36 }}>{opportunity.icon}</span>
        <h1 className="screen-title" style={{ marginTop: 8 }}>
          {opportunity.title}
        </h1>
        <p className="screen-subtitle">{opportunity.pitch}</p>
      </div>

      <div className="card stack">
        <div className="section-title">Paramètres de lancement</div>
        <DecisionFields decisions={decisions} onChange={setDecisions} />
        <NumberField label="Effectif au lancement" value={headcount} onChange={setHeadcount} hint="0 = vous démarrez seul(e)." />
        <NumberField label="Budget marketing" value={budgets.marketingBudget} suffix="€/mois" onChange={(marketingBudget) => setBudgets({ ...budgets, marketingBudget })} />
        <NumberField label="Loyer" value={budgets.rentBudget} suffix="€/mois" onChange={(rentBudget) => setBudgets({ ...budgets, rentBudget })} />
        {budgets.capex > 0 ? (
          <NumberField label="Investissement de lancement" value={budgets.capex} suffix="€, une fois" onChange={(capex) => setBudgets({ ...budgets, capex })} />
        ) : null}
      </div>

      <button className="btn btn--ghost" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Masquer les paramètres avancés" : "Paramètres avancés"}
      </button>

      {showAdvanced ? (
        <div className="card stack">
          <NumberField label="Ligne de crédit" value={createSpec.creditLineLimit} suffix="€" onChange={(creditLineLimit) => setCreateSpec({ ...createSpec, creditLineLimit })} />
          <NumberField
            label="Taux d'intérêt annuel"
            value={createSpec.creditLineInterestRateAnnual}
            step={0.01}
            hint="Ex. 0,08 = 8 %/an"
            onChange={(creditLineInterestRateAnnual) => setCreateSpec({ ...createSpec, creditLineInterestRateAnnual })}
          />
          <NumberField label="Budget administratif" value={budgets.adminBudget} suffix="€/mois" onChange={(adminBudget) => setBudgets({ ...budgets, adminBudget })} />
          <NumberField
            label="Salaire mensuel moyen"
            value={createSpec.averageMonthlySalary}
            suffix="€/salarié"
            onChange={(averageMonthlySalary) => setCreateSpec({ ...createSpec, averageMonthlySalary })}
          />
        </div>
      ) : null}

      <button className="btn btn--primary" onClick={handleCreate}>
        Lancer l'entreprise
      </button>
    </div>
  );
}
