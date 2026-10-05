# Exercices

Un **exercice** contient un énoncé et ce que le professeur fournit déjà fait (la partie opérative, la table des variables, le schéma…). C’est vous qui dessinez le grafcet, et l’éditeur vous dit s’il est correct.

## Pour les élèves

1. Ouvrez l’exercice : Ouvrir > Exercices, ou avec Ouvrir > Ouvrir un fichier le fichier que le professeur vous a donné (un .json ou la fiche de TP en PDF : l’exercice est à l’intérieur).
2. Lisez l’énoncé dans le panneau **Exercice** (à droite ; le bouton de la barre l’ouvre et le ferme).
3. Dessinez le grafcet. Vous pouvez le simuler et le vérifier comme d’habitude.
4. Cliquez sur **Vérifier l’exercice** autant de fois que vous voulez. Chaque vérification s’affiche en vert ou en rouge, avec ce qui ne va pas.

> **Attention :** ce que le professeur fournit verrouillé (par exemple la table des variables) ne peut pas être modifié : utilisez ces noms dans le grafcet. Si vous en écrivez un qui n’y est pas, la vérification le signale comme faute de frappe possible.

## Ce qui est vérifié

- Qu’il y a un grafcet (étape initiale et au moins une transition).
- Qu’il respecte la norme : Vérifier sans erreurs.
- Avec la table des variables fournie, que vous n’utilisez que ses variables.
- Dans les exercices avec partie opérative, que la machine fait la séquence demandée avec le scénario de test du professeur.
- Avec chaque scénario de test, que la machine répond comme celle du professeur : les sorties s’allument et s’éteignent aux mêmes moments (avec une marge de temps) et les mêmes pièces arrivent. Si quelque chose échoue, **Le voir dans la simulation** rejoue ce scénario pour que vous voyiez où.

## Pour les professeurs

1. Résolvez l’exercice dans l’éditeur : c’est votre solution et elle n’est pas distribuée.
2. Préparez les scénarios de test : enregistrez-les en simulation (par exemple, appuyer sur Marcha et attendre un cycle) ou cliquez sur **Dessiner un scénario** et faites glisser sur la ligne de chaque entrée pour décider quand elle est actionnée ; en dessous, vous voyez en direct ce que fait votre grafcet.
3. Exporter > **Exercice pour les élèves** : écrivez l’énoncé, choisissez ce qui est fourni (et s’il est verrouillé) et ce qui est vérifié. Cliquez sur **Tester** : avec votre solution, tout doit être vert.
4. **Enregistrer et télécharger pour les élèves** crée le fichier à distribuer, sans votre grafcet.
5. **Fiche de TP (PDF)** crée une fiche comme d’habitude, à imprimer ou distribuer : en-tête pour le nom, énoncé, ce qui est fourni (table, partie opérative, schéma), critères d’évaluation en toutes lettres et scénarios de test. Le fichier de l’exercice voyage dans le PDF en pièce jointe : ouvrir le PDF dans l’éditeur charge l’exercice. N’importe qui peut évaluer l’exercice avec le papier, sans connaître le logiciel, et l’**empreinte** du pied de page identifie le fichier joint.

> **Attention :** les vérifications voyagent scellées dans le fichier, mais ce n’est pas un système de sécurité : le correcteur se base sur le comportement, pas sur la copie de votre grafcet.

```ejemplo cilindros
Un bon point de départ pour un exercice avec partie opérative.
```
