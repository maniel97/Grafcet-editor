# Transitions et réceptivités

Une **transition** est le passage d’étapes à d’autres. Elle se dessine par un trait horizontal sur la liaison, avec sa **réceptivité** à droite : la condition logique qui permet le passage.

## Quand elle est franchie

1. Elle est **validée** si toutes ses étapes précédentes sont actives.
2. Elle est **franchie** si elle est validée et que sa réceptivité vaut 1.
3. Son franchissement désactive les étapes précédentes et active les suivantes, tout en même temps.

En simulation, une transition validée apparaît en orange et une transition franchissable, en vert. Si rien n’avance, survolez-la : elle dit ce qui manque.

## Comment écrire une réceptivité

| Écrivez | Signification |
|---|---|
| `a · b` (ou `a*b`) | a ET b |
| `a + b` | a OU b |
| `!a` | a complémenté (dessiné avec une barre au-dessus) |
| `↑a` | front montant de a : seulement à l’instant où il passe à 1 |
| `↓a` | front descendant |
| `X2` | l’étape 2 est active |
| `5s/X2` | 5 s se sont écoulées depuis l’activation de l’étape 2 (voir [Temporisations](temporizaciones)) |
| `[C >= 3]` | comparaison numérique (compteurs, grandeurs analogiques) |
| `1` | toujours vraie |

À la saisie, l’autocomplétion propose les variables existantes et les opérateurs.

> **Attention :** avec la réceptivité `1`, la transition est franchie dès qu’elle est validée : l’étape précédente est traversée sans s’arrêter (*évolution fugace*) et ses actions continues ne sont jamais exécutées. Vérifier le signale par un conseil.

## Transitions source et puits

Une transition **source** n’a pas d’étape précédente : elle est toujours validée et, chaque fois que sa réceptivité est vraie (normalement un front, `↑Pieza`), elle active ses étapes suivantes. Une transition **puits** n’a pas d’étape suivante : franchie, elle ne fait que désactiver.

```ejemplo contador
Des réceptivités avec fronts et comparaisons.
```
