# FOUNDER — M11 « From Founder to CEO » — Spécification de conception

Statut : validée pour implémentation de **M11.1 uniquement**. M11.2–M11.5
sont décrites ici au niveau produit/architecture pour que M11.1 ne les
bloque pas, mais ne sont pas implémentées dans cette passe.

Base : `main` à `9cb85c8` (P0/M10 validés, moteur à 230 tests, web à 11
tests, tous verts).

## 1. Contexte et diagnostic (inspection de `main`)

Lecture de `src/types/business.ts`, `src/engine/simulation/{types,
businessResolution,simulateMonth}.ts`, `src/engine/business/{accounting,
treasury}.ts`, `web/src/state/{GameProvider,draft,types}.ts`,
`web/src/screens/{CreateBusinessScreen,BusinessScreen,FinancesScreen,
OpportunitiesScreen,WorkforceScreen,MonthRecapModal}.tsx`,
`web/src/lib/storage.ts`, `web/src/data/opportunities.ts`.

Constats confirmés :

1. **`BusinessState.name` existe déjà** dans le moteur (spec P0 §6/§9.5)
   mais `businessResolution.ts::createOwnedBusiness(id, spec)` appelle
   `createBusiness(id, ...)` — il passe l'**identifiant technique** comme
   nom. Le champ `name` n'a donc jamais été un vrai nom commercial en
   pratique ; c'est un bug de câblage, pas un défaut de conception. Aucun
   test moteur n'assert sur la valeur de `.name` (vérifié par grep) : le
   corriger ne casse rien.
2. `BusinessScreen.tsx:53`, `FinancesScreen.tsx:29` et
   `MonthRecapModal.tsx:34` affichent `businessId`/`business.id`
   directement au joueur — c'est le `service-eca32ce8` signalé.
3. `simulateMonth.ts` construit ses messages d'événements
   (`business-created`, `business-liquidated`, `cash-crisis-warning`) avec
   `owned.id` — mêmes symptômes, côté moteur cette fois (fuit dans
   `GameEvent.message`, donc dans `NewsScreen`/`MonthRecapModal`).
4. `BusinessDraft` (web) stocke `rentBudget`/`adminBudget`/`capex` comme
   trois nombres bruts saisis librement par le joueur
   (`CreateBusinessScreen.tsx`, `BusinessScreen.tsx`) — exactement les
   « champs arbitraires » à supprimer.
5. **Bug latent trouvé pendant l'inspection** : `deriveNextDraft` (web,
   `state/draft.ts`) ne réinitialise jamais `capex` d'un mois sur l'autre
   (seuls `isNew`, `createSpec`, `targetHeadcount`, `capitalInjection` sont
   remis à zéro/null). Un investissement ponctuel saisi une fois continue
   donc d'être soumis **tous les mois suivants** tant que le joueur ne le
   remet pas manuellement à 0. La refonte en « achats du mois » (§4.4)
   corrige ce bug de facto (la liste d'achats est vidée chaque mois).
6. `MonthDraft`/`SaveGameV1` n'ont pas de notion d'identité d'entreprise
   (nom commercial, description, activité, clientèle, date de création) :
   à ajouter, hors du moteur (voir §3).
7. `computeMonthlyFinancials`/`applyMonthlyCashFlow`/`resolveBusinessMonth`
   consomment déjà `rentBudget`/`adminBudget`/`capex` comme de simples
   **nombres d'entrée** (`BusinessAction.rentBudget: number`, etc.) — rien
   dans leur signature n'exige que ces nombres viennent d'une saisie libre.
   Un catalogue web qui calcule ces totaux et les fournit tels quels au
   moteur ne change **aucune** ligne du moteur pour le loyer/administratif/
   investissement.

## 2. Principe central (rappel du brief, engagement de conception)

> Le joueur prend des décisions d'entrepreneur. Le moteur transforme ces
> décisions en conséquences économiques.

Traduction architecturale : une « décision d'entrepreneur » (choisir un
local, cocher une assurance, acheter un ordinateur) est un **choix dans un
catalogue de données**, pas un nombre libre. Le catalogue vit côté web
(donnée de présentation/produit, pas de simulation). La **conséquence**
(effet sur EBITDA, cash-flow, trésorerie, impayés, insolvabilité) reste
calculée à 100 % par le moteur existant, inchangé. Le pont entre les deux
est une fonction pure web (« agrégation de panier », pas de simulation :
aucun aléa, aucune règle comptable, seulement une somme de prix catalogue)
qui traduit un choix catalogue en `rentBudget`/`adminBudget`/`capex`
avant d'appeler `simulateMonth`.

Ce principe fixe la frontière moteur/UI pour tout M11 :

| Question | Réponse |
|---|---|
| Le catalogue (options, prix, libellés) vit où ? | Web (`web/src/data/*`), donnée de produit. |
| La somme des prix choisis vit où ? | Web, fonction pure sans aléa ni règle économique (`web/src/state/businessCosts.ts`). |
| L'effet sur EBITDA/trésorerie/impayés vit où ? | Moteur, inchangé (`computeMonthlyFinancials`, `applyMonthlyCashFlow`). |
| Le nom commercial vit où ? | **Moteur** (`BusinessState.name`) : c'est un fait de la partie simulée (traverse `GameState`, apparaît dans les messages d'événements générés par le moteur), pas une donnée de présentation. |
| Description/activité/clientèle/date de création vivent où ? | Web (`businessIdentities`), métadonnées narratives sans effet économique, pour ne pas alourdir `BusinessState` avec des champs que le moteur n'utilise jamais. |

## 3. Identité d'entreprise

### 3.1 Nom commercial — côté moteur

- `CreateBusinessSpec` (5 variantes) gagne un champ commun
  `readonly name: string`.
- `businessResolution.ts::createOwnedBusiness` passe `spec.name` (au lieu
  de `id`) à `createBusiness(...)`.
- `engine/business/treasury.ts::createBusiness` rejette un nom vide/blanc
  (`RangeError`), cohérent avec ses validations existantes
  (`creditLineLimit`, `families.length`).
- `simulateMonth.ts` : les messages `business-created`,
  `business-liquidated`, `cash-crisis-warning` référencent
  `owned.business.name` (le vrai nom) au lieu de `owned.id`.
- **Aucun changement de schéma** : `BusinessState.name` existe déjà dans
  `GameState` depuis le P0. Une sauvegarde M10 reste structurellement
  valide (`name` existe, juste avec une ancienne valeur — voir §6).

### 3.2 Description/activité/clientèle/date de création — côté web

Nouveau type `BusinessIdentity` (`web/src/state/types.ts`) :

```ts
interface BusinessIdentity {
  readonly displayName: string; // dupliqué depuis business.name à la création, pour affichage offline-safe
  readonly description: string;
  readonly activity: string;
  readonly targetCustomers: string;
  readonly createdAt: GameDate;
}
```

Stocké dans `AppState.businessIdentities: Record<businessId, BusinessIdentity>`
et persisté dans `SaveGameV1.businessIdentities`. Rempli une fois à la
création (`CreateBusinessScreen`), non renommable en M11.1 (hors DoD).

**Pourquoi dupliquer `displayName` plutôt que de toujours relire
`business.business.name` ?** Pour que l'affichage reste correct même pour
les entreprises migrées depuis une sauvegarde M10 (§6), où
`business.name` contient encore l'ancien identifiant technique et ne doit
jamais être lu directement par l'UI.

**Invariant I1** : l'UI (écrans, modales, récap) n'affiche **jamais**
`OwnedBusiness.id` ni `business.business.name` directement. Toute
apparition du nom d'une entreprise passe par
`businessIdentities[id]?.displayName` (avec repli défensif décrit en §6.2,
qui ne doit normalement jamais être exercé une fois la migration en place).

## 4. Coûts explicables

### 4.1 Frontière moteur inchangée

`BusinessAction.rentBudget: number`, `.adminBudget: number`,
`.capex?: number` restent des nombres simples. Rien ne change dans
`types/business.ts`, `businessResolution.ts` (hors §3.1),
`accounting.ts`, `treasury.ts`. Les scénarios CLI (`src/scenarios/*.ts`)
et les tests moteur existants continuent de passer des nombres bruts —
ils ne passent pas par les catalogues web (qui n'existent que côté UI).

### 4.2 Infrastructure (remplace « Loyer »)

`web/src/data/infrastructure.ts` — catalogue statique :

```ts
interface InfrastructureOption {
  readonly id: string;
  readonly label: string;
  readonly monthlyCost: number;
  readonly setupCost: number;          // facturé une fois, au mois de création uniquement (§4.2.1)
  readonly capacityDescription: string; // texte informatif, pas une contrainte moteur
  readonly pros: readonly string[];
  readonly cons: readonly string[];
  readonly suitableFamilies?: readonly EconomicFamily[]; // absent = toutes familles
}
```

4 options V1 : **Domicile** (0 €/mois, familles sans local physique
requis), **Coworking** (250 €/mois), **Petit bureau/local** (900 €/mois,
2 000 € d'installation), **Bureau/local intermédiaire** (2 500 €/mois,
8 000 € d'installation). `hospitality` exclut Domicile et Coworking (un
café a besoin d'un local — filtré via `suitableFamilies`).

`capacityDescription`/`maxHeadcount` sont **informatifs uniquement** en
M11.1 (« ne pas construire un simulateur immobilier complexe ») : aucune
contrainte moteur n'y est adossée. Un futur milestone pourra les relier à
`computeWorkforceCapacityHours` si le besoin se confirme.

#### 4.2.1 Coût d'installation — portée assumée

Le coût d'installation (`setupCost`) est facturé **uniquement au mois de
création de l'entreprise** (`isNew === true`), inclus dans le CAPEX du
mois. Changer d'infrastructure sur une entreprise existante change le
loyer mensuel dès le mois choisi, **sans** refacturer de coût
d'installation en M11.1 (pas de suivi de « l'infrastructure précédente »
entre deux sessions d'édition du brouillon). **Limite assumée**,
documentée comme telle — un vrai « coût de déménagement » réactivable
plus tard sans changement de schéma (il suffira de comparer l'infra
active persistée à la nouvelle sélection).

### 4.3 Administratif (remplace « Administratif »)

`web/src/data/adminServices.ts` :

```ts
interface AdminComponent {
  readonly id: string;
  readonly label: string;
  readonly monthlyCost: number;
  readonly required: boolean; // true = toujours inclus, non désactivable
  readonly description: string;
}
```

5 composants V1 : **Frais bancaires pro** (25 €, requis), **Assurance
professionnelle** (45 €, requis), **Comptabilité** (120 €, requis),
**Logiciels & outils** (60 €, optionnel), **Conformité & licences**
(80 €, optionnel). Le total = somme des `required` + somme des optionnels
cochés par le joueur (`BusinessDraft.adminOptionalIds: readonly string[]`).
Fonction pure `computeAdminMonthlyCost(optionalIds)` dans
`web/src/state/businessCosts.ts`.

### 4.4 Investissements (remplace « Investissement ponctuel »)

`web/src/data/capexCatalog.ts` :

```ts
interface CapexItem {
  readonly id: string;
  readonly label: string;
  readonly unitCost: number;
  readonly description: string;
}
```

4 items V1 : **Ordinateur professionnel** (1 200 €), **Mobilier**
(600 €), **Matériel professionnel** (2 500 €), **Aménagement des locaux**
(5 000 €). `BusinessDraft.purchases: readonly { itemId: string; quantity:
number }[]` — liste des achats **de ce mois seulement**, remise à `[]`
par `deriveNextDraft` après chaque résolution (corrige le bug §1.5).
`computePurchasesCost(purchases)` (pure) + coût d'installation de
l'infrastructure si `isNew` (§4.2.1) = `capex` transmis au moteur.

### 4.5 Marketing — hors scope M11.1

`marketingBudget` reste un nombre saisi librement (`NumberField`). La
refonte (prospection fondateur, commerciaux, publicité, SEO...) est
explicitement M11.3 (Sales & Marketing) — ne pas l'anticiper ici.

## 5. Écrans impactés

- **CreateBusinessScreen** : + carte Identité (nom obligatoire,
  description/activité/clientèle pré-remplies depuis le template
  d'opportunité, éditables) ; carte Décisions inchangée ; **Lieu de
  travail** (sélecteur d'infrastructure, remplace le champ Loyer) ;
  **Charges administratives** (composants requis affichés + optionnels à
  cocher, remplace le champ Administratif) ; **Investissements de
  lancement** (catalogue avec quantités, remplace Investissement
  ponctuel) ; Effectif au lancement + budget marketing (inchangés) ;
  Paramètres avancés (ligne de crédit, taux, salaire — inchangés).
- **BusinessScreen** : titre = `businessIdentities[id].displayName` (plus
  jamais `businessId`) ; mêmes sections Lieu de travail/Charges
  administratives/Investissements que CreateBusinessScreen, réutilisées
  via des composants partagés (`components/business/InfrastructurePicker`,
  `AdminBreakdown`, `CapexPicker`).
- **FinancesScreen** : en-tête = `displayName` ; dans le détail comptable
  dépliable, la ligne Loyer affiche l'infrastructure active
  (`"Loyer — Coworking"`), la ligne Administratif affiche la liste des
  composants inclus — traçabilité directe demandée par le brief UX
  (« permettre idéalement d'en comprendre l'origine »).
- **MonthRecapModal**, **NewsScreen** : `BusinessMonthSummary` gagne
  `displayName` (calculé une fois dans `computeRecap`, pas relu à
  l'affichage) ; les messages d'événements (déjà corrigés côté moteur,
  §3.1) s'affichent nom-first sans changement supplémentaire côté web.
- **WorkforceScreen** : inchangé fonctionnellement, juste plus de
  `businessId` si jamais affiché (déjà non affiché aujourd'hui — vérifié).

## 6. Migration des sauvegardes M10

### 6.1 Ce qui ne change pas de schéma

`GameState` (moteur) n'a pas de nouveau champ : une sauvegarde M10 reste
`JSON.parse`-compatible avec `SaveGameV1.gameState` telle quelle. Le seul
souci est **sémantique** : `business.business.name` y contient encore
l'ancien identifiant technique.

### 6.2 Ce qui change côté `SaveGameV1` (web)

`SaveGameV1` gagne `businessIdentities: Record<string, BusinessIdentity>`
et `BusinessDraft` change de forme (`rentBudget`/`adminBudget`/`capex`
→ `infrastructureId`/`adminOptionalIds`/`purchases`). Une sauvegarde M10
chargée avec l'ancien `loadSave()` produirait donc soit un crash (accès à
un champ qui n'existe pas), soit un état incohérent (ancien
`BusinessDraft` passé à un `buildMonthActions` qui attend le nouveau
format).

**Stratégie retenue : migration défensive au chargement, pas de bump de
version.** Le champ `version: 1` de `SaveGameV1` ne change pas (le
*schéma logique* évolue, mais on migre en mémoire plutôt que de forcer une
nouvelle partie — cohérent avec « les sauvegardes M10 existantes doivent
être migrées proprement ». `web/src/lib/storage.ts::loadSave()`
applique, après le parse JSON brut :

1. Si `businessIdentities` est absent → `{}`.
2. Pour chaque entreprise de `gameState.businesses` sans entrée dans
   `businessIdentities` → synthèse d'une identité par défaut
   (`defaultBusinessIdentity(family, gameState.date)` — nom = titre de
   l'opportunité correspondante, ex. « Société de nettoyage », description
   = pitch de l'opportunité, `createdAt` = date courante de la sauvegarde
   faute de mieux — **on ne connaît pas la vraie date de création d'une
   entreprise migrée**, limite assumée et documentée).
3. Si `draft.business` existe et n'a pas la forme attendue (détection :
   absence de `infrastructureId`) → reconstruit un `BusinessDraft`
   valide : `infrastructureId` par défaut pour la famille,
   `adminOptionalIds: []`, `purchases: []`, en conservant
   `businessId`/`family`/`decisions`/`targetHeadcount`/`capitalInjection`
   tels quels (ils n'ont pas changé de forme).

Cette migration est **pure et défensive** : elle ne modifie jamais
`gameState` (source de vérité moteur, laissée intacte), seulement les
structures web (`businessIdentities`, `draft`). Aucune sauvegarde
existante ne doit provoquer de crash ; au pire, un joueur reprenant une
vieille partie voit une entreprise nommée d'après un libellé générique
plutôt que le nom qu'il avait — acceptable et attendu (spec :
« recevoir une identité par défaut sans crash »).

### 6.3 Limite assumée sur l'historique déjà écrit

Les entrées de `memory`/`events` déjà générées par une ancienne partie
(avant ce correctif) contiennent encore l'ancien identifiant technique
dans leur texte figé (ce sont des logs passés, pas recalculés). La
migration ne réécrit pas l'historique — seuls les affichages courants
(écrans Entreprise/Finances/Récap à partir de maintenant) sont garantis
propres.

## 7. Invariants à préserver (rappel + nouveaux)

- I1 (§3.2) : aucun `OwnedBusiness.id` ni `business.business.name` brut
  affiché à l'écran.
- I2 : `buildMonthActions` reste une fonction pure ; les nouvelles
  fonctions d'agrégation catalogue (`computeInfrastructureMonthlyCost`,
  `computeAdminMonthlyCost`, `computePurchasesCost`) sont pures, sans
  aléa, sans état.
- I3 : aucune ligne de `src/engine/**` ne change pour rent/admin/capex —
  seule `CreateBusinessSpec.name` (+ propagation `businessResolution.ts`,
  `simulateMonth.ts`) est un changement moteur, minimal et testé.
- I4 : `git grep -n "Math.random\|new Date(" src/ test/` reste vide (garde
  déjà testée par `test/guards/forbiddenApis.test.ts`, inchangée).
- I5 : les 230 tests moteur existants passent sans modification de leurs
  assertions (seuls des littéraux `CreateBusinessSpec` gagnent un champ
  `name`, mécanique, aucune assertion ne portait sur `.name`).
- I6 : une sauvegarde M10 se charge sans exception JS et sans écran blanc.

## 8. Auto-revue de la spec

**Ambiguïtés relevées et tranchées :**

- *« Le joueur choisit le nom lors de la création »* ne dit pas si le nom
  est modifiable ensuite. Tranché : non modifiable en M11.1 (hors DoD
  explicite), un renommage ultérieur est une extension triviale (nouvelle
  action `RENAME_BUSINESS` + mutation du `name` moteur, non
  bloquant architecturalement).
- *« Introduire au minimum : domicile, coworking, petit bureau/local,
  bureau/local intermédiaire »* ne précise pas les montants. Tranché avec
  des ordres de grandeur français plausibles (250 €/900 €/2 500 € par
  mois), cohérents avec les montants déjà utilisés ailleurs dans le jeu
  (ex. `HOSPITALITY` recommandait déjà un loyer de 1 500 €/mois et un
  CAPEX de 40 000 € — le nouveau catalogue permet de recomposer un total
  du même ordre via plusieurs achats, voir §4.4).
- *« Chaque infrastructure possède... éventuel coût d'installation »* —
  tranché en limitant le coût d'installation au mois de création
  uniquement (§4.2.1), pour éviter d'introduire un suivi d'état
  « infrastructure précédente » non demandé explicitement par le DoD.

**Contradictions potentielles vérifiées : aucune trouvée.** Le principe
central (§2) et la frontière moteur/UI existante (spec P0, « l'UI ne
calcule rien ») sont compatibles dès lors que les catalogues sont traités
comme des *entrées* choisies par le joueur, pas des *calculs* — l'UI ne
calcule aucune conséquence économique, elle agrège des prix affichés.

**Migrations vérifiées : voir §6.** Le risque principal (crash sur
ancienne sauvegarde) est couvert par une migration défensive testée
(§ plan d'implémentation, tests de migration).

**Invariants vérifiés : voir §7**, chacun testable explicitement dans le
plan d'implémentation.

## 9. Hors scope M11.1 (rappel)

M11.2 (Offer & Customer), M11.3 (Sales & Marketing), M11.4 (Organisation &
Delegation), M11.5 (Universal Business Builder) : décrits au niveau
architecture dans le plan d'implémentation (pour ne pas leur fermer de
porte), non codés dans cette passe. IPO, M&A, lobbying, multinationales,
board avancé, dynastie : hors M11 entièrement (déjà exclus du P0).
