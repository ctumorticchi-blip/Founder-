# FOUNDER_STATE.md — État courant du projet

Ce fichier est mis à jour après CHAQUE tranche vérifiée verte, poussée
sur `main`. En cas de divergence avec le code réel, le code réel gagne
(`CLAUDE.md`) — corriger ce fichier plutôt que de lui faire confiance
aveuglément.

## Base verte courante

Branche : `main`
Dernier commit vérifié au moment de la rédaction de cette version :
`7689327` — M11.2.4.2 (Prospecting & Negotiation) intégralement livré
et vert.

## Milestone actif

**M11.2.4.2 — Prospecting & Negotiation : TERMINÉ.**
Prochain milestone à démarrer : **M11.2.4.3 — Contract Execution**
(`FOUNDER_ROADMAP.md`).

## M11.2.4.1 — récapitulatif (terminé, non re-détaillé ici)

7 tâches TDD livrées (types, catalogue d'identités, moteur d'apparition
d'opportunités avec éligibilité stricte par `offer.targetSegment`,
intégration mensuelle, migration, écran consultatif, vérification
finale). Playtest mobile réel réussi. Voir l'historique git
(`28b83e0`..`0757f1c`) pour le détail commit par commit.

## M11.2.4.2 — récapitulatif de livraison

Plan : `docs/superpowers/plans/2026-09-13-founder-m11.2.4.2-prospecting-negotiation.md`.
6 tâches TDD livrées, chacune commit+push séparément :

1. `2265600` — `AccountProposal`/`AccountNegotiationDecision`/
   `AccountContract`/`StrategicAccountAction` (types) ; budget réel du
   compte dérivé à la demande (`deriveTrueOpportunityBudget`, jamais
   persisté) ; estimation bruitée réutilisant `estimate()`
   d'`intelligence.ts` (exportée pour l'occasion) — le nombre d'heures de
   recherche investies fait office de "compétence équivalente" 0-100.
2. `42f7b3f` — `resolveAccountNegotiationDecision` (déterministe :
   accept/counter/withdraw comparés au budget réel, jamais un jet de
   probabilité sur l'issue) + `applyResearchHours`/
   `applyStrategicAccountActions`.
3. (fondu dans 2265600/42f7b3f) intégration mensuelle :
   `BusinessAction.strategicAccountActions`, heures `invest-time`
   comptées dans le même budget de temps fondateur partagé que
   `founderHoursAllocated`/`offerActions.develop` (`validateActions`),
   appliquées dans `simulateMonth.ts` avant l'apparition de nouvelles
   opportunités — `businessResolution.ts` toujours totalement intouché
   (confirmé par `git diff --stat` vide sur ce fichier).
4. `3be0a12` — migration défensive des 4 nouveaux champs d'opportunité
   (`researchHoursInvested ?? 0`, `lastAccountProposal`/`contract ?? null`,
   `budgetEstimate` recalculé via `computeBudgetEstimate` si absent).
5. `7689327` — UI de négociation complète (investir du temps, proposer/
   contre-proposer/accepter/abandonner, fourchettes formatées jamais de
   valeur brute) + plomberie draft complète en miroir du patron
   `offerActions` (BusinessDraft, GameProvider, draft.ts, storage.ts,
   CreateBusinessScreen).
6. Vérification finale (ce commit) : 571 tests engine + 118 tests web
   verts, `typecheck`/`typecheck:test`/`lint`/`build` propres côté
   engine ET web, garde-fou `forbiddenApis` vert, playtest mobile RÉEL
   (seed de production non forcée, 390×844) : une opportunité
   authentique est apparue après 44 mois, un investissement de temps a
   visiblement réduit l'incertitude affichée, une proposition
   volontairement hors budget a été rejetée avec une contre-proposition
   réelle et cohérente, son acceptation a produit un contrat signé
   affiché proprement (aucun id technique, aucun statut brut), sans
   débordement horizontal.

**Bugs réels découverts et corrigés pendant l'écriture des tests (TDD,
pas des suppositions)** :
- Un premier jet de tests utilisait un `referencePrice` de test (6000)
  différent du catalogue réel pour `agency-grands-comptes` (12000) —
  `resolveAccountNegotiationDecision` résolvant lui-même ce prix, le
  budget "vrai" divergeait entre test et implémentation. Corrigé en
  alignant la constante de test sur le catalogue réel.
- Le test d'intégration "neutralité économique" comparait à tort le
  revenu de deux MOIS DIFFÉRENTS (confondant variation économique
  naturelle et effet du contrat) — corrigé en comparant deux branches
  parallèles issues du même état préalable pour le même mois.
- Le premier jet de fixture UI pour un test de négociation reconstruisait
  un `GameState` entièrement à la main et a échoué deux fois sur des
  champs sans rapport avec la négociation (capacité d'infrastructure
  dépassée par un effectif fictif, puis `competitions[marketId]`
  manquant) — corrigé en jouant une vraie partie (onboarding réel) puis
  en injectant uniquement l'opportunité via `loadSave`/`writeSave`.
- Pendant le playtest manuel réel (pas les tests automatisés) : le temps
  "Production" est alloué à 100% par défaut, donc investir du temps de
  recherche sans d'abord en libérer déclenche à raison la même
  validation de budget partagé que `founderHoursAllocated`/`develop`
  (comportement correct, pas un bug — juste une leçon de playtest).

## Design actif

`docs/superpowers/specs/2026-09-12-founder-m11.2.4-strategic-accounts-design.md`
(corrigé au commit `58d080f`) — couvre l'ensemble M11.2.4.1→M11.2.4.5.

## Points de vigilance connus (à ne pas oublier, ne pas re-découvrir)

- Le déséquilibre de calibration Café/petit restaurant (documenté depuis
  M11.2.3.1) reste un sujet de calibration séparé, non traité par
  M11.2.4.
- M11.2.4.3 devra éviter tout double comptage de la demande contractuelle
  et toute priorité cachée entre flux new/repeat/contractuel (déjà
  résolu dans la spec §2-§3, à respecter strictement à l'implémentation).
  C'est le cœur du prochain milestone : intégrer `AccountContract`
  (déjà signé, "papier" depuis M11.2.4.2) dans `computeTotalDemand` et
  l'allocation de capacité, EXACTEMENT selon la formule
  `overlap`/`incremental` déjà prouvée dans la spec — ne pas la
  redériver, la relire.
- `AccountOfferRelationship` (Core, M11.2.4.1) ne porte que `offerId`/
  `segmentId`/`status` — `contract`/`satisfaction`/`trust`/`history`
  doivent être ajoutés de façon PUREMENT ADDITIVE par M11.2.4.3/M11.2.4.4
  (spec §5), jamais en modifiant la forme actuelle. M11.2.4.3 ajoutera
  vraisemblablement `contract` à ce type au moment où un compte gagné
  devient une relation active consommant réellement de la capacité —
  vérifier à l'inspection si cette conversion opportunité→
  `StrategicAccount`/`AccountOfferRelationship` fait partie du critère
  de complétude de M11.2.4.3 ou reste différée (relire spec §15 M11.2.4.3
  attentivement : elle ne mentionne pas explicitement cette conversion,
  seulement l'intégration économique — décision à trancher, probablement
  autonome, à l'inspection réelle du code au moment venu).
- Les constantes de calibrage (`STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY`
  0.06, `MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS` 3,
  `MAX_RESEARCH_HOURS_FOR_FULL_CONFIDENCE` 40, `NEGOTIATION_PRICE_TOLERANCE`
  1.0) sont des choix empiriques, pas une vérité produit figée.
- Détail cosmétique mineur observé au playtest (pas un bug fonctionnel) :
  le catalogue d'identités fictives (`strategicAccountIdentity.ts`)
  associe prénoms et intitulés de poste de façon indépendante, ce qui
  peut occasionnellement produire un accord de genre incohérent en
  français (ex. "Julien Faucher — Chargée de développement"). Cosmétique
  uniquement, à corriger un jour si ça gêne réellement (calibrage
  autonome, pas une PRODUCT DECISION REQUIRED).

## Prochaine action autonome

Démarrer **M11.2.4.3 — Contract Execution** en suivant le cycle standard
(`CLAUDE.md`) : inspecter le code réel actuel (`businessResolution.ts`
en entier, en particulier `computeTotalDemand`/`resolveOfferOutcome`,
et `strategicAccounts.ts`/`strategicAccount.ts` tels qu'ils existent
maintenant après M11.2.4.2), relire spec §2-§3 (la formule
`overlap`/`incremental` déjà prouvée) et §15 M11.2.4.3, écrire un plan
d'implémentation TDD dédié (`docs/superpowers/plans/`), l'exécuter tâche
par tâche, vérifier, commit/push, mettre à jour ce fichier, puis
enchaîner sur M11.2.4.4 sans demander de confirmation — sauf si un cas
`PRODUCT DECISION REQUIRED` réel (`CLAUDE.md`) est rencontré.

## Blocage produit en attente

Aucun.
