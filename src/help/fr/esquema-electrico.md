# Le schéma électrique

Le bouton **Schéma électrique** ouvre le schéma de l’installation : commande, puissance et raccordements de l’automate, avec les symboles de la norme IEC 60617. Et il est **simulé** : appuyez sur un bouton-poussoir et vous verrez passer le courant, se fermer les contacteurs et tourner les moteurs.

## Ce que l’on peut faire

- **Insérer un montage** : des montages classiques prêts à simuler et à modifier (marche-arrêt avec auto-maintien, inversion de sens de marche, étoile-triangle, variateur, électropneumatique avec distributeurs 5/2…).
- **Raccordements de l’automate** : crée l’automate avec un appareil sur chaque entrée et sortie de la table des variables, déjà câblé.
- **Raccorder à l’automate et à la partie opérative** : le schéma, le grafcet et la partie opérative fonctionnent ensemble. Le bouton-poussoir du schéma donne l’entrée de l’automate, la sortie alimente le contacteur et le contacteur fait tourner le convoyeur.
- **Plusieurs feuilles** avec cartouche, colonnes numérotées et renvois ; numéros de fils et borniers.
- **Exporter le schéma** (PDF vectoriel, PNG ou SVG), aussi dans le dossier du TP.

## Utiliser et Éditer

En **Éditer** on place les appareils et on tire les fils de borne à borne. En **Utiliser** on actionne boutons et sélecteurs à la souris.

## Pannes et multimètre

En Utiliser, chaque appareil peut avoir des pannes (contact ouvert, collé, fil coupé). « Panne au hasard (cachée) » en cache une pour la chercher avec le **multimètre**, en mesurant les tensions entre bornes comme à l’atelier.

> **Attention :** les conduites pneumatiques (tubes) ne se mélangent pas avec les fils électriques : un distributeur se commande par sa bobine électrique et fait bouger le vérin par ses tubes.

```ejemplo estrella-triangulo-plc
Démarrage étoile-triangle commandé par l’automate.
```
