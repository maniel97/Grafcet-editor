# Macro-étapes

Quand un grafcet grandit, une partie de la séquence peut être **résumée en une seule étape** et dessinée à part. Cette étape est une **macro-étape** : un carré avec un trait en haut et un autre en bas, numéroté M1, M2…

## Pourquoi ?

- Le grafcet principal se lit d’un coup d’œil : « doser », « percer », « évacuer ».
- Le détail de chaque partie est à sa place, sans croiser le reste.
- Chaque idée (l’*expansion*) peut être revue et testée séparément.

## Fonctionnement (IEC 60848)

La macro-étape M1 est détaillée dans son **expansion** : un morceau de grafcet avec une **étape d’entrée E1** et une **étape de sortie S1**.

1. Quand la transition précédant M1 est franchie, **E1** s’active.
2. L’expansion évolue comme n’importe quel grafcet.
3. La transition qui suit M1 n’est validée que quand **S1** est active. Son franchissement désactive S1.

> **Attention :** selon la norme, une macro-étape n’a pas d’actions propres (ce qu’elle fait est dans son expansion) et ne peut pas être initiale ; ce dernier point est contrôlé par Vérifier.

## Comment la dessiner

1. Clic droit sur une étape > « Convertir en macro-étape ».
2. Dessinez l’expansion et encadrez-la avec le même nom (M1) : sélectionnez ses étapes puis clic droit > « Encadrer comme expansion de macro-étape » (ou clic droit sur le canevas > « Cadre d’expansion ici »).
3. Numérotez son étape d’entrée **E1** et sa sortie **S1** (pour M2, E2 et S2).

Vérifier avertit si la macro-étape n’a pas d’expansion, ou s’il manque à l’expansion son étape d’entrée ou de sortie.

```ejemplo macroetapa
Le dosage, résumé en M1 et détaillé dans son expansion.
```
