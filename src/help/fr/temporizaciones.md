# Temporisations

Une **temporisation** est une condition qui devient vraie quand un certain temps s’est écoulé. Ce n’est pas un appareil qu’on ajoute : on l’**écrit** dans une réceptivité ou au-dessus d’une action, et l’éditeur crée tout seul la temporisation (et celle de l’automate, lors du passage au ladder).

## La forme la plus courante : attendre dans une étape

Pour qu’une étape dure un certain temps, on écrit dans la transition en dessous :

```
5s/X2
```

Elle se lit « **5 secondes depuis l’activation de l’étape 2** ». Elle vaut 0 quand l’étape 2 s’active et passe à 1 quand celle-ci est active depuis 5 s ; la transition est alors franchie.

Pas à pas :

1. Sélectionne l’étape (par exemple, la 2) et appuie sur le **+** en dessous : une transition apparaît.
2. Double-clique sur la transition et écris `5s/X2`. Dans « Réceptivités fréquentes », un bouton l’écrit avec l’étape du dessus.
3. Appuie sur **Simuler** : quand l’étape 2 s’active, la transition sera franchie toute seule au bout de 5 s.

> **Attention :** le numéro après X est celui de l’**étape attendue**, normalement celle juste au-dessus. Si tu écris `5s/X1` sous l’étape 2, le temps compte depuis l’activation de l’étape 1 (Vérifier le signale par un conseil).

```ejemplo semaforo
Un feu tricolore : chaque feu, une étape avec sa durée (10s/X0, 8s/X1, 3s/X2).
```

## Unités

`ms` (millisecondes), `s` (secondes), `min` (minutes) et `h` (heures). Les décimales sont admises avec un point ou une virgule : `0.5s/X3`, `1,5s/X3`, `2min/X4`.

## Attendre que quelque chose dure : retard sur une variable

Une temporisation peut aussi porter sur une entrée ou n’importe quelle variable, pas seulement sur une étape :

| On écrit | Vaut 1… | Pour quoi |
|---|---|---|
| `3s/a` | quand `a` est à 1 depuis **3 s d’affilée**. Si `a` retombe avant, elle recommence | filtrer : une pièce qui ne fait que passer ne compte pas, seulement une qui reste |
| `0s/a/2s` | quand `a` monte, et reste à 1 **2 s après** que `a` retombe | prolonger : un voyant qui reste allumé un moment après avoir relâché le bouton |
| `3s/a/2s` | 3 s après la montée de `a`, et retombe 2 s après la retombée de `a` | les deux à la fois |

La forme générale de la norme est `t1/a/t2` : `t1` retarde la montée et `t2` la retombée.

```ejemplo apilador-trampilla
1s/Pila : la trappe ne s’ouvre que si le détecteur voit la pile pendant 1 s (une caisse qui tombe coupe le faisceau un instant et ne compte pas).
```

## Dans une action : allumer plus tard, ou seulement un moment

Une **action conditionnelle** avec une temporisation au-dessus (double-clic sur l’étape, type d’action « Conditionnelle », et la temporisation dans sa condition) :

- **Retardée** (`4s/X1` au-dessus de `Vibrador`) : le vibreur démarre 4 s après l’activation de l’étape 1 et reste en marche jusqu’à la désactivation de l’étape.
- **Limitée** (`!2s/X1` au-dessus de `Aviso`) : l’alarme ne sonne que pendant les 2 premières secondes de l’étape 1. Le `!` veut dire « non » : « tant que 2 s ne se sont **pas** écoulées ».

```ejemplo silo-vibrador
Les deux dans la même étape : l’alarme sonne 2 s au début de la vidange et le vibreur démarre au bout de 4 s.
```

## Ce qu’on voit en simulation

- Dans le panneau de droite, **Temporisations** : une barre pour chacune, avec le temps écoulé et le total (`1.2 / 5 s`). En vert une fois atteinte ; « étape inactive » si elle n’a pas encore commencé.
- **Ce qu’attend le grafcet** indique ce qui reste, par exemple pour 5s/X2 : il reste 3,8 s.
- Pour ne pas attendre : **+1 s** avance le temps d’une seconde, et le sélecteur de **vitesse** (×2, ×5…) accélère tout.

## Règles utiles

- Le temps **repart de zéro** à chaque activation de l’étape (ou chaque montée de la variable). Si l’étape se désactive avant la fin, le décompte est perdu.
- Une temporisation n’est pas une variable à déclarer : inutile de l’ajouter au tableau.
- Dans le **tableau des variables**, elles apparaissent sous *Temporisations* avec leur adresse (T1, T37…). La durée vient du grafcet : pour la changer, modifie la réceptivité ou l’action.

## Dans l’automate

Lors du passage au ladder (bouton **Ladder**), chaque temporisation différente devient une temporisation **TON** (retard à l’enclenchement). Celles de la forme `a/2s` (retard au déclenchement) utilisent en plus un bit auxiliaire. Sur le S7-200, ce sont des temporisations de 100 ms, à partir de T37 ; si une durée est trop longue pour la temporisation, l’export le signale.

Voir aussi : [Compteurs](contadores) · [Actions](acciones) · [Transitions et réceptivités](transiciones).

Pour t’entraîner pas à pas :

```tutorial temporizacion
```
