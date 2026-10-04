# Du grafcet à l’automate

Le bouton **Ladder** traduit le grafcet en programme d’automate, dans plusieurs langages :

- **Ladder** (contacts), pour voir et imprimer.
- **ST** (texte structuré IEC 61131-3) et **SCL** de TIA Portal.
- **LIST** (AWL / STL) pour S7-300 et S7-200, prêt à importer.

## La méthode

C’est la méthode classique d’**un bit interne par étape avec SET et RESET**, celle qu’on enseigne en cours. Le programme est rangé en sections :

1. **Initialisation** : au premier cycle, les étapes initiales s’activent et les autres se désactivent.
2. **Conditions de franchissement** : un bit par transition = étapes précédentes actives · réceptivité.
3. **Désactivation** des étapes précédentes et **activation** des suivantes (RESET et SET).
4. **Temporisations** et **compteurs**.
5. **Actions** : les mémorisées avec SET/RESET ; les continues, une bobine par sortie avec le OU de ses étapes.

Calculer d’abord toutes les transitions, puis activer et désactiver, fait que les transitions franchissables en même temps sont franchies ensemble, comme le dit la norme.

> **Attention :** les sorties ne sont écrites qu’une fois, à la fin. Si une sortie apparaît dans plusieurs étapes, sa bobine porte le OU de toutes : ne mettez pas deux bobines sur la même sortie.

## Le passer à l’automate

- **STEP 7-Micro/WIN (S7-200)** : téléchargez le `.awl` et importez-le par Fichier > Importer. La table des mnémoniques se copie-colle.
- **TIA Portal** : copiez le SCL dans une source externe ou un bloc SCL.
- **Autres (CODESYS, etc.)** : le ST est standard.

Clic droit sur une étape ou une transition > « Voir dans le ladder » mène aux réseaux qu’elle génère.

```ejemplo taladradora
Ouvrez-le et cliquez sur Ladder.
```
