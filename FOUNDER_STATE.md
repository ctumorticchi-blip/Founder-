# FOUNDER_STATE.md — État courant du projet

Ce fichier est mis à jour après CHAQUE tranche vérifiée verte, poussée
sur `main`. En cas de divergence avec le code réel, le code réel gagne
(`CLAUDE.md`) — corriger ce fichier plutôt que de lui faire confiance
aveuglément.

## Base verte courante

Branche : `claude/founder-web-game-4v4xga` (branche de développement
désignée pour cette session — voir note ci-dessous).
Dernier commit vérifié au moment de la rédaction de cette version :
`53c876f` — M11.2.4.4 (Relationship & Concentration) intégralement
livré et vert.

**Note d'infrastructure** : cette session développe sur la branche
`claude/founder-web-game-4v4xga` (imposée par l'environnement
d'exécution), rebasée en fast-forward sur `main` (`a1b078a`) avant le
début des travaux M11.2.4.3 — aucun historique perdu. Les commits
M11.2.4.1/M11.2.4.2 restent sur `main` (non encore fusionnés avec cette
branche par PR). Vérifier au début de toute session future laquelle de
`main`/`claude/founder-web-game-4v4xga` est réellement la plus à jour
avant de continuer.

## Milestone actif

**M11.2.4.4 — Relationship & Concentration : TERMINÉ.**
Prochain milestone à démarrer : **M11.2.4.5 — Renewal & Loss**
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

## M11.2.4.3 — récapitulatif de livraison

Plan : `docs/superpowers/plans/2026-09-13-founder-m11.2.4.3-contract-execution.md`.
6 tâches TDD livrées, chacune commit+push séparément :

1. `c837468` — fonctions pures d'allocation contractuelle
   (`strategicAccounts.ts`) : `computeContractedVolumeForOffer`/
   `wonOpportunitiesForOffer`, `computeContractualDemandAdjustment`
   (overlap/incremental, spec §2, 4 exemples chiffrés reproduits),
   `computeContractualCapacityAllocation` (allocation 3 flux new/repeat/
   contractuel sans priorité cachée, spec §3, exemples 3-4 reproduits +
   conservation vérifiée), `allocateContractOutcomes` (répartition
   multi-contrats proportionnelle au volume propre de chacun).
2. `5820752` — `AccountContract` gagne `lastMonthServedVolume`/
   `lastMonthUnservedVolume` (additifs), `signContract` les initialise à
   0, migration défensive (`?? 0`) pour les contrats antérieurs.
3. `ed9b3ba` — intégration réelle dans `businessResolution.ts` pour les
   4 familles à capacité (service/hospitality/retail/agency) :
   `integrateContractualDemand` construit un funnel ajusté (demande du
   segment ciblé réduite de `overlap`) puis appelle
   `computeTotalDemand`/`resolveOfferOutcome` **SANS AUCUNE modification
   de forme** (confirmé par diff — seuls leurs arguments changent : funnel
   ajusté, `newRepeatSales`/`newRepeatLost` au lieu des bruts). CA
   contractuel par swap de prix (`computeOfferRevenueWithContracts`),
   jamais un second moteur économique. Chaque contrat exécuté voit
   `lastMonthServedVolume`/`lastMonthUnservedVolume`/`monthsRemaining`
   (plancher 0) mis à jour (`applyContractExecutionOutcomes`).
4. `50fb484` — intégration Subscription : même technique avec
   `capacityForOffer = Infinity` (dégénère exactement comme voulu :
   `unservedContractual` toujours 0) ; CA **volontairement PAS** corrigé
   au prix du contrat — limitation assumée et documentée (décision 7 du
   plan) : `computeSubscriptionMonth` facture `activeSubscribers × arpu`
   générique, structurellement indépendant du contrat ce mois-ci (aucun
   swap de prix possible sans réarchitecturer ce moteur mono-tarif).
5. `582e432` — réordonnancement `simulateMonth.ts` : `applyStrategicAccountActions`
   s'exécute désormais AVANT `resolveBusinessMonth` (même principe que
   `applyOfferActions`) — un contrat accepté CE mois-ci consomme
   réellement de la capacité et génère du CA CE MÊME mois. Le test
   M11.2.4.2 "aucun effet le même mois" (devenu faux par construction)
   remplacé par un test positif ; nouveau test de conservation de bout en
   bout.
6. Vérification finale (ce commit) : 591 tests engine + 119 tests web
   verts, `typecheck`/`typecheck:test`/`lint`/`build` propres côté engine
   ET web, garde-fou `forbiddenApis` vert, `computeTotalDemand`/
   `resolveOfferOutcome` confirmés inchangés en forme sur tout le
   milestone (`git diff` dédié, zéro ligne touchée). Playtest mobile RÉEL
   (390×844, seed de production) : opportunité apparue après 17 mois,
   temps investi, proposition volontairement hors budget rejetée avec une
   contre-proposition réelle (13 463 € · 48 mandats), acceptée → contrat
   signé affiché proprement (aucun id technique, aucun statut brut,
   aucun débordement horizontal) — le CA du mois de signature (56 736 €)
   reflète visiblement l'effet du contrat CE MÊME mois, confirmant la
   décision 6 en conditions réelles.

**Limitations assumées et documentées (pas des bugs, décisions de scope
explicites du plan)** :
- **Subscription** : la fidélité de PRIX d'un contrat n'est pas
  respectée (facturé au tarif `arpu` générique comme tout abonné,
  contrat compris) — seul le VOLUME est intégré fidèlement. Corrigé dans
  un futur pass dédié au modèle Subscription (mono-tarif par nature,
  hors scope ici).
- **Réputation** : reste calculée sur new+repeat uniquement — le volume
  contractuel n'y contribue pas encore, faute d'un signal de
  satisfaction par compte (arrive avec M11.2.4.4).
- **Pas de conversion opportunité→`StrategicAccount`/
  `AccountOfferRelationship`** : une opportunité `"won"` porte déjà tout
  ce qu'il faut (identité + contrat) pour l'intégration économique ; ces
  deux types restent typés mais jamais peuplés (le critère de
  complétude M11.2.4.3 ne l'exige pas — décision 1 du plan, à
  reconfirmer si M11.2.4.4 en a réellement besoin).

**Bugs réels découverts et corrigés pendant l'écriture des tests/le
playtest (TDD, pas des suppositions)** :
- Aucun bug d'implémentation trouvé pendant les Tâches 1-4 : chaque test
  d'intégration (calibré par observation d'une baseline réelle puis
  recalcul via les mêmes formules) est passé du premier coup — l'algèbre
  de preuve écrite dans le plan avant implémentation s'est révélée
  exacte à l'exécution.
- Le test M11.2.4.2 "signer un contrat n'a aucun effet le même mois"
  (Tâche 5) a échoué immédiatement après le réordonnancement — attendu
  et correct : sa prémisse ("contrat papier tant que M11.2.4.3 n'existe
  pas") n'est plus vraie par construction. Remplacé par un test positif.
- Playtest manuel réel : script initial a échoué au premier
  "Terminer le mois" après un investissement de temps — cause : le
  script libérait du temps "Production" sans tenir compte du temps
  "Prospection" (40h par défaut) déjà alloué, dépassant le budget
  fondateur partagé (150h) silencieusement (erreur affichée dans
  `state.error`, pas une exception JS — donc invisible aux écouteurs
  `pageerror`/`console.error`). Corrigé en calculant la marge en tenant
  compte des DEUX postes de temps. Leçon de playtest, pas un bug moteur.

## M11.2.4.4 — récapitulatif de livraison

Plan : `docs/superpowers/plans/2026-09-13-founder-m11.2.4.4-relationship-concentration.md`.
6 tâches TDD livrées, chacune commit+push séparément :

1. `7454c5a` — types `AccountSatisfactionState`/`AccountHistoryEntry`/
   `AccountRelationshipState` (additifs sur `StrategicAccountOpportunity.relationship`,
   `null` tant qu'aucun mois n'a été résolu sous contrat) ;
   `SATISFACTION_EWMA_ALPHA` exportée depuis `retention.ts` (aucune
   ligne de calcul modifiée).
2. `c1211ae` — `accountRelationship.ts` : `computeAccountRelationshipUpdate`
   réutilise intégralement `computeSegmentExpectation`/`computeSatisfaction`/
   `computeDeliveredExperience`/`computeOperationalPenalty` (`customer/*`,
   tous intouchés, confirmé par diff) via un offre/segment "virtuels"
   (prix/qualité substitués par ceux du contrat) et un second appel à
   `computeOperationalPenalty` dédié au compte
   (`accountSaturationRatio = contract.volume/lastMonthServedVolume`).
   Confiance EWMA lente (`TRUST_EWMA_ALPHA=0.15`), alimentée par la
   satisfaction ET, indépendamment, par `breachFrustration` (EWMA du
   taux de sous-livraison). `computeAccountConcentration` (spec §10).
3. `15415a1` — intégration dans les 5 familles : `applyContractExecutionOutcomes`
   appelle le nouveau module au même point que la mise à jour du
   contrat, avec la pénalité opérationnelle générique déjà calculée par
   la boucle par offre (déplacée plus tôt pour Subscription, où elle ne
   dépendait que d'`understaffingPenalty`, disponible avant la boucle).
4. `a46541a` — migration défensive (`relationship ?? null`).
5. `53c876f` — écran : Satisfaction/Confiance/Concentration en
   vocabulaire qualitatif (`accountSatisfactionLabel` réutilisant
   `bucketSatisfactionLevel`, `trustLevelLabel`, `concentrationRiskLabel`)
   + pourcentage réel du CA (principe 10 : jamais masqué derrière une
   seule catégorie) ; état neutre explicite si `relationship: null`.
6. Vérification finale (ce commit) : 606 tests engine + 122 tests web
   verts, `typecheck`/`typecheck:test`/`lint`/`build` propres des deux
   côtés, garde-fou `forbiddenApis` vert, `customer/*` confirmés
   inchangés en logique (diff dédié). Playtest mobile réel (390×844) :
   un contrat signé sur une capacité insuffisante dès le départ (leçon
   de playtest, pas un bug — le jeu n'empêche pas de signer au-delà de
   sa capacité réelle) a produit une satisfaction "Très déçu" immédiate
   et une confiance qui s'est nettement dégradée ("fragile" → "rompue")
   sur 4 mois consécutifs de sous-livraison sévère — comportement
   attendu, conforme au critère de complétude (vitesses différentes,
   satisfaction immédiate/confiance qui s'érode). Concentration affichée
   en pourcentage réel + libellé de risque, aucun id technique ni score
   brut, aucun débordement horizontal.

**Limitations assumées et documentées (décisions de scope explicites du
plan, pas des bugs)** :
- **Pas de conversion `StrategicAccount`/`AccountOfferRelationship`** :
  `satisfaction`/`trust`/`history` vivent directement sur
  `StrategicAccountOpportunity.relationship`, comme `contract` l'a fait
  pour M11.2.4.3 — le problème que ces deux types résolvaient
  (identité dupliquée multi-offres) ne se pose pas dans l'implémentation
  réelle (chaque opportunité génère une identité fraîche et
  indépendante, aucune notion de "même client réel sur 2 offres"
  n'existe encore).
- **Bouche-à-oreille B2B exclu** (spec §12, question ouverte tranchée) :
  un Strategic Account ne contribue pas à `aggregateWordOfMouthInputs`/
  `computeWordOfMouth` — choix conservateur, réversible sans migration.
- **Formule de confiance 50/50** (satisfaction vs `breachFrustration`) :
  calibrage empirique, même statut que `NEGOTIATION_PRICE_TOLERANCE`.
- Renouvellement/rapport de force restent hors scope (M11.2.4.5) : un
  contrat à `monthsRemaining === 0` continue de s'exécuter normalement
  sans aucun effet spécial, comportement temporaire assumé.

## Design actif

`docs/superpowers/specs/2026-09-12-founder-m11.2.4-strategic-accounts-design.md`
(corrigé au commit `58d080f`) — couvre l'ensemble M11.2.4.1→M11.2.4.5.

## Points de vigilance connus (à ne pas oublier, ne pas re-découvrir)

- Le déséquilibre de calibration Café/petit restaurant (documenté depuis
  M11.2.3.1) reste un sujet de calibration séparé, non traité par
  M11.2.4.
- M11.2.4.5 (Renewal & Loss) doit implémenter le rapport de force (spec
  §11, tableau de facteurs déjà représentables avec les grandeurs
  EXISTANTES : `concentration`, `trust`, `contract.price` vs
  `segment.referencePrice`, `familyState.reputationScore`,
  `AggregateCompetition`, `relationship.history`) et le renouvellement
  dynamique (spec §12, patron `accept`/`counter`/`reject` déjà éprouvé
  en M11.2.4.2, à réutiliser pour les variantes du principe 12 —
  renouvellement favorable, renégociation, baisse, volume
  supplémentaire, hausse tarifaire, mise en concurrence, départ). Un
  départ réel de compte doit libérer la capacité réellement réabsorbable
  par new/repeat le mois suivant (déjà garanti structurellement par le
  pipeline M11.2.4.3, aucune compensation artificielle à construire).
- `relationship.history` (M11.2.4.4) n'est pour l'instant peuplé mais
  jamais affiché à l'écran (hors scope M11.2.4.4, `history` sert
  M11.2.4.5 pour le rapport de force) — vérifier si M11.2.4.5 a
  effectivement besoin de le lire avant d'en changer la forme.
- Les constantes de calibrage (`STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY`
  0.06, `MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS` 3,
  `MAX_RESEARCH_HOURS_FOR_FULL_CONFIDENCE` 40, `NEGOTIATION_PRICE_TOLERANCE`
  1.0, `TRUST_EWMA_ALPHA` 0.15, `CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA`
  0.3, poids 50/50 de la formule de confiance) sont des choix empiriques,
  pas une vérité produit figée.
- Détail cosmétique mineur observé au playtest (pas un bug fonctionnel) :
  le catalogue d'identités fictives (`strategicAccountIdentity.ts`)
  associe prénoms et intitulés de poste de façon indépendante, ce qui
  peut occasionnellement produire un accord de genre incohérent en
  français (ex. "Julien Faucher — Chargée de développement"). Cosmétique
  uniquement, à corriger un jour si ça gêne réellement (calibrage
  autonome, pas une PRODUCT DECISION REQUIRED).

## Prochaine action autonome

Démarrer **M11.2.4.5 — Renewal & Loss** (dernier jalon de M11.2.4) en
suivant le cycle standard (`CLAUDE.md`) : inspecter le code réel actuel
(`accountRelationship.ts`/`strategicAccounts.ts`/`businessResolution.ts`
tels qu'ils existent maintenant après M11.2.4.4, en particulier
`AccountRelationshipState`/`relationship.history` tout juste ajoutés),
relire spec M11.2.4 §11/§12 (rapport de force, renouvellement dynamique)
et §15 M11.2.4.5 (frontières précises, critère de complétude : le
scénario narratif complet de l'énoncé jouable de bout en bout), écrire
un plan d'implémentation TDD dédié (`docs/superpowers/plans/`),
l'exécuter tâche par tâche, vérifier, commit/push, mettre à jour ce
fichier, puis enchaîner sur M11.2.5 (Competitive Market) sans demander
de confirmation — sauf si un cas `PRODUCT DECISION REQUIRED` réel
(`CLAUDE.md`) est rencontré.

## Blocage produit en attente

Aucun.
