# FOUNDER — Spécification fonctionnelle P0

Statut : validée pour implémentation.
Portée : ce document définit ce que le P0 doit prouver, les règles de simulation,
et ce qui est explicitement hors périmètre. Il sert de référence stable ; toute
évolution notable doit être actée par une mise à jour de ce fichier, pas par du
code divergent.

## 1. Objectif du P0

Prouver qu'un même moteur déterministe peut produire plusieurs trajectoires
crédibles à partir d'un point de départ identique :

- 18 ans, 0 €, aucun diplôme, aucune entreprise, compétences quasi nulles.
- Progression mensuelle vers : petit boulot → première activité → première
  entreprise → premiers salariés → financement → patrimoine net ≈ 1 M€+.

Histoires cibles que le moteur doit pouvoir produire sans code spécifique à
chacune (elles émergent des règles, pas d'un script narratif) :

1. Petit boulot → café → plusieurs établissements → faillite.
2. Nettoyage → microentreprise → ~100 salariés → cession pour quelques M€.
3. Apprentissage tech → premier SaaS raté → second SaaS → levée → valorisation
   importante.

Le P0 ne cherche pas à simuler un empire mondial ni un jeu complet. Il valide
le cœur du moteur (Character, World, Business, Economic Models, Competition
minimal, Intelligence minimal, Narrative minimal) et son intégration en une
boucle mensuelle déterministe et testable.

## 2. Hors périmètre du P0 (explicite)

Ne pas implémenter maintenant, mais l'architecture doit les rendre possibles
plus tard sans réécriture :

- IPO / bourse complète
- M&A de grande taille, multinationales
- Lobbying
- Private equity avancé (LBO, covenants complexes)
- Holdings complexes / structures capitalistiques multi-niveaux
- Dynastie, héritiers, transmission
- Empires à 100 Md€+

Toute donnée ou champ qui anticipe ces systèmes (ex. `capTable`, `boardSeats`)
peut exister dans les types comme point d'extension, mais ne doit avoir
aucune logique de simulation active en P0.

## 3. Principes non négociables

Ces règles contraignent toute implémentation ; un PR qui les viole doit être
rejeté même si les tests passent par ailleurs.

1. **1 tour moteur = 1 mois.** Pas de granularité plus fine en P0.
2. **Déterminisme par seed.** Pour un `(seed, séquence d'actions du joueur)`
   donné, la trajectoire simulée est strictement reproductible. Aucune source
   d'aléatoire hors du RNG seedé du moteur (pas de `Date.now()`, pas de
   `Math.random()` dans le cœur de simulation).
3. **L'UI ne calcule rien.** Toute grandeur affichée est produite par le
   moteur. L'interface lit un état, envoie des intentions/actions, jamais de
   résultats calculés côté client.
4. **Fonctions de simulation pures.** `(état, action|seed) → nouvel état`.
   Pas de mutation cachée, pas d'effets de bord (I/O, horloge système) dans
   les modules de simulation.
5. **Information imparfaite.** Le moteur connaît la vérité (`Truth`). Le
   joueur reçoit une `Estimate` dérivée de `Truth` + bruit dépendant de ses
   compétences (notamment Finance, Stratégie) et de ses outils. Le bruit ne
   doit jamais être nul même à haute compétence (incertitude structurelle
   minimale), et jamais purement arbitraire (il doit être fonction de
   variables du modèle, pas d'un tirage indépendant de tout).
6. **Pas de niveau artificiel.** Aucune activité n'est débloquée par un
   "level up" abstrait. L'accès dépend de contraintes vérifiables : capital
   disponible, compétence minimale, réseau minimal, réglementation. Ces
   contraintes doivent être des données (`Requirement[]`), pas des `if`
   dispersés dans le code.
7. **Pas de catastrophe instantanée sans signal.** Une faillite, une rupture
   de covenant implicite, une perte de licence, etc. doit être précédée d'au
   moins un état intermédiaire observable (ex. trésorerie négative pendant
   N mois consécutifs avant liquidation forcée), jamais un game over en un
   seul tick sans avertissement préalable dans l'état.
8. **Composabilité des moteurs économiques.** Une entreprise est une
   composition de 1..N `EconomicEngine` (ex. Retail + Subscription). Le
   modèle financier consolidé additionne les contributions de chaque moteur
   sur une structure comptable commune.
9. **Systèmes transversaux partagés.** Cash, comptabilité, employés,
   marketing, réputation, financement, fiscalité, concurrence, événements,
   personnage sont des systèmes uniques réutilisés par tous les moteurs
   économiques — jamais dupliqués par famille.

## 4. Personnage

### 4.1 État initial (18 ans)

- `cash = 0`
- `education = None`
- `businesses = []`
- Compétences toutes très basses (voir §4.2), avec une légère variance
  seedée pour éviter des runs strictement identiques à seed différent.

### 4.2 Compétences (échelle 0–100)

Vente, Produit, Marketing, Finance, Management, Leadership, Négociation,
Opérations, Technologie, Stratégie, Réseau, Influence.

Valeur initiale : tirée dans une plage basse (ex. 1–8) par compétence, via le
RNG seedé — pas une constante unique, pour permettre des profils de départ
légèrement différents sans devenir un "point de compétence à répartir" façon
RPG.

Progression : la compétence évolue via des `SkillGainEvent` produits par le
travail, l'apprentissage, les décisions et le réseau — jamais par un gain
manuel arbitraire déclenché par l'UI. Les gains sont soumis à rendements
décroissants (plus la compétence est haute, plus il faut d'expérience pour
la faire progresser).

### 4.3 Capacité temporelle mensuelle

Le personnage dispose d'un budget de temps mensuel fini, réparti en
catégories : `emploi`, `apprentissage`, `business`, `réseau`. Le total est
une constante de design (ex. 160h/mois) allouée par le joueur avant
résolution du mois ; le moteur refuse une allocation qui dépasse le budget
(erreur de validation, pas un clamp silencieux).

Les employés et managers ajoutent de la capacité organisationnelle
(`OrgCapacity`) distincte de la capacité personnelle, permettant au joueur de
sortir progressivement de l'opérationnel — ce mécanisme doit exister dans les
types dès le P0 même s'il reste simple (ex. un manager convertit du temps de
supervision du joueur en capacité déléguée).

## 5. Marchés

Chaque marché (`Market`) porte : taille, croissance, marge moyenne,
fragmentation, intensité concurrentielle, intensité capitalistique,
réglementation, innovation, sensibilité au prix, barrières à l'entrée,
cyclicité. Ces champs sont numériques/normalisés (0–1 ou unités monétaires
explicites), jamais des chaînes libres, pour rester simulables.

Le moteur doit pouvoir dériver des **inefficiences** (ex. écart entre prix
observable et coût de production dans un segment sous-servi) qui deviennent
des opportunités exploitables par le joueur ou par les concurrents.

## 6. Entreprises — modèle financier

Chaque entreprise a un état comptable mensuel complet :

Revenus → Coûts variables → **Marge brute** → Salaires → Marketing → Loyers →
Administration → **EBITDA** → Amortissements → Intérêts → Impôts →
**Résultat net** ; puis CAPEX et variation de BFR → **Cash-flow** → impact
sur la **trésorerie**.

Invariant clé : une entreprise peut être rentable (résultat net positif) et
en même temps manquer de cash (BFR en forte hausse, CAPEX non financé,
remboursement de dette). Le modèle doit permettre cet écart, pas le masquer.

## 7. Moteurs économiques actifs en P0

Cinq familles, réutilisant les systèmes transversaux (§3.9) :

1. **Retail** (fleuriste, épicerie, boutique) : stock, marge sur vente,
   emplacement/trafic comme proxy de demande.
2. **Service** (nettoyage, entretien, sécurité) : capacité en heures de
   main-d'œuvre, contrats récurrents ou ponctuels.
3. **Hospitality** (café, restaurant) : capacité (couverts/jour), rotation,
   coût matière + personnel élevé.
4. **Agency/B2B** (marketing, recrutement, conseil) : missions/contrats,
   forte dépendance à la compétence et réputation du fondateur/équipe.
5. **Subscription** (SaaS, abonnement) : MRR, churn, CAC/LTV, coûts de
   développement produit.

Chaque moteur expose la même interface (`EconomicEngine`) : à partir d'un
état d'entreprise + état de marché + décisions du joueur, il produit une
contribution au compte de résultat mensuel (revenus, coûts variables,
paramètres spécifiques comme churn ou stock). Une entreprise composite
agrège les contributions de plusieurs moteurs sur la même structure
comptable (§6).

## 8. Constructeur d'entreprise (langage naturel → structure déterministe)

Hors périmètre d'implémentation IA en P0, mais l'interface de données doit
être prête : une fonction `interpretBusinessIdea(text) → BusinessBlueprint`
peut être un stub déterministe (mapping par mots-clés) en P0, produisant :
activité, famille économique, segment clients, structure de revenus,
positionnement, capital requis estimé, contraintes réglementaires. Le moteur
économique ne doit jamais lire le texte libre directement — uniquement le
`BusinessBlueprint` structuré.

## 9. Information imparfaite

Deux couches distinctes dans l'état :

- `Truth` : état réel calculé par le moteur (source de vérité interne).
- `PlayerView` : projection de `Truth` avec un bruit et une résolution qui
  dépendent des compétences du personnage (Finance, Stratégie, Opérations)
  et des outils/employés dont il dispose (ex. un comptable réduit le bruit
  sur les chiffres comptables).

Le bruit est modélisé, pas improvisé : fonction déterministe du seed courant,
de l'écart-type paramétré par compétence, et de la variable observée. Deux
runs avec le même seed et les mêmes compétences produisent le même bruit.

## 10. Boucle mensuelle (ordre imposé)

1. Macro (mise à jour des agrégats économiques du monde)
2. Marchés (mise à jour taille/croissance/marge par marché)
3. Concurrence (agrégée + concurrents identifiés)
4. Demande (dérivée du marché + concurrence + positionnement des entreprises)
5. Ventes (allocation de la demande, revenus)
6. Opérations (capacité, production, stock, qualité de service)
7. Employés (effectifs, masse salariale, moral, turnover)
8. Comptabilité (assemblage du compte de résultat)
9. Cash (trésorerie, financement, covenants implicites)
10. Personnage (temps, compétences, vie personnelle si arbitrage)
11. Événements (tirage et résolution d'événements contextuels)
12. Mémoire (persistance des décisions marquantes pour rappel futur)

Invariant : cet ordre est fixe. Un module ne doit jamais lire un état d'une
étape postérieure dans le même tick (pas de dépendance circulaire intra-mois).
Le résultat global du mois doit être reproductible avec le même seed.

## 11. Critères d'acceptation du P0

- Le moteur simule au moins 10 ans (120 mois) sans crash ni état invalide,
  pour un scénario "petit boulot → business de service → croissance".
- Deux runs avec le même seed et la même séquence d'actions produisent un
  état final strictement identique (test de déterminisme).
- Il est possible, avec la même codebase, de faire échouer une entreprise
  (trésorerie négative prolongée → liquidation) et d'en faire prospérer une
  autre, sans branche de code dédiée à chaque issue.
- Les 5 familles économiques peuvent chacune produire un compte de résultat
  mensuel cohérent (marge brute positive plausible, EBITDA qui réagit aux
  décisions).
- Aucune fonction du cœur de simulation n'importe un module d'UI.
