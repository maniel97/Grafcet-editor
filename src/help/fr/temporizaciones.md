# Temporisations

En grafcet, le temps s’écrit comme une **condition temporelle** sur une variable : `t1/variable/t2`.

## Les formes habituelles

- `5s/X2` : vaut 1 quand 5 s se sont écoulées depuis l’activation de l’étape 2. C’est l’attente typique : une transition `5s/X2` sous l’étape 2 attend 5 s et continue.
- `3s/a` : vaut 1 quand `a` est à 1 depuis 3 s (retard à l’enclenchement). Si `a` retombe avant, tout recommence.
- `3s/a/2s` : monte 3 s après la montée de `a` et descend 2 s après la descente de `a`.
- `0s/a/2s` : suit `a` à la montée et la prolonge de 2 s à la descente (retard au déclenchement).

Les unités admises sont `ms`, `s`, `min` et `h`.

## Dans les actions

Une action conditionnelle avec une condition temporelle est retardée ou limitée :

- `3s/X4` au-dessus de `Bocina` (klaxon) : le klaxon sonne à partir de 3 s d’étape 4.
- `!5s/X4` au-dessus de `Bocina` : il ne sonne que pendant les 5 premières secondes de l’étape 4.

> **Attention :** le temps compte depuis la montée de la variable. Si l’étape se désactive puis se réactive, il repart de zéro.

## Dans l’automate

Le ladder utilise une temporisation par condition temporelle différente (TON en S7-200 ou IEC). Vous pouvez la voir avec le bouton Ladder.

```ejemplo semaforo
Un feu de circulation : seulement des temps.
```

Pour vous exercer pas à pas :

```tutorial temporizacion
```
