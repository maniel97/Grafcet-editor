# Compteurs

En grafcet, un **compteur** est une variable qui garde un nombre (`C`, `Piezas`, `Plazas`…). Il n’y a pas de bloc « compteur » à ajouter : on compte avec des **actions mémorisées** qui changent sa valeur, et on le vérifie avec des **comparaisons** dans les réceptivités.

## Les trois éléments

| Pour… | On écrit | Où |
|---|---|---|
| remettre à zéro | `C:=0` | action **mémorisée à l’activation** (↑) de l’étape où tout commence, normalement l’initiale |
| ajouter un | `C:=C+1` | action **mémorisée à l’activation** de l’étape qui s’active une fois pour chaque chose comptée |
| comparer | `[C >= 3]` | réceptivité d’une transition (ou condition d’une action) |

Comparaisons admises : `=`, `<>` (différent), `<`, `<=`, `>`, `>=`. Les crochets sont la forme de la norme ; ça marche aussi sans eux (`C >= 3`) et combiné : `↑P · [C < 3]`.

Quand tu écris `C:=…` dans une nouvelle action, l’éditeur la passe tout seul en **mémorisée à l’activation** : une affectation en action continue ne ferait rien (Vérifier la signale comme erreur).

## Compter avec une boucle (le plus clair)

On compte **une fois par activation** d’une étape. Par exemple, allumer un voyant à la troisième pression sur P :

```
Étape 0 (initiale)  C:=0
  Marcha
Étape 1             (attend une pression)
  ↑P · [C < 2]  → étape 2          ↑P · [C >= 2] → étape 3
Étape 2             C:=C+1, puis retour à l’étape 1 (transition « 1 »)
Étape 3             Luz
```

- `↑P` (front montant) : chaque pression compte **une fois**, même si on garde le bouton appuyé.
- Les deux transitions sous l’étape 1 sont un **choix** : l’une recompte, l’autre termine. Elles doivent être exclusives (`< 2` et `>= 2`).
- La comparaison regarde la valeur **avant** la pression qui arrive : avec 2 déjà comptées, la troisième va au voyant.

```ejemplo contador
Ce même grafcet, prêt à simuler.
```

## Compter sans changer d’étape : action sur événement

Si la machine doit rester dans la même étape pendant qu’elle compte, on utilise une action **sur événement** : elle s’exécute à l’instant de l’événement, tant que l’étape est active.

1. Double-clic sur l’étape, **Ajouter une action**, type « Sur événement ».
2. Texte : `C:=C+1`. Dans sa condition (l’événement) : `↑P`.

Chaque front montant de P ajoute un tant que l’étape est active. La sortie de l’étape peut être `[C >= 10]`.

## Décompter

`C:=C-1` retire un. Avec les deux, un parking tient le compte des places occupées : `C:=C+1` quand une voiture entre et `C:=C-1` quand elle sort ; `[C < 5]` laisse entrer et `[C > 0]` laisse sortir.

```ejemplo aparcamiento
Places d’un parking : ajouter, retirer, et les voyants Libre / Completo en actions conditionnelles (C < 5, C >= 5).
```

D’autres opérations marchent aussi : `N:=N+5`, `D:=A*2`, `M:=(A+B)/2`.

## Ce qu’on voit en simulation

- Dans le panneau de droite, **Bits internes et compteurs**, avec leur valeur à chaque instant.
- **Ce qu’attend le grafcet** indique quelle comparaison manque et la valeur actuelle : avec `[C >= 3]` et C à 1, « C = 1 ».
- Le **chronogramme** montre quand chaque étape s’est activée (donc quand on a compté).

## Erreurs typiques

- **Oublier `C:=0`** : le compteur commence avec ce qu’il avait la fois précédente. Mets-le dans l’étape initiale (ou dans celle où commence chaque cycle).
- **Compter sans front** (`P` au lieu de `↑P`) : tant que P est appuyé, la transition est vraie encore et encore et compte trop.
- **Comparaisons non exclusives** (`[C <= 3]` et `[C >= 3]`) : avec C à 3, les deux sont vraies. Vérifier le détecte dans les divergences en OU.
- **Compter dans une étape qui ne se répète pas** : `C:=C+1` ajoute une fois **par activation** ; si l’étape reste active, elle n’ajoute plus (pour cela, l’action sur événement).

## Dans l’automate

L’éditeur n’utilise pas les blocs compteurs de l’automate (CTU, CTD) : un compteur est un **mot** (`MW100` sur S7-300/1200, `VW` sur S7-200) et `C:=C+1` devient une addition (`+I` sur S7-200). Les comparaisons utilisent les comparateurs de mots. Ainsi, toute opération se traduit comme dans le grafcet (`+5`, `-1`, `*2`), pas seulement compter un par un.

Voir aussi : [Actions](acciones) (mémorisées et sur événement) · [Boucles et sauts](bucles) · [Transitions et réceptivités](transiciones).
