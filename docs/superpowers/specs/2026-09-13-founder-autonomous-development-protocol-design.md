# FOUNDER — Autonomous Development Protocol — Design Spec

Ce document décrit le protocole de développement autonome installé pour
FOUNDER : comment une session fraîche, sans historique de conversation,
peut reprendre le travail, l'implémenter, le vérifier, le pousser, et
enchaîner sur la suite sans que Clément relaie des prompts, des SHA, ou
des validations routinières entre sessions/agents.

## §1. Problème résolu

Avant ce protocole, chaque étape (spec, correction, plan) nécessitait un
nouveau message de Clément décrivant précisément quoi faire, avec les
SHA de référence recopiés à la main. Ce protocole déplace la source de
vérité durable du fil de conversation vers le dépôt lui-même : 5
fichiers texte versionnés qui, ensemble, permettent à n'importe quelle
session de reconstruire tout le contexte nécessaire.

## §2. Source de vérité durable — les 4+1 fichiers racine

| Fichier | Rôle | Fréquence de changement |
|---|---|---|
| `CLAUDE.md` | Constitution comportementale : boucle par défaut, décisions autonomes, escalade | Rare — décision produit explicite uniquement |
| `FOUNDER_VISION.md` | Constitution produit : ce que FOUNDER doit devenir | Rare — décision produit explicite uniquement |
| `FOUNDER_ROADMAP.md` | Ordre de dépendance des milestones | Peu fréquent — quand un milestone est terminé ou réordonné par décision produit |
| `FOUNDER_STATE.md` | Snapshot exact de l'avancement réel | Après CHAQUE tranche vérifiée |
| `docs/superpowers/specs/*` / `docs/superpowers/plans/*` | Détail technique par milestone | Un par milestone/slice |

Le code réel et l'historique git restent, dans tous les cas, la vérité
ultime au-dessus de ces 5 fichiers : si un fichier de gouvernance
raconte un état que le code contredit, c'est le fichier qui est corrigé,
jamais l'inverse (`CLAUDE.md` §"Au début de toute nouvelle session").

## §3. Boucle autonome standard

```
lire l'état (CLAUDE.md → VISION → ROADMAP → STATE → specs/plans actifs → code réel)
  → inspecter le code réel et les commits récents
  → concevoir (si nécessaire, nouvelle spec + self-review)
  → planifier (si nécessaire, nouveau plan TDD)
  → implémenter en TDD (red → green minimal → refactor)
  → vérifier (tests/typecheck/lint/build + playtest pertinent)
  → corriger si rouge
  → commit
  → push sur main (seulement si vert)
  → mettre à jour FOUNDER_STATE.md
  → tranche/milestone suivant, automatiquement
```

Cette boucle ne s'arrête PAS entre deux itérations pour demander une
confirmation — c'est la différence structurelle avec le mode de travail
précédent (un message = une étape validée manuellement).

## §4. Classes de décision

**Décisions locales (autonomes, jamais d'escalade)** : toute décision qui
ne fait qu'implémenter, plus précisément, quelque chose que
`FOUNDER_VISION.md`/`FOUNDER_ROADMAP.md` décrit déjà — architecture
technique, découpage de fichiers, noms, tests, seeds, migrations,
corrections de bugs/régressions, petits calibrages, UX qui ne change pas
la boucle de gameplay approuvée, découpage d'un milestone en
sous-tranches, rédaction de specs/plans. Liste complète : `CLAUDE.md`
§"Décisions que l'agent peut prendre seul".

**Décisions produit majeures (`PRODUCT DECISION REQUIRED`)** : les 8
critères de `CLAUDE.md` — boucle de gameplay fondamentale, progression
centrale, gros système absent de la vision/roadmap, choix difficilement
réversible à impact multi-milestones, changement fort de réalisme,
monétisation, mécanique politique/sociale/juridique/éthique majeure,
contradiction réelle entre deux principes approuvés. Dans ce cas
uniquement, le protocole s'arrête AVANT implémentation.

Le critère de distinction n'est pas « est-ce important ? » (beaucoup de
décisions locales sont importantes) mais « est-ce que la vision/roadmap
a déjà tranché la question, même implicitement ? ». Si oui → autonome.
Si la question n'a jamais été posée et engage plusieurs milestones avec
des expériences joueur substantiellement différentes → escalade.

## §5. Protocole d'escalade

Quand une décision majeure est réellement rencontrée :

1. Laisser `main` vert (aucun travail à moitié fait qui casse le build).
2. Répondre en commençant par `PRODUCT DECISION REQUIRED`.
3. Poser UNE seule question précise.
4. Proposer 2 à 3 options avec leurs compromis respectifs.
5. Donner une recommandation explicite.
6. Si l'environnement dispose réellement de droits d'écriture GitHub,
   créer une issue `PRODUCT DECISION REQUIRED — <sujet>` avec : contexte,
   question, options, recommandation, état sûr du dépôt (branche, SHA
   vert, résumé de vérification).
7. Si l'environnement dispose réellement d'un mécanisme de notification
   confirmé disponible, l'utiliser. Ne jamais prétendre avoir notifié
   Clément si l'environnement ne le confirme pas.
8. Enregistrer le blocage dans `FOUNDER_STATE.md` (section "Blocage
   produit en attente") pour qu'une session suivante retrouve
   immédiatement le contexte sans relire toute la conversation.

Le développement ne reprend sur le sujet bloqué qu'après réponse de
Clément — mais rien n'empêche de continuer un autre chantier non
dépendant de cette décision en attendant, si un tel chantier existe et
respecte l'ordre de dépendance de `FOUNDER_ROADMAP.md`.

## §6. Reprise de session — critère de succès

Une session fraîche, sans aucun historique de conversation, doit pouvoir
répondre à ces 7 questions en lisant uniquement le dépôt :

1. Que cherche à devenir FOUNDER ? → `FOUNDER_VISION.md`
2. Qu'est-ce qui est terminé ? → `FOUNDER_ROADMAP.md` §Terminé +
   `git log`
3. Quel milestone est actif ? → `FOUNDER_STATE.md` §Milestone actif
4. Quelle est la prochaine action ? → `FOUNDER_STATE.md` §Prochaine
   action autonome
5. Qu'est-ce qui peut être décidé seul ? → `CLAUDE.md` §Décisions
   autonomes
6. Qu'est-ce qui nécessite Clément ? → `CLAUDE.md`
   §PRODUCT DECISION REQUIRED
7. Que faut-il vérifier avant de pousser ? → `CLAUDE.md` §Règles qualité
   obligatoires

Si une de ces réponses est ambiguë à la lecture du dépôt seul, c'est un
défaut de gouvernance à corriger dans les fichiers concernés avant de
continuer le développement produit.

## §7. Garde-fous qualité (rappel, détail complet dans `CLAUDE.md`)

TDD strict, vérification fraîche systématique avant toute affirmation
de succès, RNG déterministe uniquement (`test/guards/forbiddenApis.test.ts`
comme garde-fou automatisé), aucune duplication de logique économique
côté web, aucun id technique en UI, mobile-first, migrations
défensives sans historique fabriqué, aucune anticipation de mécanique
d'une tranche future.

## §8. Portée de ce protocole

Ce protocole encode COMMENT travailler, jamais QUOI construire — le
contenu produit reste entièrement défini par `FOUNDER_VISION.md` et
`FOUNDER_ROADMAP.md`. Une modification de ce protocole lui-même (par
exemple, resserrer ou desserrer les critères d'escalade) est elle-même
une décision produit/gouvernance et suit son propre bon sens : un
changement mineur de formulation est autonome, un changement qui
élargirait significativement ce qui peut être décidé sans Clément
mérite d'être signalé explicitement dans le commit qui l'introduit.
