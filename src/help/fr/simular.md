# Simuler

**Simuler** exécute le grafcet comme le ferait l’automate, sans automate. Pendant la simulation, le diagramme ne peut pas être modifié ; « Arrêter » revient à l’édition.

## Ce que l’on voit

- **Étape active** : verte, avec un point.
- **Transition validée** : orange. **Franchissable** : verte.
- **Action émise** : verte.
- Dans le panneau de droite, les **entrées** (interrupteur ou bouton-poussoir), les **sorties** et les variables internes, compteurs et temporisations.

## Comment s’en servir

- Activez une entrée d’un clic, ou avec les touches **1–9** (dans l’ordre du panneau).
- En **Pause**, le bouton **Pas** (⏭) franchit une transition à la fois, pour bien voir ce qui se passe (évolution fugace comprise).
- La vitesse du temps peut être changée : utile avec de longues attentes.
- Si rien n’avance, survolez la transition : elle dit quelle condition manque.

## Partie opérative virtuelle et schéma électrique

Dans les exemples qui en ont une, la **partie opérative** (vérins, convoyeurs, détecteurs…) bouge avec vos sorties et active seule les entrées : c’est comme tester sur la machine. Le **schéma électrique** montre l’automate câblé et il est aussi simulé. Voir [La partie opérative virtuelle](planta) et [Le schéma électrique](esquema-electrico).

## Panneaux flottants

Le **chronogramme**, le **diagramme espace-phase** et les **scénarios de test** peuvent sortir du panneau : avec le bouton de leur titre ou en faisant glisser le titre sur la zone de travail.

- Ils se déplacent par leur barre de titre et se redimensionnent par les bords et les coins (au clavier : flèches pour déplacer, Maj + flèches pour la taille).
- Plus larges, ils en montrent plus : le chronogramme, plus de secondes.
- **Remettre** les replace dans le panneau. Leur place et leur taille sont mémorisées.

## Scénarios

« Enregistrer un scénario » note les changements d’entrées avec leur instant. Ils sont enregistrés dans le projet et rejoués d’un clic : ainsi vous vérifiez, après chaque modification, que tout fonctionne encore. Le chronogramme montre entrées, étapes et sorties dans le temps.

```ejemplo taladradora
Avec partie opérative virtuelle : cliquez sur Simuler puis sur Marcha.
```
