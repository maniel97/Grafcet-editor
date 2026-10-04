# Grafcets partiels et forçage

Un système automatisé réel a plusieurs parties qui fonctionnent en même temps : la production, la sécurité, les modes de marche… Chacune se dessine comme un **grafcet partiel** (G1, G2…) et certaines peuvent **commander** les autres.

## Grafcets partiels

Sélectionnez les étapes et transitions d’une partie puis clic droit > « Encadrer dans un grafcet partiel » : elles sont dessinées dans un cadre G1. Tous les grafcets partiels évoluent en même temps, et chacun peut lire les étapes des autres (`X12` dans une réceptivité).

## Forçage

Un **ordre de forçage** est une action qui impose une situation à un autre grafcet partiel tant que dure l’étape qui le porte :

| Ordre | Effet sur G2 |
|---|---|
| `F/G2{3}` | seule l’étape 3 active |
| `F/G2{3, 5}` | seules les étapes 3 et 5 actives |
| `F/G2{}` | aucune étape active (vide) |
| `F/G2{*}` | figé : il reste tel quel |
| `F/G2{INIT}` | dans sa situation initiale |

Tant qu’il est forcé, **G2 n’évolue pas** : ses transitions ne sont pas franchies. À la fin du forçage, il repart de la situation imposée.

> **Attention :** le forçage est une hiérarchie. Le grafcet qui force (sécurité, modes de marche) est *au-dessus* du grafcet forcé (production). Un grafcet ne peut pas se forcer lui-même, et Vérifier avertit si l’on force un grafcet inexistant ou une étape qui ne lui appartient pas.

## Le cas typique : l’arrêt d’urgence

- G1 (sécurité) est au repos tant qu’il n’y a pas d’urgence.
- Avec l’urgence, G1 passe à une étape avec `F/G2{}` : la production s’arrête net.
- Après le réarmement, une étape avec `F/G2{INIT}` remet la production dans sa situation initiale, prête à repartir.

```ejemplo emergencia
La sécurité G1 force la production G2 à s’arrêter et à se réinitialiser.
```

Pour organiser les modes de marche et d’arrêt de façon systématique, voir [GEMMA](gemma).
