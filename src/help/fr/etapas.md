# Étapes

Une **étape** est une situation stable du système : « attente », « descente du foret », « remplissage »… À chaque instant, chaque étape est **active** ou **inactive** ; l’ensemble des étapes actives est la *situation* du grafcet.

## Types

- **Étape** (carré avec son numéro) : l’étape normale.
- **Étape initiale** (double carré) : active au démarrage. Tout grafcet en a besoin d’au moins une.
- **Macro-étape** (carré avec un trait en haut et en bas, M1…) : représente un morceau de grafcet dessiné à part, son *expansion*, avec une étape d’entrée E1 et une étape de sortie S1.
- **Étape encapsulante** (coins coupés) : tant qu’elle est active, le grafcet qu’elle encapsule l’est aussi. Voir la page « Notation IEC 60848 ».

## La variable d’étape

Chaque étape a une variable, **X** suivi de son numéro : `X2` vaut 1 tant que l’étape 2 est active. Elle sert dans les réceptivités (`X2 · b`), pour synchroniser des grafcets et dans les [temporisations](temporizaciones) (`5s/X2`).

> **Attention :** les numéros d’étape n’ont pas besoin de se suivre, mais ils doivent être uniques dans tout le projet (toutes les feuilles). Vérifier signale une erreur s’il y en a deux identiques.

## Bonnes habitudes

- Numérotez dans l’ordre de parcours : c’est plus lisible et le ladder est ordonné.
- Une étape sans action est normale (attentes, repos).
- Si deux étapes font toujours la même chose et qu’on passe de l’une à l’autre sans condition (réceptivité `1`), l’une des deux est probablement inutile.

```ejemplo taladradora
Des étapes avec actions et une étape de repos sans action.
```
