# Encapsulation

L’**encapsulation** (IEC 60848) est une autre façon de structurer : une étape **contient** tout un grafcet, qui ne vit que tant qu’elle est active.

## Fonctionnement

- L’**étape encapsulante** se dessine avec les coins coupés.
- Son **grafcet encapsulé** va dans un cadre portant son nom.
- Quand l’étape encapsulante s’active, les étapes encapsulées marquées du **lien d’activation** (un astérisque *) s’activent.
- Tant qu’elle est active, le grafcet encapsulé évolue de son côté.
- Quand elle se désactive, **tout ce qui est encapsulé se désactive**, où qu’il en soit.

## Macro-étape ou encapsulation ?

- La **macro-étape** est un morceau de séquence : on y entre par E1 et il faut atteindre S1 pour continuer.
- L’**encapsulation** est une activité qui dure autant que son étape : le grafcet extérieur peut continuer à tout moment et l’intérieur est interrompu. C’est le choix naturel pour « tant qu’on est en marche, fais ceci » ou pour surveiller une phase.

## Comment la dessiner

1. Clic droit sur une étape > « Convertir en étape encapsulante » : son cadre est créé aussi.
2. Dessinez le grafcet encapsulé dans le cadre.
3. Clic droit sur l’étape par laquelle il doit commencer > « Lien d’activation (*) ».

> **Attention :** si une étape encapsulée est initiale, l’étape encapsulante doit l’être aussi. Et aucune liaison ne peut traverser le cadre : les étapes intérieures ne s’activent que par le lien d’activation. Vérifier contrôle les deux.

```ejemplo encapsulacion
Une étape encapsulante avec son grafcet encapsulé.
```
