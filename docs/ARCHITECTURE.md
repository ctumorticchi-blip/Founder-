# FOUNDER — Architecture technique

## 1. Choix techniques

- **Langage** : TypeScript strict (`strict: true`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), ciblant Node.js ≥ 20 pour le moteur.
  Justification : typage statique fort demandé par le brief, écosystème de
  test mature, et un futur front web (React/Vite ou autre) consomme le même
  langage sans couche de traduction.
- **Runtime de test** : Vitest (rapide, TS natif, compatible avec un futur
  front Vite sans config dupliquée).
- **Package manager** : npm (déjà disponible, pas de dépendance à un outil
  supplémentaire pour un prototype).
- **Immutabilité** : les fonctions de simulation ne mutent jamais leurs
  paramètres ; elles retournent un nouvel état. Pas de classes à état mutable
  dans le cœur — uniquement des types de données + fonctions pures. Les
  classes sont acceptables uniquement comme conteneurs d'API (ex. RNG) mais
  jamais comme porteuses de logique métier cachée.
- **Pas de framework UI en P0.** Le P0 se termine par un moteur testable et,
  si le temps le permet, un harnais headless (CLI ou tests de scénario) qui
  prouve que l'UI n'aurait qu'à lire l'état. Aucun code de rendu n'est requis
  pour valider le P0.

## 2. Organisation des dossiers

```
/
  docs/
    SPEC_P0.md
    ARCHITECTURE.md
    MILESTONES.md
  src/
    types/                 # Types de domaine partagés (aucune logique)
      character.ts
      business.ts
      market.ts
      world.ts
      simulation.ts
    engine/
      rng/                 # RNG seedé déterministe
      time/                # Horloge mensuelle (GameDate)
      character/           # Character Engine
      world/               # World Engine (macro)
      market/              # Marchés
      business/            # Business Engine (comptabilité + trésorerie/crédit)
      employees/           # Employees/Organisation (effectif, capacité, coûts)
      economic-models/     # Retail, Service, Hospitality, Agency, Subscription
      competition/         # Competition Engine
      intelligence/        # Intelligence Engine (Truth -> PlayerView)
      narrative/           # Narrative Engine (événements, mémoire)
      simulation/          # Orchestrateur multi-entreprises (§10 spec)
    scenarios/              # Politiques de décision cannées (vertical slices,
                             # réutilisées par les tests ET le CLI — jamais de
                             # logique de simulation ici, uniquement des décisions)
    cli/                    # Démonstrateur headless (run.ts)
    index.ts               # Point d'entrée public du package moteur
  test/
    <miroir de src/>       # Tests unitaires par module
    scenarios/             # Trajectoires bout-en-bout : déterminisme, vertical
                            # slices longues, multi-entreprises
    guards/                # Gardes-fous transverses (ex. absence de
                            # Math.random/Date dans src/, au-delà d'ESLint)
  package.json
  tsconfig.json
  tsconfig.eslint.json      # Typecheck src+test (rootDir élargi), utilisé par
                             # `npm run typecheck:test` et par ESLint
  vitest.config.ts
  .eslintrc.cjs / eslint.config.js
```

Règle : un fichier de `engine/*` ne dépasse pas ~200-300 lignes ; au-delà, on
découpe par sous-domaine (ex. `business/accounting.ts`, `business/treasury.ts`)
plutôt que de laisser grossir un fichier unique.

### 2.1 Portefeuille multi-entreprises (consolidation post-P0)

`GameState.businesses` est une liste (`OwnedBusiness[]`), pas une entreprise
unique : le joueur peut posséder plusieurs entreprises, de familles
différentes, chacune sur son propre marché (`GameState.markets`/
`competitions` sont indexés par `marketId`). `engine/simulation/
businessResolution.ts` résout un mois pour UNE entreprise (effectif ->
capacité -> moteur économique pur -> comptabilité -> trésorerie) ; `engine/
simulation/simulateMonth.ts` boucle sur toutes les entreprises actives du
portefeuille. Ajouter une famille supplémentaire à l'orchestrateur = ajouter
un cas dans le switch de `businessResolution.ts`, sans toucher à la boucle
mensuelle elle-même.

Limite assumée : seules les familles Service, Hospitality et Subscription
sont câblées dans l'orchestrateur. Retail et Agency restent des
`EconomicEngine` purs et testés isolément (M3) mais pas encore branchés —
même mécanique à suivre le jour où c'est nécessaire.

### 2.2 Trésorerie et employés comme systèmes transversaux

- `engine/business/treasury.ts` porte la trésorerie (spec §3.9) : cash
  toujours ≥ 0, ligne de crédit avec plafond, compteur de mois de découvert
  non couvert, insolvabilité. Aucun moteur économique n'y touche
  directement ; seule `businessResolution.ts` orchestre l'appel après avoir
  assemblé le compte de résultat du mois.
- `engine/employees/employees.ts` porte l'effectif agrégé (spec §3.9) :
  recrutement/licenciement avec coût réel, masse salariale, traduction
  effectif <-> heures de production (modulée par le leadership du
  fondateur). Chaque famille économique traduit différemment capacité et
  effectif requis (heures pour Service/Hospitality, effectif support pour
  Subscription) — cette traduction vit dans `businessResolution.ts`, jamais
  dans les moteurs économiques eux-mêmes (qui restent inchangés depuis M3).

## 3. Flux de données

```
GameState (Truth) --[simulateMonth(state, actions, seed)]--> GameState' (Truth)
GameState' --[projectToPlayerView(state', character.skills)]--> PlayerView
```

- `GameState` est **sérialisable en JSON** (pas de fonctions, pas de classes
  avec méthodes dans l'état persistant) — condition nécessaire pour la
  sauvegarde/chargement et pour les tests de déterminisme par snapshot.
- `simulateMonth` est la seule porte d'entrée de progression du temps. Elle
  exécute les 12 étapes de la boucle mensuelle (§10 de la spec) dans un
  ordre fixe, chaque étape étant une fonction pure
  `(state, ctx) => state` composée séquentiellement.
- Le RNG n'est jamais un singleton global : une graine dérivée
  (`deriveSeed(baseSeed, year, month, stepName)`) est passée explicitement à
  chaque étape qui a besoin d'aléatoire, pour que l'ordre d'exécution interne
  d'une étape n'affecte pas la consommation d'aléatoire d'une autre étape.

## 4. Modules et responsabilités

- **World Engine** : macro-économie (inflation, croissance globale, taux
  d'intérêt de référence) et vieillissement des marchés.
- **Character Engine** : compétences, budget de temps, vie personnelle,
  progression.
- **Business Engine** : structure comptable commune (P&L, trésorerie, bilan
  minimal), consolidation des contributions des `EconomicEngine` actifs
  d'une entreprise.
- **Economic Models** : une implémentation par famille (`RetailEngine`,
  `ServiceEngine`, `HospitalityEngine`, `AgencyEngine`,
  `SubscriptionEngine`), toutes conformes à une interface commune
  `EconomicEngine.computeMonth(input): EconomicContribution`.
- **Competition Engine** : entreprises de fond agrégées (statistiques de
  marché) + concurrents identifiés (entités simulées avec un état simplifié)
  — les "entrepreneurs majeurs persistants" sont hors P0 mais le type
  `Competitor` prévoit un champ `tier` extensible.
- **Intelligence Engine** : transforme `Truth` en `PlayerView` via un modèle
  de bruit paramétré par compétence (§9 de la spec).
- **Narrative Engine** : génère des événements contextuels à partir de
  l'état (pas de scénario scripté ad hoc) et alimente la mémoire long terme
  (`MemoryLedger`) consultée par les étapes futures.

## 5. Déterminisme

- RNG : PRNG seedé (`mulberry32` ou équivalent), jamais `Math.random`.
- Toute fonction qui a besoin d'aléatoire reçoit soit un `RNG` déjà
  instancié, soit une seed dérivée explicite — jamais un état global mutable
  partagé implicitement entre modules.
- Un test de scénario doit vérifier : `simulate(seed, actions)` appelé deux
  fois produit un résultat structurellement égal (`toEqual`).

## 6. Séparation moteur / interface

- Le package moteur n'importe **aucune** dépendance de rendu (pas de React,
  pas de DOM). Un test CI simple peut vérifier l'absence de telles
  dépendances dans `package.json` du moteur le jour où une UI est ajoutée en
  package séparé.
- Toute grandeur dérivée affichable (ex. "runway en mois") est calculée par
  une fonction du moteur (`selectors/*`), jamais recalculée dans la couche
  d'affichage à partir de données brutes.

## 7. Stratégie de test

- **Unitaire** : chaque fonction pure de `engine/*` a des tests dédiés
  (cas nominal, cas limite, invariant).
- **Propriété/invariant** : ex. "le résultat net peut être positif alors que
  le cash-flow est négatif" doit être démontrable par un test construit à
  cet effet (§6 de la spec).
- **Scénario** : `test/scenarios/*` simule plusieurs mois/années et vérifie
  des propriétés globales (pas de crash sur 120 mois, déterminisme,
  possibilité de faillite ET de succès selon les décisions).
- Aucun test ne dépend de l'horloge système ni d'aléatoire non seedé.

## 8. Évolutivité vers P1+

- Ajout d'un nouveau moteur économique = nouvelle implémentation de
  `EconomicEngine`, sans toucher à la boucle mensuelle.
- Ajout d'un module M&A/IPO/dynastie = nouveaux modules sous `engine/`,
  branchés comme étapes supplémentaires ou extensions de `Business Engine` /
  `Character Engine`, sans changer la structure comptable existante.
- Une UI future consomme `PlayerView` + envoie des `PlayerAction[]` ; elle
  peut être ajoutée comme package séparé (`apps/web`) sans modifier le
  moteur.
