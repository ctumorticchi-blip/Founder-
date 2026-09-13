# FOUNDER_STATE.md — État courant du projet

Ce fichier est mis à jour après CHAQUE tranche vérifiée verte, poussée
sur `main`. En cas de divergence avec le code réel, le code réel gagne
(`CLAUDE.md`) — corriger ce fichier plutôt que de lui faire confiance
aveuglément.

## Base verte courante

Branche : `main`
Dernier commit vérifié au moment de la rédaction de cette version :
`2e225a9` (correction du plan M11.2.4.1).

## Milestone actif

**M11.2.4.1 — Strategic Account Core.**

## Design actif

`docs/superpowers/specs/2026-09-12-founder-m11.2.4-strategic-accounts-design.md`
(corrigé au commit `58d080f`).

## Plan d'implémentation actif

`docs/superpowers/plans/2026-09-13-founder-m11.2.4.1-strategic-account-core.md`
(corrigé au commit `2e225a9`) — base d'exécution : `main` courant au
moment de l'exécution, jamais un SHA figé (voir en-tête du plan).

## Dernière correction de planification validée (2e225a9)

- Base d'implémentation exprimée comme « main courant », pas un SHA figé.
- Éligibilité corrigée : un slot n'existe que si `offer.targetSegment`
  EST LUI-MÊME le segment marqué `strategicAccountsEligible === true`
  (jamais un produit cartésien offres × segments éligibles de la
  famille).
- Test probabiliste solidifié par une seed vérifiée déterministiquement
  (rejeu hors-ligne de l'algorithme RNG réel), plus une espérance
  statistique.

## Points de vigilance connus (à ne pas oublier, ne pas re-découvrir)

- Le déséquilibre de calibration Café/petit restaurant (documenté depuis
  M11.2.3.1) reste un sujet de calibration séparé, non traité par
  M11.2.4.
- M11.2.4.3 devra éviter tout double comptage de la demande contractuelle
  et toute priorité cachée entre flux new/repeat/contractuel (déjà
  résolu dans la spec §2-§3, à respecter strictement à l'implémentation).
- La note laissée dans la Tâche 4 du plan M11.2.4.1 (comportement réel
  d'une offre créée+lancée le même mois vis-à-vis de l'apparition
  d'opportunités) doit être tranchée par exécution réelle du test, pas
  supposée.

## Prochaine action autonome

Implémenter M11.2.4.1 depuis `main` courant, TDD tâche par tâche
(1 à 7) selon le plan corrigé, vérifier (tests/typecheck/lint/build +
playtest mobile pertinent), commit/push à chaque tranche verte, puis
mettre à jour ce fichier et enchaîner sur M11.2.4.2 sans demander de
confirmation, sauf si un cas `PRODUCT DECISION REQUIRED` réel
(`CLAUDE.md`) est rencontré.

## Blocage produit en attente

Aucun.
