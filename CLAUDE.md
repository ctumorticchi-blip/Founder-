# CLAUDE.md — Constitution du développement autonome de FOUNDER

Ce fichier définit comment travailler sur ce dépôt sans validation humaine
intermédiaire, tant que le travail reste dans la vision produit déjà
approuvée (`FOUNDER_VISION.md`, `FOUNDER_ROADMAP.md`). Il prime sur les
habitudes par défaut de prudence conversationnelle — mais jamais sur les
règles qualité obligatoires ci-dessous, ni sur les protocoles de sécurité
généraux (destructivité git, secrets, etc.).

## Comportement par défaut : CONTINUE

Continue de construire FOUNDER. Ne demande pas l'autorisation de
poursuivre un travail routinier déjà couvert par la vision approuvée.

Après une tranche terminée, le cycle est automatique :

```
vérification (tests/typecheck/lint/build/playtest) → commit → push
→ mise à jour de FOUNDER_STATE.md → tranche suivante
```

Ne demande **jamais** simplement :
- « Dois-je continuer ? »
- « Puis-je commencer M11.x ? »
- « Veux-tu que je passe à l'étape suivante ? »

La réponse implicite à ces questions est **oui**, tant qu'aucune décision
produit majeure telle que définie ci-dessous n'est réellement rencontrée.

## Au début de toute nouvelle session

Lire, dans cet ordre :

1. `CLAUDE.md` (ce fichier)
2. `FOUNDER_VISION.md`
3. `FOUNDER_ROADMAP.md`
4. `FOUNDER_STATE.md`
5. Les specs/plans actifs dans `docs/superpowers/`
6. Le code réel et les commits récents (`git log`, fichiers concernés)

**Si la documentation et le code réel divergent, le dépôt réel gagne.**
Corriger ensuite `FOUNDER_STATE.md` pour refléter la réalité avant de
poursuivre — ne jamais construire la suite sur un état documenté mais faux.

## Décisions que l'agent peut prendre seul

Explicitement autorisé, sans validation humaine :

- architecture technique locale ;
- découpage de modules/fichiers ;
- noms internes ;
- tests ;
- seeds déterministes ;
- stratégie de migration ;
- corrections de bugs ;
- corrections de régressions ;
- petits calibrages (constantes, seuils) ;
- améliorations UX qui ne modifient pas la boucle de gameplay approuvée ;
- découpage d'un milestone approuvé en sous-tranches ;
- rédaction et self-review des specs ;
- rédaction des implementation plans ;
- choix entre deux implémentations techniquement équivalentes ;
- refactoring directement nécessaire au chantier en cours.

Privilégier la meilleure décision technique compatible avec la vision
plutôt que de demander systématiquement au product owner.

## PRODUCT DECISION REQUIRED

S'arrêter avant implémentation **uniquement** lorsqu'une décision :

1. change une boucle fondamentale de gameplay ;
2. change la progression centrale de FOUNDER ;
3. ajoute ou retire un gros système qui n'existe pas déjà dans la
   vision/roadmap ;
4. crée un choix difficilement réversible qui impacte plusieurs
   milestones avec des expériences joueur réellement différentes ;
5. change fortement le niveau de réalisme ;
6. concerne la monétisation/business model commercial du jeu lui-même ;
7. introduit une grosse mécanique politique, sociale, juridique, éthique
   ou de gouvernance susceptible de changer la nature du jeu ;
8. révèle une contradiction réelle entre deux principes produit déjà
   approuvés, qu'aucune interprétation conservatrice ne permet de
   résoudre.

Un calibrage, un nom de champ, une structure de fichiers, ou une manière
d'implémenter un système déjà décrit dans la vision/roadmap **n'est
jamais** une PRODUCT DECISION REQUIRED, même si elle semble importante.

Dans ce cas, et dans ce cas seulement :

- laisser `main` vert (aucun code cassé en attendant) ;
- écrire clairement en tête de réponse : `PRODUCT DECISION REQUIRED`
- poser **une seule** question ;
- proposer 2 ou 3 options ;
- expliquer les compromis de chaque option ;
- donner une recommandation ;
- si l'environnement dispose réellement de droits GitHub, créer une
  issue intitulée `PRODUCT DECISION REQUIRED — <sujet>` ;
- si l'environnement dispose réellement d'un système de notification
  utilisable (outil de notification confirmé disponible), l'utiliser ;
- ne **jamais** prétendre avoir envoyé une notification ou créé une
  issue si l'environnement ne le confirme pas réellement.

## Règles qualité obligatoires (non négociables)

- Le code réel du dépôt est la vérité, pas la documentation ni un
  souvenir de session précédente.
- TDD pour toute feature et tout bug : red → green minimal →
  review/refactor.
- Ne jamais déclarer un chantier terminé sur la seule base d'un rapport
  d'agent délégué — relire le diff réel produit.
- Exécuter soi-même les tests/typecheck/lint/build pertinents avant
  d'affirmer qu'un état est vert.
- Inspecter le diff final avant tout commit.
- Ne pousser sur `main` que si les vérifications nécessaires sont vertes.
- Aucun `Math.random`, `Date.now`, `new Date`, ou aléa non seedé dans le
  moteur de simulation (`src/**`) — RNG déterministe (`rng.fork`)
  uniquement, vérifié par `test/guards/forbiddenApis.test.ts`.
- Les résultats économiques proviennent du moteur déterministe, jamais
  du texte généré — l'IA narrative explique, elle ne calcule rien.
- Les grands résultats du jeu doivent être causaux et explicables à
  partir de l'état réel (temps investi, capacité, satisfaction...),
  jamais un événement scripté gratuit.
- Aucun identifiant technique (`id`, slug interne) visible dans l'UI
  joueur — toujours un nom/libellé métier.
- Mobile-first pour toute UI (largeur ~390px minimum sans débordement).
- Les migrations de sauvegarde ne fabriquent jamais de faux historique
  — toujours une valeur neutre par défaut (`?? []`, `?? null`, `?? 0`),
  jamais une valeur inventée pour compenser une donnée manquante.
- Ne jamais masquer une faiblesse architecturale par un calibrage
  arbitraire — corriger la cause, pas le symptôme.
- Ne jamais implémenter par anticipation une mécanique appartenant à une
  tranche future non commencée (pas de champ/logique "au cas où").

## Méthodologie Superpowers (rappel)

Chaque nouvelle tranche de travail suit : spec → self-review → plan
(`writing-plans`) → implémentation TDD (`executing-plans` ou
subagent-driven) → vérification → commit/push → mise à jour de l'état.
Les specs vivent dans `docs/superpowers/specs/`, les plans dans
`docs/superpowers/plans/`, datés `AAAA-MM-JJ-founder-<sujet>.md`.
