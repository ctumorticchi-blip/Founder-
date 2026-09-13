# FOUNDER_ROADMAP.md — Feuille de route

Ce document liste l'ordre de dépendance des milestones. Le découpage
local d'un milestone en sous-tranches est une décision autonome
(`CLAUDE.md`) ; **sauter une dépendance ne l'est pas**.

## Terminé (vérifié par `git log`, pas par mémoire de session)

P0 → M10 : noyau déterministe, modèles financiers/économiques des 5
familles, marché/concurrence/information imparfaite, boucle mensuelle +
narrative, employés, trésorerie réaliste, orchestrateur
multi-entreprises, vertical slices + CLI headless, première web app
mobile-first.

- M11.1 — Business Identity & Explainable Costs
- M11.1.5 — Constraints, Property & Ownership
- M11.2.1 — Offer Engine
- M11.2.2 — Customer & Demand Engine
- M11.2.3 — Satisfaction & Retention
- M11.2.3.1 — True Repeat Demand
- M11.2.3.2 — Demand Execution Cleanup
- M11.2.4 — Strategic Accounts : spec de conception validée
  (`docs/superpowers/specs/2026-09-12-founder-m11.2.4-strategic-accounts-design.md`,
  corrigée au commit `58d080f`)
- M11.2.4.1 — Strategic Account Core : plan d'implémentation validé
  (`docs/superpowers/plans/2026-09-13-founder-m11.2.4.1-strategic-account-core.md`,
  corrigé au commit `2e225a9`) — **implémentation en cours, voir
  `FOUNDER_STATE.md` pour l'état exact.**

## Actif — Strategic Accounts (M11.2.4)

1. **M11.2.4.1 — Strategic Account Core** — identité + éligibilité par
   (offre, segment) + apparition seedée d'opportunités + persistance +
   écran consultatif. Aucun effet économique.
2. **M11.2.4.2 — Prospecting & Negotiation** — temps fondateur par
   opportunité, information imparfaite progressive, négociation
   accept/counter/reject, contrat signé mais encore sans effet sur
   `businessResolution.ts`.
3. **M11.2.4.3 — Contract Execution** — intégration réelle dans
   `computeTotalDemand`/l'allocation de capacité à 3 flux sans priorité
   cachée (patron déjà spécifié, spec §2-§3) — CA/coûts réels.
4. **M11.2.4.4 — Relationship & Concentration** — satisfaction/confiance
   de compte, concentration/dépendance, écran complet.
5. **M11.2.4.5 — Renewal & Loss** — pouvoir de négociation, renouvellement
   dynamique, départ réel d'un compte, narration causale.

## Ensuite

6. **M11.2.5 — Competitive Market** — au-delà de la concurrence agrégée
   niveau 1 actuelle (`AggregateCompetition`) : concurrents identifiés
   réels, alternatives disponibles réellement modélisées.
7. **M11.2.6 — Market Intelligence & UX** — consolidation de
   l'information imparfaite/UX autour du marché et des comptes.
8. **M11.3 — Sales & Marketing** — au-delà de la demande organique/
   contractuelle actuelle : leviers commerciaux/marketing plus riches.
9. **M11.4 — Organisation & Delegation** — doit notamment aller vers :
   - suppression du plafond artificiel des 25 salariés ;
   - recrutement individuel au début, puis recrutement par équipes/bulk
     à plus grande échelle ;
   - capacité managériale réelle ;
   - équipes/départements ;
   - managers avec autonomie partielle ;
   - puis CEO autonomes à l'intérieur d'objectifs, budgets et niveau de
     risque définis par le propriétaire (le joueur).
   Les mauvaises décisions de managers/CEO doivent être causées par
   compétence/information/instructions/contexte — jamais par une RNG
   arbitraire destinée à punir le joueur.

## Direction ultérieure (non planifiée en détail, ne pas construire en avance)

Propriété & allocation de capital (dividendes/distributions simples
d'abord, arbitrage garder/réinvestir/rembourser dette/distribuer,
patrimoine personnel qui reçoit les distributions, puis fiscalité/
actionnaires/gouvernance), fusions-acquisitions, groupes/filiales,
investisseurs, expansion internationale, marchés publics/IPO, pouvoir/
lobbying/gouvernance le cas échéant. Ces sujets sont une direction
assumée de la vision (`FOUNDER_VISION.md`), pas un plan — ne jamais les
implémenter par anticipation avant leur tour dans cette feuille de
route.

## Règle de dépendance

Chaque milestone ci-dessus suppose le précédent livré et vert. Ne jamais
commencer un milestone plus loin dans la liste parce qu'il semble plus
intéressant — sauter une dépendance change silencieusement l'ordre de
complexité progressive que `FOUNDER_VISION.md` impose.
