# Vérifier

Le bouton **Vérifier** contrôle le grafcet en continu. Son nombre indique combien d’**erreurs** (rouge) ou d’**avertissements** (orange) il y a ; avec **✓**, tout est en ordre. Cliquez sur un message pour aller à l’élément ; « Plus dans l’aide » ouvre l’article qui explique la règle.

## Ce qu’il contrôle

- **La syntaxe de la norme** : qu’il y ait une étape initiale, que chaque étape ait un numéro non répété, qu’étapes et transitions alternent, que chaque transition ait une réceptivité.
- **La structure** : étapes sans entrée (jamais activées) ou sans sortie (jamais désactivées), transitions isolées, reprises qui continuent aussi vers le bas, étapes inaccessibles depuis toute étape initiale.
- **Les divergences en OU** : si deux chemins peuvent être vrais en même temps, il le dit et donne un exemple de valeurs où cela arrive.
- **Macro-étapes, grafcets partiels et encapsulation** : que chaque macro-étape ait son expansion (avec entrée et sortie), que les forçages visent des grafcets existants, que chaque étape encapsulante ait son grafcet encapsulé.
- **Conseils** : erreurs typiques d’apprentissage, comme des réceptivités qui utilisent des sorties, des temporisations d’une autre étape, des réceptivités toujours fausses, des étapes traversées sans s’arrêter ou des sorties commandées à la fois par une action continue et une action mémorisée.

## Erreurs, avertissements et conseils

- Une **erreur** signifie que le grafcet n’est pas conforme ou ne peut pas fonctionner : il faut la corriger.
- Un **avertissement** signale quelque chose que vous ne voulez probablement pas, mais qui peut être voulu.
- Un **conseil** est pédagogique : il explique la règle et n’empêche rien.

Si vous êtes sûr qu’un avertissement est voulu, laissez-le : il n’empêche ni de simuler ni de générer le ladder.

> **Attention :** Vérifier ne sait pas ce que doit faire votre machine. Un grafcet conforme peut être mal pensé : c’est à cela que sert la [simulation](simular).
