# FOUNDER — Découpage P0 en milestones

Chaque milestone est commit(é)+push(é) séparément une fois ses tests verts.

Statut : M0 à M9.5 complétés (voir l'historique git de la branche pour les
SHA de chaque milestone). Le moteur P0 est considéré comme clos : les 5/5
familles économiques sont réellement jouables via `simulateMonth`, la
trésorerie ne laisse plus aucun coût disparaître (obligations impayées
persistantes, remboursées en priorité, avec pénalité progressive et
insolvabilité après signal). Aucune nouvelle mécanique économique ne doit
être ajoutée sans revalidation explicite — la suite (M10) est l'interface
web.

### M9.5 — Fermeture finale du moteur
- Câblage de Retail et Agency/B2B dans `businessResolution.ts`, avec
  exactement les mêmes principes que Service/Hospitality/Subscription
  (effectif -> capacité -> moteur pur -> comptabilité -> trésorerie).
  `RetailMarket`/`AgencyMarket` ajoutés à `src/scenarios/markets.ts`.
- `engine/business/treasury.ts` : `TreasuryState.unpaidObligations`
  remplace le compteur `consecutiveUnmetShortfallMonths` par un vrai solde
  dû mais non réglé — persistant, remboursé en priorité (avant la ligne de
  crédit) dès que du cash redevient disponible, portant une pénalité de
  retard mensuelle tant qu'il reste dû (conséquence progressive), et menant
  à l'insolvabilité après `INSOLVENCY_THRESHOLD_MONTHS` mois consécutifs
  d'impayé. Un test d'identité de conservation (`netPosition = cash -
  créditTiré - impayés`) démontre qu'aucun euro n'apparaît ou ne disparaît
  hors des flux économiques réels (cash-flow du mois et pénalité de retard).
- **Tests** : Retail et Agency via `simulateMonth` (création, effet de
  capacité par recrutement, déterminisme sur 60 mois) ; les 5/5 familles
  simultanément dans un même portefeuille ; accumulation/remboursement
  (partiel et total) des obligations impayées ; conservation exacte de la
  valeur ; insolvabilité cohérente avec signal préalable.

## M0 — Scaffolding + documentation (ce commit)
- `docs/SPEC_P0.md`, `docs/ARCHITECTURE.md`, `docs/MILESTONES.md`.
- Squelette du projet TypeScript : `package.json`, `tsconfig.json`,
  `vitest.config.ts`, lint minimal, `.gitignore`.
- Aucun code de simulation encore.
- **Critère de sortie** : `npm install && npm run build && npm test` passent
  sur un projet vide (ou avec un test trivial).

## M1 — Noyau déterministe
- `engine/rng` : PRNG seedé + dérivation de sous-graines.
- `engine/time` : `GameDate`, avance mensuelle, calcul d'âge.
- `types/character.ts`, `engine/character` : état initial du personnage,
  compétences (0–100, tirage initial bas), budget de temps mensuel avec
  validation stricte (rejet si allocation > budget).
- **Tests** : RNG reproductible par seed ; horloge (ajout de mois, passage
  d'année, âge) ; création de personnage initial conforme à la spec §4 ;
  validation du budget de temps.

## M2 — Modèle financier + premier moteur économique (Service)
- `types/business.ts`, `engine/business` : structure comptable complète
  (§6 de la spec) et fonctions pures `computeMonthlyFinancials`,
  `applyCashFlow`.
- `engine/economic-models/service.ts` : première famille économique
  (ex. société de nettoyage), avec capacité en heures, contrats, coûts
  variables liés à la main-d'œuvre.
- Interface commune `EconomicEngine` définie et implémentée une fois.
- **Tests** : cohérence comptable (EBITDA, résultat net, cash-flow) ;
  invariant "rentable mais à court de cash" démontré par un test dédié ;
  Service engine produit un P&L plausible sur plusieurs mois.

## M3 — Extension aux 4 familles restantes
- `engine/economic-models/{retail,hospitality,agency,subscription}.ts`,
  chacune conforme à `EconomicEngine`, réutilisant les systèmes
  transversaux (marketing, réputation, employés) posés en M2.
- **Tests** : un test par famille vérifiant sa spécificité (ex. churn/CAC
  pour Subscription, stock pour Retail, capacité couverts/jour pour
  Hospitality, dépendance réputation pour Agency).

## M4 — Marché, concurrence, information imparfaite
- `engine/market` : `Market` avec les champs de la spec §5, dérivation
  d'inefficiences.
- `engine/competition` : concurrence agrégée (statistique) + quelques
  concurrents identifiés simplifiés.
- `engine/intelligence` : `Truth -> PlayerView` avec bruit paramétré par
  compétence (spec §9).
- **Tests** : le bruit diminue avec la compétence sans jamais atteindre 0 ;
  deux `PlayerView` avec le même seed et les mêmes compétences sont
  identiques ; la concurrence affecte la demande captée par le joueur.

## M5 — Boucle mensuelle complète + narrative minimal
- `engine/simulation` : orchestrateur exécutant les 12 étapes de la spec
  §10 dans l'ordre fixe.
- `engine/narrative` : génération d'événements contextuels simples
  (dérivés de l'état, pas scriptés) + `MemoryLedger` pour rappel futur.
- **Tests** : déterminisme bout-en-bout sur 120 mois pour un même
  `(seed, actions)` ; au moins deux trajectoires distinctes obtenues à
  partir de décisions différentes (une qui mène à la faillite, une qui
  mène à un patrimoine net ≈ 1 M€+), sans branche de code spécifique à
  chaque issue.

## Consolidation post-P0 (M6-M9)

Demandée après revue du P0 : le no-op "employés" et la liquidation naïve
étaient jugés insuffisants pour que le P0 soit réellement complet.

### M6 — Système d'employés
- `types/employees.ts`, `engine/employees` : effectif agrégé, recrutement/
  licenciement avec coût réel imputé au mois, masse salariale, traduction
  effectif -> heures de production modulée par le leadership du fondateur.
- **Tests** : coût de recrutement/licenciement, capacité apportée par
  effectif + leadership, ratio de staffing (sous/sur-effectif).

### M7 — Trésorerie réaliste (remplace "6 mois de cash négatif")
- `types/business.ts` : `BusinessState.cash` -> `TreasuryState` (cash
  toujours ≥ 0, ligne de crédit avec plafond, compteur de découvert non
  couvert, insolvabilité).
- `engine/business/treasury.ts` (remplace `cash.ts`) : cascade de
  financement explicite (remboursement de crédit prioritaire si excédent,
  tirage sur la ligne de crédit si déficit, insolvabilité après 6 mois de
  découvert non couvert persistant) + `injectCapital` (apport de capital).
- **Tests** : les 4 scénarios demandés (rentable mais illiquide, déficitaire
  mais solvable, sauvé par apport, faillite réelle).

### M8 — Orchestrateur multi-entreprises/multi-familles
- `GameState.businesses` (liste), `GameState.markets`/`competitions`
  (par marché). Unions discriminées par famille pour l'état/les décisions
  (Service, Hospitality, Subscription câblés ; Retail/Agency restent des
  `EconomicEngine` purs non branchés — limite assumée).
- `engine/simulation/businessResolution.ts` : résolution d'un mois pour une
  entreprise (effectif -> capacité -> moteur pur -> comptabilité ->
  trésorerie), réutilisée par la boucle mensuelle pour chaque entreprise du
  portefeuille.
- **Tests** : validations strictes (action manquante, création dupliquée,
  budget d'heures fondateur dépassé), correction connexe de l'interface
  `EconomicEngine` (le type de retour ne portait pas les champs propres à
  chaque famille sous un vrai `tsc --noEmit` sur les tests).

### M9 — Vertical slices, démonstrateur CLI, tests de garde
- `src/scenarios/{service,hospitality,subscription}.ts` : politiques de
  décision cannées sur 20 ans (240 mois), réutilisées par les tests ET le
  CLI (jamais de branche dans le moteur pour garantir un résultat).
- `src/cli/run.ts` : démonstrateur headless (journal lisible par année,
  `--verify-determinism` pour comparer deux runs de même seed).
- **Tests** : 3 vertical slices longues (déterminisme, étapes traversées,
  issue cohérente), multi-entreprises simultanées de familles différentes,
  impossibilité de dépenser sans source de financement, effet de capacité/
  sur-effectif/sous-effectif, garde explicite anti-`Math.random`/`Date` sur
  tout `src/`.

## Hors périmètre de ces milestones
Voir `docs/SPEC_P0.md` §2 (IPO, M&A majeur, dynastie, etc.). Depuis M9.5,
les 5/5 familles économiques sont câblées dans l'orchestrateur — cette
limite n'existe plus.
