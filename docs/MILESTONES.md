# FOUNDER — Découpage P0 en milestones

Chaque milestone est commit(é)+push(é) séparément une fois ses tests verts.

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

## M6 (stretch, si le temps le permet) — Harnais headless de démonstration
- Script/CLI qui joue une séquence d'actions prédéfinie mois après mois et
  imprime l'état (`PlayerView`) — preuve que l'UI n'aurait qu'à afficher.
- Aucune logique de simulation dans ce harnais : uniquement des appels au
  moteur.

## Hors périmètre de ces milestones
Voir `docs/SPEC_P0.md` §2 (IPO, M&A majeur, dynastie, etc.).
