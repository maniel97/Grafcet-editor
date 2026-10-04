# GEMMA : modes de marche et d’arrêt

Le **GEMMA** (*Guide d’Étude des Modes de Marches et d’Arrêts*) est un modèle pour n’oublier aucune situation d’une machine réelle : pas seulement produire, mais aussi s’arrêter, démarrer, revenir en position initiale ou réagir à une défaillance.

## Les trois familles d’états

- **A — Procédures d’arrêt** : A1 arrêt dans l’état initial, A2 arrêt demandé en fin de cycle, A6 mise de la partie opérative en état initial…
- **F — Procédures de fonctionnement** : F1 production normale, F2–F3 marches de préparation et de clôture, F4–F6 marches de vérification et d’essai.
- **D — Procédures en défaillance** : D1 arrêt d’urgence, D2 diagnostic, D3 production malgré la défaillance.

Chaque machine n’en utilise que certains. On remplit le GEMMA en cochant ceux qui servent et les conditions de passage de l’un à l’autre.

## Du GEMMA au grafcet

Le résultat est un **grafcet de conduite** : une étape par état du GEMMA, chacune avec l’**ordre de forçage** qu’elle impose au grafcet de production (voir [Grafcets partiels et forçage](grafcets-parciales)). Par exemple :

- D1 (urgence) : `F/G1{}` — production arrêtée.
- A6 (mise en état initial) : `F/G1{INIT}`.
- F1 (production normale) : pas de forçage, la production évolue.

## L’assistant

1. Encadrez le grafcet de production dans un grafcet partiel (G1).
2. Bouton **GEMMA** de la barre : cochez les états utilisés, ajoutez les transitions entre eux avec leur condition et écrivez l’ordre de forçage de chaque état. « Charger l’exemple type » remplit un cas courant pour commencer.
3. « Générer le grafcet de conduite » le dessine dans la feuille GEMMA, dans un cadre GC.

> **Attention :** le GEMMA ne remplace pas la sécurité câblée. Le bouton d’arrêt d’urgence coupe la puissance de façon matérielle ; le GEMMA décide comment le programme se comporte avant et après.

```ejemplo gemma-linea
Marche, arrêt en fin de cycle, urgence avec défaillance et réarmement en position initiale.
```
