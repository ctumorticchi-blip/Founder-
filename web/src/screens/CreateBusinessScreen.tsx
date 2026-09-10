import { useState } from "react";
import type { BusinessFamilyDecisions, CreateBusinessSpec } from "@founder/engine";
import { findOpportunity, type RecommendedCreateSpec } from "../data/opportunities";
import { useGame } from "../state/GameProvider";
import { useNavigation } from "../state/Navigation";
import { generateBusinessId } from "../lib/ids";
import { NumberField } from "../components/ui/NumberField";
import { TextField } from "../components/ui/TextField";
import { DecisionFields } from "../components/business/DecisionFields";
import { InfrastructurePicker } from "../components/business/InfrastructurePicker";
import { AdminBreakdown } from "../components/business/AdminBreakdown";
import { CapexPicker } from "../components/business/CapexPicker";
import type { BusinessDraft, Purchase } from "../state/types";

export function CreateBusinessScreen({ family }: { readonly family: string }) {
  const opportunity = findOpportunity(family);
  const { startBusiness } = useGame();
  const { navigate } = useNavigation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [name, setName] = useState(opportunity?.defaultName ?? "");
  const [description, setDescription] = useState(opportunity?.pitch ?? "");
  const [activity, setActivity] = useState(opportunity?.defaultActivity ?? "");
  const [targetCustomers, setTargetCustomers] = useState(opportunity?.defaultTargetCustomers ?? "");
  const [salaryAndCredit, setSalaryAndCredit] = useState<RecommendedCreateSpec | null>(
    opportunity?.recommendedCreateSpec ?? null,
  );
  const [decisions, setDecisions] = useState<BusinessFamilyDecisions | null>(opportunity?.recommendedDecisions ?? null);
  const [headcount, setHeadcount] = useState(opportunity?.recommendedHeadcount ?? 0);
  const [marketingBudget, setMarketingBudget] = useState(opportunity?.recommendedMarketingBudget ?? 0);
  const [prospectionHours, setProspectionHours] = useState(opportunity?.recommendedProspectionHours ?? 0);
  const [infrastructureId, setInfrastructureId] = useState(opportunity?.recommendedInfrastructureId ?? "domicile");
  const [adminOptionalIds, setAdminOptionalIds] = useState<readonly string[]>(opportunity?.recommendedAdminOptionalIds ?? []);
  const [purchases, setPurchases] = useState<readonly Purchase[]>(opportunity?.recommendedPurchases ?? []);

  if (!opportunity || !salaryAndCredit || !decisions) {
    return (
      <div className="empty-state">
        <p>Opportunité introuvable.</p>
      </div>
    );
  }

  const nameIsValid = name.trim().length > 0;

  const handleCreate = () => {
    if (!nameIsValid) return;
    const createSpec = { ...salaryAndCredit, family: opportunity.family, name: name.trim(), marketId: opportunity.market.id } as CreateBusinessSpec;
    const draft: BusinessDraft = {
      businessId: generateBusinessId(opportunity.family),
      family: opportunity.family,
      isNew: true,
      createSpec,
      name: name.trim(),
      description,
      activity,
      targetCustomers,
      decisions,
      prospectionHours,
      founderHoursAllocated: 0, // auto-alloué par START_BUSINESS (temps professionnel restant)
      marketingBudget,
      infrastructureId,
      committedInfrastructureId: infrastructureId,
      adminOptionalIds,
      purchases,
      targetHeadcount: headcount > 0 ? headcount : null,
      capitalInjection: 0,
      propertyPurchase: null,
      saleDecision: null,
      offerActions: [],
    };
    startBusiness(draft);
    navigate({ screen: "business", businessId: draft.businessId });
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
        <div className="section-title">Identité de l'entreprise</div>
        <TextField label="Nom commercial" value={name} onChange={setName} required hint="Le nom qui apparaîtra partout dans le jeu." />
        {!nameIsValid ? <span className="text-sm" style={{ color: "var(--danger)" }}>Le nom est obligatoire.</span> : null}
        <TextField label="Description" value={description} onChange={setDescription} />
        <TextField label="Activité" value={activity} onChange={setActivity} />
        <TextField label="Clientèle cible" value={targetCustomers} onChange={setTargetCustomers} />
      </div>

      <div className="card stack">
        <div className="section-title">Paramètres de lancement</div>
        <DecisionFields decisions={decisions} onChange={setDecisions} hasLaunchedOffer={false} />
        <NumberField
          label="Temps de prospection"
          value={prospectionHours}
          suffix="h/mois"
          onChange={setProspectionHours}
          hint="Le temps que vous consacrez à trouver des clients, en plus de la production."
        />
        <NumberField label="Effectif au lancement" value={headcount} onChange={setHeadcount} hint="0 = vous démarrez seul(e)." />
        <NumberField label="Budget marketing" value={marketingBudget} suffix="€/mois" onChange={setMarketingBudget} />
      </div>

      <div className="card">
        <InfrastructurePicker family={opportunity.family} selectedId={infrastructureId} isNew onChange={setInfrastructureId} />
      </div>

      <div className="card">
        <AdminBreakdown optionalIds={adminOptionalIds} onChange={setAdminOptionalIds} />
      </div>

      <div className="card">
        <CapexPicker purchases={purchases} onChange={setPurchases} />
      </div>

      <button className="btn btn--ghost" onClick={() => setShowAdvanced((value) => !value)}>
        {showAdvanced ? "Masquer les paramètres avancés" : "Paramètres avancés"}
      </button>

      {showAdvanced ? (
        <div className="card stack">
          <NumberField
            label="Ligne de crédit"
            value={salaryAndCredit.creditLineLimit}
            suffix="€"
            onChange={(creditLineLimit) => setSalaryAndCredit({ ...salaryAndCredit, creditLineLimit })}
          />
          <NumberField
            label="Taux d'intérêt annuel"
            value={salaryAndCredit.creditLineInterestRateAnnual}
            step={0.01}
            hint="Ex. 0,08 = 8 %/an"
            onChange={(creditLineInterestRateAnnual) => setSalaryAndCredit({ ...salaryAndCredit, creditLineInterestRateAnnual })}
          />
          <NumberField
            label="Salaire mensuel moyen"
            value={salaryAndCredit.averageMonthlySalary}
            suffix="€/salarié"
            onChange={(averageMonthlySalary) => setSalaryAndCredit({ ...salaryAndCredit, averageMonthlySalary })}
          />
        </div>
      ) : null}

      <button className="btn btn--primary" onClick={handleCreate} disabled={!nameIsValid}>
        Lancer l'entreprise
      </button>
    </div>
  );
}
