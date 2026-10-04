# La partie opérative virtuelle

La **partie opérative virtuelle** est une maquette animée de la machine : boutons-poussoirs, vérins, convoyeurs, détecteurs, cuves… Elle bouge avec les **sorties** du grafcet et active seule les **entrées** : c’est comme tester le programme sur la vraie machine, sans rien casser.

## L’ouvrir

En simulation, elle s’ouvre à côté du grafcet si le projet en a une ; dans le panneau de simulation, **« Partie opérative virtuelle »** la ferme et la rouvre. Faites glisser la séparation pour partager la largeur (double-clic : moitié-moitié).

## Utiliser et Éditer

- **Utiliser** : on l’actionne comme la machine : boutons-poussoirs, interrupteurs, distributeurs de pièces. Les entrées données par la partie opérative apparaissent dans le panneau avec la marque correspondante.
- **Éditer** : on place et on configure les éléments. Faites-les glisser depuis la palette, tournez-les avec **R**, supprimez-les avec **Suppr**. Dans leurs propriétés on choisit la variable de chacun (si elle n’existe pas, elle est ajoutée à la table).

« Raccordements » montre ce qui est raccordé et ce qui manque : entrées du grafcet que personne ne donne, sorties qui ne font rien bouger.

## Plus de réalisme

- **Gravité** : vue de face ; les pièces tombent, reposent sur des plateformes et sur la tige des vérins.
- **Relief** : dessin en volume, seulement pour la présentation.
- **Pannes** (en Utiliser) : un détecteur qui ne donne pas de signal, un vérin qui se bloque… pour s’exercer au diagnostic.
- **Pupitre de commande** : boutons et voyants peuvent aller sur un pupitre à part.
- **Mes groupes** : enregistrez un poste pour le réutiliser dans d’autres projets.

> **Attention :** si rien ne bouge, regardez d’abord « Raccordements », puis la section « Ce qu’attend le grafcet » du panneau de simulation.

```ejemplo taladradora
Une perceuse avec sa partie opérative.
```

```ejemplo cargador-gravedad
Avec gravité : les pièces tombent du chargeur.
```

Pour l’essayer pas à pas :

```tutorial planta
```
