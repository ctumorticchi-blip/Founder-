# FOUNDER_STATE.md — État courant du projet

Ce fichier est mis à jour après CHAQUE tranche vérifiée verte, poussée
sur `main`. En cas de divergence avec le code réel, le code réel gagne
(`CLAUDE.md`) — corriger ce fichier plutôt que de lui faire confiance
aveuglément.

## Base verte courante

Branche : `claude/founder-web-game-4v4xga` (branche de développement
désignée pour cette session — voir note ci-dessous).
Dernier commit vérifié au moment de la rédaction de cette version :
`0ffc1ae` — M11.2.6.1 (Market Study, première tranche de M11.2.6)
livré et vert. **M11.2.4 — Strategic Accounts (5/5 sous-jalons) ET
M11.2.5 — Competitive Market sont terminés. M11.2.6 — Market
Intelligence & UX est en cours (1/3 sous-tranches livrée).**

**Note d'infrastructure** : cette session développe sur la branche
`claude/founder-web-game-4v4xga` (imposée par l'environnement
d'exécution), rebasée en fast-forward sur `main` (`a1b078a`) avant le
début des travaux M11.2.4.3 — aucun historique perdu. Les commits
M11.2.4.1/M11.2.4.2 restent sur `main` (non encore fusionnés avec cette
branche par PR). Vérifier au début de toute session future laquelle de
`main`/`claude/founder-web-game-4v4xga` est réellement la plus à jour
avant de continuer.

## Milestone actif

**M11.2.4 — Strategic Accounts : TERMINÉ (5/5 sous-jalons).**
**M11.2.5 — Competitive Market : TERMINÉ (portée Option C, décision
produit issue #1).**
**M11.2.6 — Market Intelligence & UX : EN COURS.** Découpé en 3
sous-tranches (décision autonome, voir spec M11.2.6.1) :
1. ✅ M11.2.6.1 — Market Study (câblage `projectMarketView`, écran
   "Étude de marché").
2. ⬜ M11.2.6.2 — demande par segment agrégée au niveau marché (spec à
   écrire : nécessite une nouvelle agrégation moteur, pas une pure
   restitution).
3. ⬜ M11.2.6.3 — satisfaction agrégée + "tableau de bord commercial"
   multi-entreprises.

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

## M11.2.4.5 — récapitulatif de livraison (M11.2.4 intégralement terminé)

Plan : `docs/superpowers/plans/2026-09-13-founder-m11.2.4.5-renewal-loss.md`.
6 tâches TDD livrées, chacune commit+push séparément :

1. `9f97dc4` — cycle de renouvellement porté entièrement par
   `AccountContract` (aucun nouveau statut d'opportunité) via deux
   champs additifs `renewalProposal`/`renewalDeadlineMonthsRemaining` ;
   `deriveRenewalBudget` compose le rapport de force **facteur par
   facteur** (jamais une équation opaque, contrainte explicite spec
   §19.1) : confiance (indulgence prix), concentration (pression prix),
   réputation (bonus prix), pression concurrentielle
   (`AggregateCompetition`), chaque facteur testé isolément avec sa
   direction attendue, borné à `[referencePrice×0.4, referencePrice×3]`.
2. `c40a8a0` — `resolveAccountRenewalDecision` : accept/counter/withdraw
   déterministes (même patron que la négociation initiale M11.2.4.2,
   aucun jet de probabilité sur l'issue) ; accept → `signContract` (le
   client ouvre TOUJOURS le renouvellement, jamais le joueur) ; counter
   → comparé à `deriveRenewalBudget` ; withdraw → départ immédiat
   (`status: "lost"`, `contract: null`).
3. `b90aa6e` — `advanceContractRenewalLifecycle` (fonction pure) :
   déclenche la proposition à `monthsRemaining === 0`, décrémente
   `renewalDeadlineMonthsRemaining` (délai de grâce
   `RENEWAL_GRACE_PERIOD_MONTHS = 3`) si une proposition reste sans
   réponse, départ réel (`contract: null`) au terme du délai. Intégré
   dans `applyContractExecutionOutcomes` (5 familles) ; `concentration`
   dérivée du CA du mois **précédent déjà finalisé**
   (`owned.lastStatement?.revenue`) — simplification délibérée et
   documentée évitant toute dépendance circulaire avec le CA du mois en
   cours d'exécution.
4. `67899f4` — intégration `simulateMonth.ts` : nouveau paramètre
   `RenewalContext` (défaut neutre, même patron que
   `competitivePressure` sur `resolveBusinessMonth`) ; deux nouveaux
   événements causaux détectés par comparaison d'état avant/après (pas
   de champ de tracking ajouté) : `strategic-account-renewed`
   (proposition non-null devenue null sur opportunité toujours "won") et
   `strategic-account-lost` (retrait volontaire OU expiration
   automatique du délai de grâce).
5. `e77cd4d` — migration défensive (`renewalProposal ?? null`,
   `renewalDeadlineMonthsRemaining ?? null`) ; écran : bloc "Proposition
   de renouvellement" (Prix/Volume/Durée + Accepter/Contre-proposer/
   Refuser, réutilise `ProposalForm` de M11.2.4.2 sans modification) ;
   liste des comptes stratégiques filtrée pour exclure `"lost"`/
   `"declined-by-player"`.
6. Vérification finale (ce commit) : 625 tests engine + 125 tests web
   verts, `typecheck`/`typecheck:test`/`lint`/`build` propres des deux
   côtés, garde-fou `forbiddenApis` vert (58 tests). Playtest mobile
   réel (390×844) avec injection directe d'un contrat en fin de terme
   rattaché à une VRAIE offre lancée (nécessaire : le cycle de
   renouvellement ne s'exécute que dans la boucle par offre lancée de
   `businessResolution.ts`, confirmé en pratique — une opportunité liée
   à un `offerId` fictif ne déclenche jamais le renouvellement) : la
   proposition de renouvellement du client est apparue avec un prix
   RÉELLEMENT calculé par `deriveRenewalBudget` (10 627 €, pas une
   valeur codée en dur), acceptée → nouveau contrat affiché proprement
   (montant/volume mis à jour, aucun id technique, aucun champ brut) ;
   un second compte laissé sans réponse pendant les 3 mois du délai de
   grâce a réellement disparu de la liste (départ effectif), le premier
   compte renouvelé restant visible avec ses métriques de relation
   à jour. Aucune erreur console, aucun débordement horizontal.

**Limitations assumées et documentées (décisions de scope explicites du
plan, pas des bugs)** :
- Le déclenchement du renouvellement et le décompte du délai de grâce
  vivent dans la boucle par offre LANCÉE de `businessResolution.ts` —
  un compte dont l'offre associée n'est plus lancée (retirée du marché)
  ne progresse plus dans son cycle de renouvellement. Comportement
  cohérent avec M11.2.4.3 (l'exécution contractuelle elle-même a la
  même contrainte), non re-testé séparément ici.
- `concentration` utilisée dans `deriveRenewalBudget` reste calculée sur
  le CA du mois précédent (même simplification qu'en M11.2.4.4/.3 pour
  éviter la dépendance circulaire intra-mois) — jamais le CA du mois en
  cours de résolution.
- Pas de mise en concurrence explicite du joueur par un concurrent
  nommé (spec §12, variante "mise en concurrence") : la pression
  concurrentielle influence déjà le budget de renouvellement via
  `AggregateCompetition` (niveau 1, cohérent avec le reste du jeu
  jusqu'à M11.2.5), sans narration d'un concurrent identifié — arrivera
  naturellement avec M11.2.5 (Competitive Market).

**Bugs réels découverts et corrigés pendant l'écriture des tests/le
playtest (TDD, pas des suppositions)** :
- Erreur de narrowing TypeScript sur le ternaire construisant `decision`
  dans `applyStrategicAccountActions` (le type incluait encore
  `"propose"` dans la branche renouvellement) — corrigée en ajoutant
  `action.kind !== "propose"` comme garde explicite dans la condition,
  laissant TS affiner correctement.
- Un test d'intégration multi-mois réutilisait par erreur une action de
  lancement d'offre à chaque itération, provoquant
  `launchOffer: déjà lancée` dès le 2e mois — corrigé avec un helper
  dédié aux mois répétés (`offerActions: []`).
- Pendant le playtest manuel réel (pas les tests automatisés) : une
  opportunité injectée avec un `offerId` fictif (ne correspondant à
  aucune offre réellement lancée) ne déclenche JAMAIS
  `advanceContractRenewalLifecycle`, puisque cette fonction n'est
  appelée que depuis la boucle par offre lancée — comportement correct
  du moteur, pas un bug, mais une leçon de playtest (la première
  tentative de script utilisait un `offerId` fictif et n'observait
  aucun déclenchement ; corrigé en créant/lançant une vraie offre avant
  l'injection).

## M11.2.5 — récapitulatif de livraison (Competitive Market, portée Option C)

Décision produit : issue GitHub #1 (`PRODUCT DECISION REQUIRED —
M11.2.5 Competitive Market`), tranchée **Option C** par le product
owner — concurrents identifiés informatifs, décomposition purement
additive de `AggregateCompetition`, aucun changement au calcul de
demande. La refonte "choix concurrentiel réel" (Option B) reste un
incrément futur explicite, non construit ici.

Spec : `docs/superpowers/specs/2026-09-13-founder-m11.2.5-competitive-market-design.md`.
Plan : `docs/superpowers/plans/2026-09-13-founder-m11.2.5-competitive-market.md`.
6 tâches TDD livrées, chacune commit+push séparément :

1. `d2e797f` — `Competitor.qualityLevel` (additif) ; fonctions pures
   `identifiedCompetitors.ts` : `createIdentifiedCompetitors`/
   `advanceIdentifiedCompetitors`/`computeCompetitorMarketShare`. Le
   point critique du design (spec §1) : la part de marché d'un
   concurrent n'est **jamais stockée**, toujours dérivée à la lecture
   (`strength` relatif / somme des `strength` du marché × part captée de
   l'agrégat) — garantit par construction que la somme des parts égale
   exactement `AggregateCompetition.totalCapturedRevenueShare`, sans
   invariant à synchroniser à la main lors de la dérive mensuelle de
   l'agrégat.
2. `7e7f618` — intégration `game.ts` (création à l'init, même point que
   `competitions`) et `simulateMonth.ts` (avance mensuelle juste après
   `advanceAggregateCompetition` ; backfill des sauvegardes existantes :
   un marché sans concurrents encore générés en reçoit au prochain
   `simulateMonth`, première apparition réelle dans cette partie, jamais
   une reconstitution de passé).
3. `3fc255b` — migration web (`competitors ?? {}`, défaut neutre).
4. `69c850e` — `projectCompetitorView` (`intelligence.ts`) : qualité/part
   de marché passent par `estimate()` (bruit jamais nul, spec §9) avant
   d'être bucketés en paliers qualitatifs (economy/standard/premium,
   low/moderate/high) — jamais un score brut, même patron que
   `bucketPriceSignal`/`bucketVisibility`. Le nom n'est jamais bruité.
5. `ea4b941` — écran consultatif "Concurrents identifiés" (route
   `competitors`, accessible depuis l'écran Entreprise) : nom +
   positionnement + part de marché en libellés qualitatifs uniquement.
6. Vérification finale (ce commit) : 649 tests engine + 129 tests web
   verts, `typecheck`/`typecheck:test`/`lint`/`build` propres des deux
   côtés, garde-fou `forbiddenApis` vert. `computeOfferDemand`/
   `resolveOfferOutcome`/`demandShare`/`customer/*` confirmés
   **intégralement inchangés** sur tout le milestone (`git diff
   7149d86..HEAD --stat` sur ces fichiers : zéro ligne, vide). Playtest
   mobile réel (390×844) : 4 concurrents identifiés nommés
   (génération déterministe, patron de `strategicAccountIdentity.ts`
   adapté sans contact) affichés avec positionnement/part de marché
   qualitatifs plausibles ; après 3 mois supplémentaires, dérive
   visiblement observée (ex. un concurrent passé de "Positionnement
   premium/Part de marché élevée" à "Positionnement standard/Part de
   marché modérée") — confirmant `advanceIdentifiedCompetitors` en
   conditions réelles. Aucun id technique, aucun score brut, aucune
   erreur console, aucun débordement horizontal.

**Limitations assumées et documentées (décision produit + décisions de
scope explicites de la spec, pas des bugs)** :
- **Choix concurrentiel réel dans le calcul de demande** (Option B) :
  différé, non construit. `computeOfferDemand`/`demandShare` restent
  exactement comme avant M11.2.5 — un concurrent identifié n'affecte
  encore aucune décision de demande, il est purement informatif.
- **Tier `"major"`** (entrepreneurs majeurs persistants) : hors P0
  depuis l'architecture d'origine (`docs/ARCHITECTURE.md`), aucune
  logique de simulation dédiée construite ici.
- **Aucune action joueur contre un concurrent identifié** (rachat,
  guerre des prix ciblée, etc.) — observation uniquement.
- **Consolidation UX/market intelligence complète** différée à
  M11.2.6 (Market Intelligence & UX) — l'écran M11.2.5 est
  volontairement minimal (pas de tri/filtre, pas d'historique affiché).
- `projectMarketView`/`MarketEstimate` (moteur M4, jamais branché à
  l'UI) restent non câblés côté web — pas dans le périmètre M11.2.5,
  probablement pertinent pour M11.2.6.

**Aucun bug d'implémentation trouvé** : chaque fonction pure et chaque
test d'intégration sont passés du premier coup à l'exécution (13/13,
23/23, 28/28, 11/11, 2/2 selon les tâches) — la seule friction a été
deux corrections de typecheck (`readonly Competitor[]` mal inféré dans
un test, `state.seed: number | null` non gardé dans l'écran web) et un
ajustement du script de playtest (une opportunité synthétique liée à un
`offerId` fictif ne déclenche jamais le cycle réel — leçon déjà connue
depuis M11.2.4.5, reconfirmée ici pour les concurrents identifiés qui
suivent la même boucle par offre lancée).

## M11.2.6.1 — récapitulatif de livraison (Market Study, première tranche de M11.2.6)

Architecture pré-approuvée : `docs/superpowers/specs/2026-09-10-founder-m11.2-design.md`
§8 (écrite avant M11.2.2-M11.2.5, "architecture seulement"). Découpage
concret en sous-tranches + détail M11.2.6.1 : `docs/superpowers/specs/2026-09-13-founder-m11.2.6.1-market-study-design.md`.
Plan : `docs/superpowers/plans/2026-09-13-founder-m11.2.6.1-market-study.md`.
Une seule tâche TDD, commit `0ffc1ae` :

- Câble enfin `projectMarketView`/`MarketEstimate` (moteur M4, jamais
  appelés côté web jusqu'ici — confirmé par `git grep` à l'inspection
  M11.2.5 §0 puis reconfirmé ici) dans l'écran "Concurrents identifiés"
  (M11.2.5), renommé **"Étude de marché"** : potentiel/croissance en
  fourchette bruitée (`formatEstimateRange`, réutilisé depuis
  `strategicAccountLabels.ts`), intensité concurrentielle en palier
  qualitatif (`competitiveIntensityLabel`, nouveau, même patron que le
  reste de `competitorLabels.ts`). Zéro nouvelle fonction moteur, zéro
  migration (rien de nouveau persisté — restitution pure, exactement
  comme prévu par l'architecture).
- Décision de scope documentée (spec §0) : `capitalIntensity`/
  `entryBarriers`, déjà affichés bruts dans `OpportunitiesScreen.tsx`,
  ne sont PAS couverts par `MarketEstimate` et ne sont donc **pas**
  bruités ici — ce sont des caractéristiques structurelles d'un modèle
  d'activité (savoir général), pas des grandeurs dynamiques nécessitant
  une vraie étude de marché. Seules les 3 grandeurs déjà couvertes par
  `MarketEstimate` entrent dans ce périmètre.
- Vérification : 130 tests web verts (+1 sur la base M11.2.5),
  `typecheck`/`lint`/`build` propres, tests M11.2.4.x/M11.2.5 existants
  inchangés et toujours verts (aucune régression du renommage de
  titre). Playtest mobile réel (390×844) : section "Le marché" affichée
  au-dessus des concurrents identifiés, fourchette de potentiel large
  (~82 447 € - 3 857 600 €) cohérente avec skill finance/stratégie à 0
  (18 ans, aucune expérience — `MAX_RELATIVE_NOISE=0.5` déjà existant,
  non modifié), aucune erreur console, aucun débordement horizontal.

**Aucun bug trouvé** — la seule friction a été un texte de label
dupliqué (`competitiveIntensityLabel` incluait à tort le préfixe
"Intensité concurrentielle" déjà affiché par le label de la ligne,
causant une erreur "multiple elements" dans le test RTL) — corrigé en
retirant le préfixe de la fonction de label (valeur seule : "Faible"/
"Modérée"/"Élevée").

## Design actif

`docs/superpowers/specs/2026-09-12-founder-m11.2.4-strategic-accounts-design.md`
(corrigé au commit `58d080f`) — couvre l'ensemble M11.2.4.1→M11.2.4.5.
`docs/superpowers/specs/2026-09-10-founder-m11.2-design.md` §8 +
`docs/superpowers/specs/2026-09-13-founder-m11.2.6.1-market-study-design.md`
— couvrent M11.2.6 (architecture globale + détail de la tranche 1).

## Points de vigilance connus (à ne pas oublier, ne pas re-découvrir)

- Le déséquilibre de calibration Café/petit restaurant (documenté depuis
  M11.2.3.1) reste un sujet de calibration séparé, non traité par
  M11.2.4.
- `relationship.history` (M11.2.4.4) reste peuplé mais jamais affiché
  directement à l'écran — `deriveRenewalBudget` (M11.2.4.5) ne l'utilise
  pas non plus au final (le rapport de force s'appuie sur `trust`/
  `concentration`/`reputationScore`/`competitivePressure`, pas
  directement sur l'historique brut). À réévaluer si une future
  itération narrative veut s'appuyer dessus.
- Le cycle de renouvellement/départ (M11.2.4.5) ne progresse que dans la
  boucle par offre LANCÉE de `businessResolution.ts` — voir limitation
  documentée dans le récapitulatif M11.2.4.5 ci-dessus.
- Les constantes de calibrage (`STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY`
  0.06, `MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS` 3,
  `MAX_RESEARCH_HOURS_FOR_FULL_CONFIDENCE` 40, `NEGOTIATION_PRICE_TOLERANCE`
  1.0, `TRUST_EWMA_ALPHA` 0.15, `CONTRACTUAL_BREACH_FRUSTRATION_EWMA_ALPHA`
  0.3, poids 50/50 de la formule de confiance, `RENEWAL_GRACE_PERIOD_MONTHS`
  3, `TRUST_PRICE_LENIENCY` 0.3, `CONCENTRATION_PRICE_PRESSURE` 0.2,
  `REPUTATION_PRICE_BONUS` 0.1, `COMPETITION_PRICE_PRESSURE` 0.25) sont
  des choix empiriques, pas une vérité produit figée.
- Détail cosmétique mineur observé au playtest (pas un bug fonctionnel) :
  le catalogue d'identités fictives (`strategicAccountIdentity.ts`)
  associe prénoms et intitulés de poste de façon indépendante, ce qui
  peut occasionnellement produire un accord de genre incohérent en
  français (ex. "Julien Faucher — Chargée de développement"). Cosmétique
  uniquement, à corriger un jour si ça gêne réellement (calibrage
  autonome, pas une PRODUCT DECISION REQUIRED).
- **M11.2.5** : les concurrents identifiés ne progressent (création ET
  avance mensuelle) que dans la boucle par offre LANCÉE de
  `businessResolution.ts` — même contrainte que le cycle de
  renouvellement M11.2.4.5, déjà documentée, reconfirmée ici.
  `computeCompetitorMarketShare` n'a de sens que rapporté aux AUTRES
  concurrents du MÊME marché passés en paramètre — ne jamais l'appeler
  avec une liste partielle ou d'un autre marché (la somme des parts ne
  serait alors plus garantie égale à l'agrégat).
- **Option B (choix concurrentiel réel dans le calcul de demande)**
  reste un incrément futur explicite (décision produit issue #1) — ne
  jamais l'implémenter par anticipation avant qu'un milestone ultérieur
  (M11.2.6 ou M11.3) en ait réellement besoin et qu'une nouvelle
  décision produit l'autorise explicitement si le changement de boucle
  de gameplay se confirme au moment venu.

## Prochaine action autonome

**M11.2.6 — Market Intelligence & UX est en cours (1/3 sous-tranches
livrée, M11.2.6.1 — Market Study).** Démarrer **M11.2.6.2 — demande par
segment agrégée au niveau marché** en suivant le cycle standard
(`CLAUDE.md`) :

- Contrairement à M11.2.6.1 (pure restitution), cette sous-tranche
  nécessite une VRAIE nouvelle agrégation moteur — l'architecture §8 le
  dit explicitement ("demande par segment" fait partie des "nouvelles
  entités M11.2.2-M11.2.5" à couvrir). Inspecter d'abord ce qui existe
  déjà : `SegmentDemandContribution`/`DemandFunnelResult.bySegment`
  (`types/demand.ts`) est calculé PAR OFFRE (via `computeOfferDemand`),
  pas agrégé au niveau d'un marché entier (toutes offres/entreprises
  confondues, y compris celles que le joueur n'opère pas). Déterminer
  si "demande par segment" au niveau marché doit être une vraie nouvelle
  fonction d'agrégation (somme des `bySegment` de toutes les offres du
  joueur sur ce marché — simple, additif) ou quelque chose de plus
  ambitieux (demande totale du marché entier, y compris la part captée
  par la concurrence — nécessiterait de nouvelles hypothèses). Écrire
  une spec dédiée (`docs/superpowers/specs/`) avant tout code : cette
  sous-tranche a plus de marge d'ambiguïté que M11.2.6.1, vérifier
  réellement les 8 triggers plutôt que de supposer qu'aucun ne
  s'applique.
- Une fois M11.2.6.2 livré, enchaîner sur **M11.2.6.3 — satisfaction
  agrégée + tableau de bord commercial** puis, M11.2.6 entièrement
  terminé, sur **M11.3 — Sales & Marketing** (`FOUNDER_ROADMAP.md`,
  section "Ensuite") — sans demander de confirmation entre chaque
  sous-tranche/milestone, sauf si un cas `PRODUCT DECISION REQUIRED`
  réel (`CLAUDE.md`) est rencontré.

## Blocage produit en attente

Aucun (issue #1 résolue — Option C, M11.2.5 livré sur cette base).
