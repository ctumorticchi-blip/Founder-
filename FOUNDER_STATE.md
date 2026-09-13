# FOUNDER_STATE.md — État courant du projet

Ce fichier est mis à jour après CHAQUE tranche vérifiée verte, poussée
sur `main`. En cas de divergence avec le code réel, le code réel gagne
(`CLAUDE.md`) — corriger ce fichier plutôt que de lui faire confiance
aveuglément.

## Base verte courante

Branche : `main`
Dernier commit vérifié au moment de la rédaction de cette version :
`5603dc7` — M11.2.4.1 (Strategic Account Core) intégralement livré et
vert.

## Milestone actif

**M11.2.4.1 — Strategic Account Core : TERMINÉ.**
Prochain milestone à démarrer : **M11.2.4.2 — Prospecting & Negotiation**
(`FOUNDER_ROADMAP.md`).

## M11.2.4.1 — récapitulatif de livraison

Les 7 tâches du plan (`docs/superpowers/plans/2026-09-13-founder-m11.2.4.1-strategic-account-core.md`)
sont livrées, chacune en TDD, chacune commit+push séparément :

1. `28b83e0` — types `StrategicAccountOpportunity`/`StrategicAccount`/
   `AccountOfferRelationship` + `strategicAccountsEligible` sur
   `CustomerSegment` (1 segment éligible par famille).
2. `a51c3c4` — catalogue déterministe d'identités fictives
   (`strategicAccountIdentity.ts`).
3. `5b80043` — `findEligibleStrategicAccountSlots`/
   `advanceStrategicAccountOpportunities` (`strategicAccounts.ts`) —
   éligibilité stricte par `offer.targetSegment`, jamais un produit
   cartésien ; probabilité 0.06/slot/mois, plafond 3 actives.
4. `87ac29a` — intégration dans `simulateMonth.ts` (jamais dans
   `businessResolution.ts::resolveBusinessMonth`, dont la logique
   économique reste totalement intouchée — seul le littéral de retour
   de `createOwnedBusiness` a changé, +2 champs `[]`).
5. `4af13a9` — migration défensive (`web/src/lib/storage.ts`, patron
   `?? []`, version de sauvegarde inchangée).
6. `5603dc7` — écran consultatif (`StrategicAccountsScreen`, carte
   `card--interactive` sur `BusinessScreen`, progressive disclosure).
7. Vérification finale : 544 tests engine + 115 tests web verts,
   `typecheck`/`typecheck:test`/`lint`/`build` propres côté engine ET
   web, garde-fou `forbiddenApis` vert (57 tests), playtest mobile réel
   (390×844, seed de production réelle, non forcée) réussi : une
   opportunité authentique (« Cabinet Vasseur International », Elodie
   Aubry — Directrice générale, segment Grands comptes ponctuels,
   origine Réseau) est apparue au mois 8, affichée sans id technique ni
   statut brut, aucun débordement horizontal (`scrollWidth ===
   clientWidth === 390`).

**Bug réel découvert et corrigé pendant l'écriture des tests (TDD, pas
supposé)** : le fixture d'intégration utilisait initialement le modèle
`"project"` (seuil de lancement 40%) pour une offre censée être lancée
immédiatement — corrigé en `"service-hours"` (seuil 0%). Documenté dans
le commit de la Tâche 4.

**Note laissée par le plan résolue** : une offre créée+lancée le même
mois PEUT effectivement générer un slot éligible dès ce même mois
(`applyOfferActions` s'exécute avant le calcul de
`advanceStrategicAccountOpportunities`) — le test d'intégration a été
écrit avec une assertion sur une borne (`toBeLessThanOrEqual`) plutôt
que sur `[]` strict, conformément à la marche à suivre du plan.

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
- `AccountOfferRelationship` (Core) ne porte que `offerId`/`segmentId`/
  `status` — `contract`/`satisfaction`/`trust`/`history` doivent être
  ajoutés de façon PUREMENT ADDITIVE par M11.2.4.3/M11.2.4.4 (spec §5),
  jamais en modifiant la forme actuelle.
- Les 5 segments éligibles (un par famille) sont un choix de calibrage
  V1 explicite (`service-entreprises-exigeantes`,
  `hospitality-affaires-evenementiel`, `retail-amateurs-qualite`,
  `agency-grands-comptes`, `subscription-equipes-etablies`) — ajustable
  sans changement d'architecture si le produit le demande plus tard.
- `STRATEGIC_ACCOUNT_OPPORTUNITY_MONTHLY_PROBABILITY` (0.06) et
  `MAX_ACTIVE_STRATEGIC_ACCOUNT_OPPORTUNITIES_PER_BUSINESS` (3) sont des
  constantes de calibrage empirique, pas une vérité produit figée.

## Prochaine action autonome

Démarrer **M11.2.4.2 — Prospecting & Negotiation** en suivant le cycle
standard (`CLAUDE.md`) : inspecter le code réel actuel (notamment
`strategicAccounts.ts`, `strategicAccount.ts`, le patron
`sale.ts`/sale.test.ts pour accept/counter/reject, le patron
`intelligence.ts` pour l'information imparfaite), écrire/adapter la
section pertinente si besoin, écrire un plan d'implémentation TDD dédié
(`docs/superpowers/plans/`), l'exécuter tâche par tâche, vérifier,
commit/push, mettre à jour ce fichier, puis enchaîner sur M11.2.4.3 sans
demander de confirmation — sauf si un cas `PRODUCT DECISION REQUIRED`
réel (`CLAUDE.md`) est rencontré (candidats identifiés à l'inspection :
le découpage exact du temps fondateur par opportunité, spec §6/§19.3,
est une décision de conception locale, PAS un cas d'escalade — à
trancher seul).

## Blocage produit en attente

Aucun.
