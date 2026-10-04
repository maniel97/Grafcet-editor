# Choisir et faire à la fois (OU et ET)

Un grafcet n’est pas forcément une ligne droite. Il y a deux façons d’ouvrir des chemins.

## Divergence en OU : choisir un chemin

Une étape suivie de **plusieurs transitions** : on suit le chemin dont la réceptivité est vraie. Elle se dessine par un **trait simple** horizontal.

- Clic droit sur une transition > « Ajouter une alternative (OU) ».
- Les chemins se rejoignent par une **convergence en OU** : sélectionnez les dernières transitions de chaque chemin puis clic droit > « Faire converger … transitions en OU ».

> **Attention :** les réceptivités d’une divergence en OU doivent être **exclusives** : si deux sont vraies en même temps, les deux chemins s’activeraient. Utilisez `a · !b` et `b` au lieu de `a` et `b`. Vérifier le contrôle.

## Divergence en ET : faire plusieurs choses à la fois

Une transition suivie de **plusieurs étapes** : son franchissement les active toutes et chaque branche évolue de son côté. Elle se dessine par un **double trait**.

- Clic droit sur la transition > « Divergence en ET (2 branches) » (et « Ajouter une branche en ET » pour plus).
- Les branches se rejoignent par une **convergence en ET** : sélectionnez les dernières étapes de chaque branche puis clic droit > « Faire converger … étapes en ET ». La transition qui suit n’est franchie que quand **toutes** ces étapes sont actives : c’est une synchronisation.

> **Attention :** il faut souvent une étape d’attente (sans action) à la fin de chaque branche, pour que la branche rapide attende la lente.

## Ne pas mélanger

Un OU se ferme par un OU, et un ET par un ET. Si une divergence en ET est fermée par une convergence en OU, des étapes actives restent isolées et le grafcet finit avec plus d’étapes actives qu’il ne devrait : vérifiez-le en simulant.

```ejemplo clasificadora
Divergence en OU : chaque pièce va à sa place.
```

```ejemplo mezcladora
Divergence en ET : deux cuves à la fois.
```

Pour vous exercer au OU et à l’exclusivité pas à pas :

```tutorial divergencia-o
```
