# La partie opérative virtuelle

La **partie opérative virtuelle** est une maquette animée de la machine : boutons-poussoirs, vérins, convoyeurs, détecteurs, cuves… Elle bouge avec les **sorties** du grafcet et active seule les **entrées** : c’est comme tester le programme sur la vraie machine, sans rien casser.

## L’ouvrir

En simulation, elle s’ouvre à côté du grafcet si le projet en a une ; dans le panneau de simulation, **« Partie opérative virtuelle »** la ferme et la rouvre. Faites glisser la séparation pour partager la largeur (double-clic : moitié-moitié).

## Utiliser et Éditer

- **Utiliser** : on l’actionne comme la machine : boutons-poussoirs, interrupteurs, distributeurs de pièces. Les entrées données par la partie opérative apparaissent dans le panneau avec la marque correspondante. Les potentiomètres se règlent avec la molette (avec Maj, plus finement), avec les flèches du clavier ou, sur écran tactile, en faisant glisser le doigt lentement.
- **Éditer** : on place et on configure les éléments. Faites-les glisser depuis la palette, tournez-les avec **R**, supprimez-les avec **Suppr**. Dans leurs propriétés on choisit la variable de chacun (si elle n’existe pas, elle est ajoutée à la table). Les dimensions (longueur d’un convoyeur, course d’un vérin, taille d’une image…) se changent en faisant glisser les petits carrés de l’élément sélectionné ; sur écran tactile ou tableau interactif, deux doigts zooment et déplacent la vue.

« Raccordements » montre ce qui est raccordé et ce qui manque : entrées du grafcet que personne ne donne, sorties qui ne font rien bouger.

## Diagramme espace-phase

Pendant la simulation, la section **« Diagramme espace-phase »** du panneau dessine ce qu’ont fait les vérins : une ligne par vérin avec ses positions 0 (rentré) et 1 (sorti) et une colonne par phase, chaque mouvement en diagonale. C’est le diagramme des cours de pneumatique, mais de ce que fait **votre** programme : comparez-le avec celui que demande l’énoncé.

- **Phases** ou **Temps** : l’axe horizontal par phases (étapes) ou en secondes (diagramme espace-temps).
- Si à la fin tout est revenu en position initiale, la dernière phase est notée « 5=1 » : le cycle est bouclé.
- **Séquence attendue** (par ex. `A+ B+ B− A−` ; le générateur pneumatique la remplit) : son diagramme est dessiné en gris dessous et on vérifie s’ils coïncident ; sinon, il indique dans quelle phase est la différence. Elle figure aussi dans le dossier du TP, avec le scénario de test.
- **Lignes de signaux** : à chaque changement de phase, la fin de course qui déclenche le mouvement suivant (`a1`, `b1`…).

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
