# FOUNDER — M11 « From Founder to CEO » — Plan d'implémentation

Réfère : `docs/superpowers/specs/2026-09-07-founder-m11-design.md` (spec
validée). Ce plan découpe M11 en 5 sous-milestones **réellement
indépendantes et testables**. Seule **M11.1** est implémentée dans cette
passe. M11.2–M11.5 sont décrites au niveau architecture pour ne pas leur
fermer de porte (le principe central §2 de la spec s'applique déjà à
elles), sans code produit ici.

Indépendance entre sous-milestones : chacune ajoute des catalogues/écrans
sans modifier la frontière moteur/UI posée par M11.1, et sans dépendre
d'un livrable non fait des autres. M11.1 est un pré-requis *technique*
pour toutes les suivantes (elle introduit `businessIdentities`, le motif
catalogue → agrégation pure → `BusinessAction`), mais M11.3, M11.4 ne
dépendent pas du contenu métier de M11.2, etc.

---

## M11.1 — Business Identity & Explainable Costs (implémentée maintenant)

### Objectif

Cf. Definition of Done du brief : nom réel à la création, jamais d'id
technique affiché, infrastructure/administratif/investissement en
catalogues explicables, conséquences visibles, plusieurs mois jouables,
reload sans perte, anciennes sauvegardes migrées sans crash.

### Découpage en tâches testables

#### T1 — Moteur : nom commercial réel (I1, I3, I5)

Fichiers : `src/engine/simulation/types.ts`,
`src/engine/simulation/businessResolution.ts`,
`src/engine/business/treasury.ts`, `src/engine/simulation/simulateMonth.ts`.

- Ajouter `readonly name: string` aux 5 variantes de `CreateBusinessSpec`.
- `createOwnedBusiness` : `createBusiness(spec.name, [spec.family], ...)`
  au lieu de `createBusiness(id, ...)`.
- `createBusiness` (treasury.ts) : lever `RangeError` si `name.trim()`
  est vide, à côté des validations existantes.
- `simulateMonth.ts` : les 3 messages d'événements utilisent
  `owned.business.name` au lieu de `owned.id`.

Tests (nouveaux, engine) :
- `createBusiness` rejette un nom vide/blanc.
- `createOwnedBusiness` produit un `OwnedBusiness.business.name` égal à
  `spec.name` (pas à `id`).
- `simulateMonth` : le message `business-created` contient le nom fourni,
  pas l'id technique généré.
- Garde de non-régression : les 230 tests existants passent sans
  modification de leurs assertions (seuls les littéraux gagnent `name:`).

Critère de fait : `npm test` (racine) vert, aucune assertion existante
modifiée (diff des fichiers de test ne touche que l'ajout du champ
`name:` dans les littéraux `CreateBusinessSpec`).

#### T2 — Web : catalogues de données (I2)

Fichiers (nouveaux) : `web/src/data/infrastructure.ts`,
`web/src/data/adminServices.ts`, `web/src/data/capexCatalog.ts`.

- Catalogues statiques tels que décrits spec §4.2–§4.4 (4 infra, 5
  composants admin, 4 items CAPEX).
- Pas de fonction, pure donnée + éventuel type `EconomicFamily` importé
  pour `suitableFamilies`.

Tests : un test de forme (« chaque option a un id unique, un coût ≥ 0 »)
suffit — c'est de la donnée statique, pas de la logique.

#### T3 — Web : agrégation pure (I2)

Fichier (nouveau) : `web/src/state/businessCosts.ts`.

- `computeInfrastructureMonthlyCost(infrastructureId): number`
- `computeInfrastructureSetupCost(infrastructureId): number`
- `computeAdminMonthlyCost(optionalIds: readonly string[]): number`
  (= somme des `required` + somme des optionnels cochés)
- `computePurchasesCost(purchases: readonly {itemId, quantity}[]): number`

Toutes pures, sans I/O, sans aléa, testées unitairement (cas limites :
liste vide, id inconnu → 0 ou erreur explicite selon le cas, quantité 0).

Tests (TDD, écrits avant l'implémentation) : couvrent chaque fonction
avec plusieurs combinaisons (aucun optionnel, tous les optionnels, id
infra invalide, panier d'achats vide/multiple).

#### T4 — Web : identité d'entreprise

Fichiers : `web/src/state/types.ts` (+ `BusinessIdentity`),
`web/src/state/businessIdentity.ts` (nouveau —
`defaultBusinessIdentity(family, date)`).

- Type `BusinessIdentity` tel que spec §3.2.
- `defaultBusinessIdentity` : pure, dérive nom/description depuis
  `web/src/data/opportunities.ts` (le template de la famille) — utilisée
  à la fois pour pré-remplir `CreateBusinessScreen` et pour la migration
  de sauvegarde (T9).

Tests : `defaultBusinessIdentity` retourne un nom non vide et cohérent
pour chacune des 5 familles.

#### T5 — Web : types d'état (`BusinessDraft`, `SaveGameV1`, `BusinessMonthSummary`)

Fichier : `web/src/state/types.ts`.

- `BusinessDraft` : retire `rentBudget`, `adminBudget`, `capex` ; ajoute
  `infrastructureId: string`, `adminOptionalIds: readonly string[]`,
  `purchases: readonly { itemId: string; quantity: number }[]`,
  `name: string` (pour l'écran de création), `description`, `activity`,
  `targetCustomers` (idem, portés par le draft avant validation).
- `SaveGameV1` : ajoute `businessIdentities: Record<string, BusinessIdentity>`.
- `BusinessMonthSummary` : ajoute `displayName: string`.

Pas de test dédié (types), couvert par la compilation stricte + les tests
d'intégration T8/T10.

#### T6 — Web : `draft.ts` (`buildMonthActions`, `deriveNextDraft`)

Fichier : `web/src/state/draft.ts`.

- `buildMonthActions` : calcule `rentBudget = computeInfrastructureMonthlyCost(infrastructureId)`,
  `adminBudget = computeAdminMonthlyCost(adminOptionalIds)`,
  `capex = computePurchasesCost(purchases) + (isNew ? computeInfrastructureSetupCost(infrastructureId) : 0)`.
  Reste une fonction pure (I2) : ne fait qu'agréger, n'appelle jamais le
  moteur.
- `deriveNextDraft` : reset `purchases: []` chaque mois (corrige le bug
  latent §1.5 de la spec), conserve `infrastructureId`/`adminOptionalIds`
  (décisions durables, pas un achat ponctuel).

Tests (TDD) :
- `buildMonthActions` avec une infra + 2 admin optionnels + 1 achat
  produit les bons `rentBudget`/`adminBudget`/`capex`.
- `buildMonthActions` sur un mois de création (`isNew: true`) inclut le
  `setupCost` dans `capex` ; sur un mois normal, non.
- `deriveNextDraft` : après un mois avec des achats, le draft suivant a
  `purchases: []` alors que `infrastructureId`/`adminOptionalIds` sont
  conservés (non-régression du bug §1.5, testé explicitement).

#### T7 — Web : `GameProvider.tsx`

Fichier : `web/src/state/GameProvider.tsx`.

- Nouvelle tranche d'état `businessIdentities` dans `AppState`.
- `START_BUSINESS` : construit la `BusinessIdentity` depuis les champs du
  draft (nom saisi par le joueur, description/activité/clientèle),
  `createdAt` = date de jeu courante ; l'ajoute à `businessIdentities`
  keyed par l'id généré ; passe `name` dans le `CreateBusinessSpec` réel
  envoyé au moteur (cf. T1).
- `computeRecap`/tout calcul de `BusinessMonthSummary` : renseigne
  `displayName` depuis `businessIdentities[id].displayName` (jamais
  `id`/`business.name` lus directement dans l'UI — invariant I1).
- `init()` : délègue la migration de sauvegarde à `storage.ts` (T9), ne
  duplique pas la logique de migration ici.

Tests : test d'intégration (voir T11) plutôt qu'unitaire isolé — le
reducer est déjà couvert via les tests d'écran existants.

#### T8 — Web : migration de sauvegarde

Fichier : `web/src/lib/storage.ts`.

- `loadSave()` applique, après le parse JSON et la vérification
  `version === 1`, la migration défensive décrite spec §6.2 (3 étapes :
  `businessIdentities` par défaut à `{}`, synthèse d'identité par
  entreprise sans entrée, reconstruction de `draft.business` si forme
  legacy détectée via absence de `infrastructureId`).
- Fonction extraite et pure : `migrateSaveGame(raw: unknown): SaveGameV1`
  (ou équivalent), testable indépendamment du localStorage.

Tests (TDD, critiques pour la DoD « anciennes sauvegardes sans crash ») :
- Une sauvegarde M10 fixture (forme `rentBudget`/`adminBudget`/`capex`,
  pas de `businessIdentities`) est migrée sans exception et produit un
  `SaveGameV1` valide avec `businessIdentities` peuplé et
  `draft.business.infrastructureId` défini.
- Une sauvegarde M11.1 déjà à jour traverse `migrateSaveGame` sans
  modification (idempotence).
- Une sauvegarde corrompue/vide continue de déclencher le comportement
  actuel de `loadSave()` (nouvelle partie), pas un crash.

#### T9 — Web : écrans

Fichiers : `web/src/screens/CreateBusinessScreen.tsx`,
`BusinessScreen.tsx`, `FinancesScreen.tsx`, `MonthRecapModal.tsx`, et
nouveaux composants partagés `web/src/components/business/
{InfrastructurePicker,AdminBreakdown,CapexPicker}.tsx`.

- `CreateBusinessScreen` : carte Identité (nom obligatoire — validation
  non-vide avant activation du bouton Créer ; description/activité/
  clientèle pré-remplies via `defaultBusinessIdentity`, éditables) ;
  `InfrastructurePicker` remplace le `NumberField` Loyer ;
  `AdminBreakdown` remplace le `NumberField` Administratif ;
  `CapexPicker` remplace le `NumberField` Investissement ponctuel.
- `BusinessScreen` : titre = `businessIdentities[id].displayName` ;
  mêmes 3 composants partagés, réutilisés en mode édition.
- `FinancesScreen` : en-tête = `displayName` ; ligne Loyer affiche le
  libellé de l'infrastructure active ; ligne Administratif liste les
  composants inclus (traçabilité, cf. brief UX).
- `MonthRecapModal` : `summary.displayName` au lieu de `summary.id`.

Tests (RTL, TDD) :
- Créer une entreprise avec un nom personnalisé → le nom apparaît sur
  `BusinessScreen`/`FinancesScreen`/`MonthRecapModal`, l'id technique
  n'apparaît **nulle part** dans le DOM rendu (assertion négative
  `queryByText(/service-|resto-|shop-/)` ou équivalent par préfixe d'id).
  et jamais `queryByText(/^[a-z-]+-[0-9a-f]{8}$/)` — deux assertions
  négatives complémentaires (I1, testé au niveau UI, pas seulement
  unitaire).
- Sélectionner une infrastructure différente change le loyer affiché dans
  `FinancesScreen` au mois suivant.
- Cocher un composant administratif optionnel change le total affiché.
- Acheter un item CAPEX au mois N, vérifier qu'il **n'est plus** proposé/
  facturé au mois N+1 sans re-sélection (non-régression bug §1.5).

#### T10 — Validation complète

- `npm test`, `npm run typecheck`, `npm run typecheck:test` (si script
  distinct — sinon `typecheck` couvre `test/`), `npm run lint` à la
  racine (moteur).
- `cd web && npm test && npm run typecheck && npm run lint && npm run build`.
- Tout doit être vert avant commit (aucune exception).

#### T11 — Playtest mobile

- Playwright, viewport iPhone (comme M10c) : parcours complet — créer une
  entreprise avec un nom choisi, vérifier absence totale d'id technique à
  l'écran, choisir une infra, cocher de l'administratif, acheter un
  CAPEX, avancer plusieurs mois, vérifier `FinancesScreen` traçable,
  recharger la page (simulateur de refresh) et vérifier la persistance,
  charger une fixture de sauvegarde M10 et vérifier l'absence de crash et
  la présence d'un nom par défaut lisible.

#### T12 — Commit/push

Un seul commit (ou une suite de commits atomiques par tâche T1–T9, au
choix pendant l'implémentation, mais tout doit être vert avant push final)
sur `main`, uniquement une fois T10 et T11 passés.

### Fichiers touchés (récapitulatif M11.1)

**Moteur** (minimal, chirurgical) :
`src/engine/simulation/types.ts`,
`src/engine/simulation/businessResolution.ts`,
`src/engine/business/treasury.ts`,
`src/engine/simulation/simulateMonth.ts`,
+ tests correspondants,
+ tous les littéraux `CreateBusinessSpec` existants (tests, scénarios
CLI, `web/src/data/opportunities.ts`) gagnent `name:`.

**Web** (nouveau + modifié) :
`web/src/data/{infrastructure,adminServices,capexCatalog}.ts` (nouveaux),
`web/src/state/businessCosts.ts` (nouveau),
`web/src/state/businessIdentity.ts` (nouveau),
`web/src/components/business/{InfrastructurePicker,AdminBreakdown,CapexPicker}.tsx` (nouveaux),
`web/src/state/types.ts`, `web/src/state/draft.ts`,
`web/src/state/GameProvider.tsx`, `web/src/lib/storage.ts`,
`web/src/screens/{CreateBusinessScreen,BusinessScreen,FinancesScreen,MonthRecapModal}.tsx`,
+ tests correspondants (nouveaux et étendus).

---

## M11.2 — Offer & Customer (architecture seulement, non codée)

Objectif produit (rappel brief) : le joueur définit une offre (produit/
service, positionnement, prix) et un profil de clientèle cible, plutôt
que des paramètres démographiques abstraits.

Architecture prévue, cohérente avec le principe central (§2 spec) :
- Catalogue web `web/src/data/offerTemplates.ts` (positionnement bas de
  gamme/milieu/haut de gamme par famille, avec effets *indicatifs* sur
  `pricePoint`/`qualityLevel` déjà consommés aujourd'hui par
  `BusinessFamilyDecisions` — **aucun nouveau champ moteur nécessaire a
  priori**, `pricePoint`/`qualityLevel` existent déjà dans les décisions
  par famille).
- Si un besoin de nouveau paramètre économique émerge (ex. segmentation
  clientèle affectant la demande), il doit être ajouté au moteur comme
  **entrée pure** de `EconomicFamilyEngine`, jamais recalculé côté web —
  même frontière que M11.1.
- Indépendance vis-à-vis de M11.1 : consomme `businessIdentities`
  (`activity`, `targetCustomers` déjà présents depuis M11.1) sans les
  redéfinir ; n'a pas besoin d'infrastructure/CAPEX pour être testée.
- Testabilité : catalogue statique + fonction pure de mapping
  offre-choisie → `BusinessFamilyDecisions`, testée comme T3 de M11.1.

## M11.3 — Sales & Marketing (architecture seulement, non codée)

Objectif produit : remplacer `marketingBudget: number` libre (laissé tel
quel en M11.1, §4.5 spec) par des canaux/actions concrets (prospection
fondateur, recrutement commercial, campagnes publicitaires, SEO/contenu).

Architecture prévue :
- Catalogue web `web/src/data/marketingChannels.ts` (coût, portée
  indicative, familles pertinentes).
- Agrégation pure web → `marketingBudget: number` (même motif que
  `computeInfrastructureMonthlyCost`), **aucun changement moteur** tant
  que le moteur continue de consommer un budget total — cohérent avec le
  constat spec §1.7 (« `resolveBusinessMonth` consomme déjà ces valeurs
  comme de simples nombres »).
- Si une action marketing doit avoir un effet différencié (ex. SEO =
  effet différé, pub = effet immédiat mais volatil), cela nécessite une
  extension **moteur** explicite (nouveau champ dans
  `BusinessAction`/`EconomicContribution`) — hors scope tant que non
  spécifié en détail ; l'architecture ne doit pas bloquer cette extension
  (le catalogue web reste séparable du calcul moteur).
- Indépendance : ne touche pas `businessIdentities`/infrastructure/admin ;
  testable isolément (catalogue + agrégation pure).

## M11.4 — Organisation & Delegation (architecture seulement, non codée)

Objectif produit : structurer l'effectif en rôles/équipes délégables
plutôt qu'un simple `targetHeadcount` global, en respectant la
progressivité (solo → petite équipe → PME, board avancé explicitement
exclu).

Architecture prévue :
- Le moteur a déjà un système d'effectifs/capacité (`M6`) —
  `computeWorkforceCapacityHours`, coûts par tête. M11.4 ajouterait
  côté web un catalogue de **rôles** (ex. « Commercial », « Opérateur »,
  « Support ») mappés sur les mêmes paramètres moteur existants
  (headcount, coût, capacité), sans nouvelle mécanique moteur nécessaire
  dans un premier temps.
- Délégation (le joueur ne décide plus tout chaque mois) nécessiterait
  une extension moteur explicite (règles de décision par défaut par
  rôle) — à spécifier en détail avant implémentation, non anticipée ici
  au-delà de noter qu'elle devrait rester déterministe (pas de nouvel
  aléa).
- Indépendance : consomme le système d'effectifs moteur existant
  (inchangé depuis M6), pas de dépendance sur M11.2/M11.3.

## M11.5 — Universal Business Builder (architecture seulement, non codée)

Objectif produit : création d'entreprise en langage naturel, avec
interprétation assistée par IA mais **exécution moteur déterministe** et
**repli non-IA obligatoire**. Aucune API IA payante sans validation
préalable (contrainte explicite du brief, rappelée ici).

Architecture prévue (haut niveau uniquement, à re-spécifier en détail
avant tout code) :
- Une couche d'interprétation (optionnelle, IA ou heuristique locale)
  traduit un texte libre en un `CreateBusinessSpec` **structuré et
  validé** — jamais en effets économiques directs. La sortie de cette
  couche est un brouillon (`BusinessDraft` pré-rempli), toujours
  modifiable et validable par le joueur avant `START_BUSINESS`, exactement
  comme le flux M11.1 actuel.
- Repli non-IA obligatoire : un mode « mots-clés → template le plus
  proche parmi `opportunities.ts` » doit fonctionner sans aucun appel
  réseau, pour garantir que le jeu reste jouable hors-ligne / sans clé
  API. C'est la spécification minimale du repli, pas une implémentation.
- Aucun accès moteur direct depuis la couche d'interprétation : elle ne
  fait que produire un `CreateBusinessSpec` que le pipeline standard
  (`buildMonthActions` → `simulateMonth`) consomme sans distinction avec
  une création manuelle — garantit le déterminisme du moteur quelle que
  soit la source de l'interprétation.
- Indépendance : réutilise le flux de création de M11.1 tel quel (aucune
  modification du moteur ni de `businessIdentities` requise) ; peut être
  développée et testée séparément des autres sous-milestones tant que le
  flux `CreateBusinessScreen`/`START_BUSINESS` reste stable.

---

## Rappel : ce qui n'est pas fait dans cette passe

Seule **M11.1** est implémentée (T1–T12 ci-dessus). M11.2–M11.5 restent
au stade architecture — aucun code, aucun catalogue, aucune donnée créés
pour elles dans ce plan. Le prochain travail ne commence qu'après revue
du playtest M11.1 par l'utilisateur, sur instruction explicite.
