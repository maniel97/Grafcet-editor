# Variables et adresses

Les **variables** sont les noms utilisés dans les réceptivités et les actions : `Marcha`, `Motor`, `C`… Elles apparaissent seules dans la **table des variables** quand vous les écrivez, classées en entrées, sorties, internes, compteurs et analogiques.

## La table

- Bouton **Variables** de la barre : la table complète. On peut aussi la poser sur le canevas (clic droit > « Table des variables ici »), pour qu’elle soit imprimée.
- Chaque variable a une **adresse** automate (`I0.0`, `Q0.1`, `M0.0`…) et un **commentaire**.
- « Remplir les vides » (dans la table complète ; dans celle du canevas, clic droit > « Remplir les adresses vides ») attribue des adresses à celles qui n’en ont pas, selon le format choisi : **S7-200**, **S7-300/1200** ou **IEC 61131-3** (`%I0.0`).
- Faites glisser une variable vers une autre section pour changer son type.

## Renommer

Tapez le nouveau nom dans la table : il change dans toutes les réceptivités et actions, dans la partie opérative et dans le schéma, et la variable **garde** son adresse et son commentaire.

## Variables d’étape

`X2` est l’étape 2. Dans la table vous pouvez choisir que le ladder, le ST, la LIST et la simulation l’appellent `E2` (habitude de certains établissements) ; dans le grafcet on écrit toujours `X2`, comme le veut la norme.

## Grandeurs analogiques

Une entrée comparée à un nombre (`[Temperatura > 60]`) est analogique. Dans la table vous choisissez son signal (4–20 mA ou 0–10 V) et sa plage physique ; le ladder la met à l’échelle et la simulation utilise un curseur dans ces unités.

> **Attention :** un nom de variable ne peut pas contenir d’espaces ni commencer par un chiffre. Utilisez `PiezaArriba` ou `pieza_arriba`.
