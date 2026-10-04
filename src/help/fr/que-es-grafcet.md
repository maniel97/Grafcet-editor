# Qu’est-ce qu’un grafcet ?

Un **grafcet** décrit, par un dessin normalisé, comment se comporte un système automatisé : ce que fait la machine à chaque instant et ce qui doit se produire pour passer d’une situation à la suivante. Il est défini par la norme **IEC 60848** (en France, NF EN 60848).

## Pourquoi un grafcet et pas directement le programme ?

- **Il se comprend sans savoir programmer.** Le mécanicien, l’électricien et le programmeur lisent la même chose.
- **Il sépare le quoi du comment.** On réfléchit d’abord à la séquence ; ensuite on la traduit en ladder, ST ou LIST pour l’automate voulu. Cet éditeur fait cette traduction.
- **Il évite les oublis.** Chaque situation est une étape et chaque changement, une transition avec sa condition : s’il manque quelque chose, cela se voit (et Vérifier le signale).

## Les éléments

- **Étapes** (carrés) : les situations dans lesquelles peut se trouver le système. Les étapes actives indiquent où il en est. Voir [Étapes](etapas).
- **Transitions** (traits horizontaux) : le passage d’étapes à d’autres, avec leur **réceptivité**, la condition qui le permet. Voir [Transitions](transiciones).
- **Actions** (rectangles à droite de l’étape) : ce qui est fait tant que l’étape est active. Voir [Actions](acciones).
- **Liaisons** : elles relient étapes et transitions, qui alternent toujours. Elles se lisent de haut en bas ; celles qui remontent portent une flèche.

## Comment il évolue

1. Au démarrage, les **étapes initiales** (double carré) s’activent.
2. Une transition est **validée** quand toutes ses étapes précédentes sont actives.
3. Si en plus sa réceptivité est vraie, elle est **franchie** : les étapes précédentes se désactivent et les suivantes s’activent, en même temps.
4. Les transitions franchissables en même temps sont franchies simultanément.

> **Attention :** une transition validée dont la réceptivité est fausse attend. Un grafcet ne « saute » pas d’étapes : il y a toujours une transition entre deux.

```ejemplo marcha-paro
Le grafcet le plus simple : deux étapes, deux transitions. Ouvrez-le et cliquez sur Simuler.
```

Pour dessiner le vôtre pas à pas :

```tutorial primer-grafcet
```
