# Reprises et sauts

Presque tous les grafcets sont cycliques : à la fin, ils reviennent à l’étape de repos. Et il faut parfois sauter des étapes ou les répéter.

## Recommencer

Clic droit sur la dernière transition > « Reprise vers l’étape » et cliquez sur l’étape de destination (normalement l’initiale). La liaison remonte **par la gauche avec une flèche** : la norme lit les liaisons de haut en bas, et celles qui remontent doivent porter une flèche.

## Répéter (reprise de séquence)

Une divergence en OU dont un des chemins remonte à une étape antérieure : « tant que ce n’est pas fini, recommence ».

- Sous l’étape, une transition `[C < 3]` qui remonte et une autre `[C >= 3]` qui continue.
- Le compteur se gère avec des actions mémorisées : `C:=0` avant la reprise et `C:=C+1` dedans.

## Sauter des étapes

Pareil vers le bas : une alternative en OU qui descend directement à une étape plus loin.

## Liaisons longues

Si une liaison traverse la moitié du dessin, clic droit dessus > « Couper avec renvois » : elle se dessine comme une flèche avec « vers l’étape 0 » à l’origine et « de … » à la destination. C’est toujours la même liaison.

> **Attention :** une transition est suivie soit d’une reprise, soit d’étapes en dessous, pas des deux : les deux s’activeraient en même temps. Le menu ne propose que ce qui a un sens.

```ejemplo contador
Une reprise qui se répète jusqu’à ce que le compteur atteigne sa valeur.
```
