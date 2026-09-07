import { useState } from "react";
import type { SaleProcessState } from "@founder/engine";
import type { ValuationResult } from "@founder/engine";
import { formatMoney } from "../../lib/format";
import { Money } from "../ui/Money";
import { NumberField } from "../ui/NumberField";

/**
 * Cession d'entreprise (spec M11.1.5 §6) : une valorisation est une
 * estimation, jamais une liquidité automatique — il faut un acquéreur, une
 * probabilité de transaction, un délai. Ce panneau n'affiche jamais de
 * bouton "vendre" qui transformerait la valorisation en cash instantané.
 */
export function SalePanel({
  valuation,
  saleProcess,
  hasPendingDecision,
  onList,
  onWithdraw,
  onAccept,
  onReject,
  onCounter,
}: {
  readonly valuation: ValuationResult;
  readonly saleProcess: SaleProcessState | null;
  readonly hasPendingDecision: boolean;
  readonly onList: () => void;
  readonly onWithdraw: () => void;
  readonly onAccept: () => void;
  readonly onReject: () => void;
  readonly onCounter: (amount: number) => void;
}) {
  const [showFactors, setShowFactors] = useState(false);
  const [counterAmount, setCounterAmount] = useState(Math.round(valuation.mid));

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <div className="section-title" style={{ marginBottom: 0 }}>
          Valorisation & cession
        </div>
      </div>

      <div className="row row--between">
        <span className="text-sm text-secondary">Valorisation indicative</span>
        <span className="text-sm" style={{ fontWeight: 700 }}>
          <Money amount={valuation.low} /> – <Money amount={valuation.high} />
        </span>
      </div>

      <button className="btn btn--ghost" onClick={() => setShowFactors((value) => !value)}>
        {showFactors ? "Masquer les facteurs" : "Pourquoi cette entreprise vaut environ ce prix ?"}
      </button>
      {showFactors ? (
        <div className="stack stack--tight">
          {valuation.factors.map((factor, index) => (
            <div className="row row--between" key={`${factor.label}-${index}`}>
              <span className="text-tertiary text-sm">{factor.label}</span>
              <span className="text-sm">
                <Money amount={factor.amount} signed />
              </span>
            </div>
          ))}
          <p className="text-tertiary text-sm">
            Une valorisation est une estimation, pas une liquidité : elle ne se transforme en cash que si un
            acquéreur se présente et qu'une vente se conclut réellement.
          </p>
        </div>
      ) : null}

      {!saleProcess ? (
        <button className="btn btn--secondary" onClick={onList} disabled={hasPendingDecision}>
          Mettre en vente
        </button>
      ) : saleProcess.status === "listed" ? (
        <div className="stack stack--tight">
          <p className="text-sm text-secondary">
            En recherche d'acheteur depuis {saleProcess.monthsListed} mois{saleProcess.monthsListed >= 1 ? "" : ""}. Cela
            peut prendre du temps — une entreprise fragile peut ne trouver aucun acquéreur.
          </p>
          <button className="btn btn--ghost" onClick={onWithdraw} disabled={hasPendingDecision}>
            Retirer de la vente
          </button>
        </div>
      ) : saleProcess.status === "offer-pending" && saleProcess.currentOffer ? (
        <div className="stack stack--tight">
          <div className="pill pill--accent">Offre reçue : {formatMoney(saleProcess.currentOffer.amount)}</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--primary" onClick={onAccept} disabled={hasPendingDecision}>
              Accepter
            </button>
            <button className="btn btn--secondary" onClick={onReject} disabled={hasPendingDecision}>
              Refuser
            </button>
          </div>
          <NumberField label="Contre-offre" value={counterAmount} suffix="€" onChange={setCounterAmount} />
          <button className="btn btn--ghost" onClick={() => onCounter(counterAmount)} disabled={hasPendingDecision}>
            Envoyer la contre-offre
          </button>
        </div>
      ) : (
        <p className="text-sm text-secondary">Processus de cession terminé.</p>
      )}
    </div>
  );
}
