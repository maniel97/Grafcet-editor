# Le schéma électrique

Le bouton **Schéma électrique** ouvre le schéma de l’installation : commande, puissance et raccordements de l’automate, avec les symboles de la norme IEC 60617. Et il est **simulé** : appuyez sur un bouton-poussoir et vous verrez passer le courant, se fermer les contacteurs et tourner les moteurs.

## Ce que l’on peut faire

- **Insérer un montage** : des montages classiques prêts à simuler et à modifier (marche-arrêt avec auto-maintien, inversion de sens de marche, étoile-triangle, variateur, électropneumatique avec distributeurs 5/2…).
- **Raccordements de l’automate** : crée l’automate avec un appareil sur chaque entrée et sortie de la table des variables, déjà câblé.
- **Raccorder à l’automate et à la partie opérative** : le schéma, le grafcet et la partie opérative fonctionnent ensemble. Le bouton-poussoir du schéma donne l’entrée de l’automate, la sortie alimente le contacteur et le contacteur fait tourner le convoyeur.
- **Poser des appareils (tampon)** : cliquez sur un appareil de la palette puis sur le schéma : un appareil par clic, avec son aperçu sous la souris. Échap, « Terminer » ou le bouton droit le relâchent. Double-clic dans la palette : un appareil dans le premier espace libre. Au doigt, pareil : touchez la palette puis le schéma.
- **Plusieurs feuilles** avec cartouche, colonnes numérotées et renvois ; numéros de fils et borniers.
- **Exporter le schéma** (PDF vectoriel, PNG ou SVG), aussi dans le dossier du TP.

## Utiliser et Éditer

En **Éditer** on place les appareils et on tire les fils de borne à borne. En **Utiliser** on actionne boutons et sélecteurs à la souris.

## Pannes et multimètre

En Utiliser, chaque appareil peut avoir des pannes (contact ouvert, collé, fil coupé). « Panne au hasard (cachée) » en cache une pour la chercher avec le **multimètre**, en mesurant les tensions entre bornes comme à l’atelier.

## Électrohydraulique

Dans la palette, le groupe **Hydraulique** (ISO 1219) : centrale hydraulique (moteur, pompe et réservoir), limiteur de pression, manomètre, distributeurs 4/3 et 4/2, vérin et régleur de débit. On le monte et on le simule comme le pneumatique, avec trois différences visibles en simulation :

- **L’huile ne se comprime pas** : avec les deux orifices du vérin fermés (centre fermé ou tandem du 4/3), il reste où il est, même à mi-course.
- **La pompe donne du débit, pas de la pression** : si l’huile n’a pas de sortie (vérin en butée, centre fermé), la pression monte jusqu’à ce que le **limiteur** s’ouvre et que l’huile retourne au réservoir par lui. Le **manomètre** l’indique : pression faible en mouvement, celle du tarage en butée, 0 avec le centre tandem (la pompe débite à vide).
- Un orifice sans tube **répand de l’huile**, et sans limiteur un avertissement indique que la pression monte sans contrôle.

Les tubes sous pression s’affichent en orange. Deux montages dans « Insérer un montage » : la presse (4/3 tandem) et l’élévateur à descente freinée (centre fermé).

> **Attention :** les conduites pneumatiques (tubes) ne se mélangent pas avec les fils électriques : un distributeur se commande par sa bobine électrique et fait bouger le vérin par ses tubes.

```ejemplo estrella-triangulo-plc
Démarrage étoile-triangle commandé par l’automate.
```
