# Votre premier grafcet

Dessinons une **marche-arrêt** : en appuyant sur Marcha (marche), un moteur démarre ; en appuyant sur Paro (arrêt), il s’arrête. Si vous préférez que l’éditeur vous guide, faites le tutoriel :

```tutorial primer-grafcet
```

## Pas à pas

1. **Étape initiale.** Dans la barre, « Étape initiale » (ou clic droit sur le canevas > « Étape initiale ici »). C’est l’étape 0 : la situation de repos.
2. **Transition.** Sélectionnez l’étape et cliquez sur le **+** qui apparaît dessous : une transition est ajoutée, déjà reliée.
3. **Réceptivité.** Double-cliquez sur la transition et écrivez `Marcha`. C’est la condition pour quitter le repos.
4. **Étape 1.** Sélectionnez la transition et cliquez sur son **+**.
5. **Action.** Double-clic sur l’étape 1 > « Ajouter une action » et écrivez `Motor` (ou le **+** à droite de l’étape).
6. **Retour au repos.** Ajoutez une transition sous l’étape 1 avec la réceptivité `Paro`. Clic droit dessus > « Reprise vers l’étape » et cliquez sur l’étape 0.
7. **Vérifier.** Le bouton passe au vert (✓) si tout respecte la norme.
8. **Simuler.** Cliquez sur Simuler, activez Marcha (clic ou touche 1) et regardez l’étape 1 s’activer et Motor s’allumer.

> **Attention :** les variables (Marcha, Paro, Motor) apparaissent seules dans la table des variables quand vous les écrivez. Vous y donnez leur adresse automate ; voir [Variables et adresses](variables).

## Et si le bouton d’arrêt est normalement fermé ?

Par sécurité, les boutons d’arrêt sont en général **NF** : au repos ils donnent 1 et quand on appuie, 0 (ainsi un fil coupé arrête aussi la machine). La réceptivité est alors `!Paro` (« Paro non actionné »), dessinée avec une barre au-dessus. L’exemple fait ainsi :

```ejemplo marcha-paro
```
