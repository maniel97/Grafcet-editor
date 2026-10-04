# Actions

Les **actions** disent ce qui est fait tant qu’une étape est active. Elles se dessinent dans des rectangles à droite de l’étape. On les ajoute avec le **+** à droite de l’étape, depuis ses propriétés (double-clic) ou par clic droit > « Ajouter une action ».

## Types (IEC 60848)

- **Continue** : la sortie vaut 1 tant que l’étape est active. C’est la plus courante : `Motor`.
- **Conditionnelle** : en plus de l’étape, elle exige une condition, écrite sur un trait vertical au-dessus de l’action. `Motor` avec la condition `!Termico`.
- **Retardée ou limitée dans le temps** : une action conditionnelle avec du temps. `3s/X2` au-dessus : elle s’active 3 s après l’activation de l’étape.
- **Mémorisée à l’activation** (flèche ↑) : exécutée une fois, quand l’étape s’active. `A:=1` met A à 1 et l’y laisse jusqu’à ce qu’une autre action la remette à 0. Aussi pour les compteurs : `C:=C+1`.
- **Mémorisée à la désactivation** (flèche ↓) : pareil, quand l’étape se désactive.
- **Sur événement** : exécutée à l’instant d’un événement tant que l’étape est active, par ex. `↑b`.

## Continue ou mémorisée ?

Avec des actions **continues**, il suffit de regarder les étapes actives pour savoir quelles sorties sont actives. Avec des actions **mémorisées**, non : il faut savoir ce qui s’est passé avant. Donc :

- Utilisez des actions continues chaque fois que possible.
- Utilisez des actions mémorisées quand la sortie doit durer sur plusieurs étapes non consécutives, ou pour les compteurs et les valeurs.
- Chaque `A:=1` doit avoir son `A:=0` quelque part ; sinon la sortie reste à 1 pour toujours.

> **Attention :** si une sortie apparaît comme continue dans deux étapes, elle vaut 1 si l’une des deux est active (c’est un OU). Si en plus elle est mémorisée dans une autre, les deux formes se contredisent : Vérifier le signale par un conseil.

```ejemplo cilindros
Seulement des actions continues : un mouvement par étape.
```

```ejemplo contador
Des actions mémorisées : C:=0 au départ et C:=C+1 à chaque tour.
```
