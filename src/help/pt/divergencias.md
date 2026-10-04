# Escolher e fazer ao mesmo tempo (OU e E)

Um grafcet não tem de ser uma linha reta. Há duas formas de abrir caminhos.

## Divergência em OU: escolher um caminho

Uma etapa seguida de **várias transições**: segue-se o caminho cuja receptividade se cumprir. Desenha-se com uma **linha simples** horizontal.

- Clique direito numa transição > «Adicionar alternativa (OU)».
- Os caminhos juntam-se com uma **convergência em OU**: selecione as últimas transições de cada caminho e, com clique direito, «Convergir … transições em OU».

> **Atenção:** as receptividades de uma divergência em OU devem ser **exclusivas**: se duas se cumprirem ao mesmo tempo, ativar-se-iam os dois caminhos. Use `a · !b` e `b` em vez de `a` e `b`. Verificar comprova-o.

## Divergência em E: fazer várias coisas ao mesmo tempo

Uma transição seguida de **várias etapas**: ao transpô-la ativam-se todas e cada ramo evolui por sua conta. Desenha-se com uma **linha dupla**.

- Clique direito na transição > «Divergência em E (2 ramos)» (e «Adicionar ramo em E» para mais).
- Os ramos juntam-se com uma **convergência em E**: selecione as últimas etapas de cada ramo e, com clique direito, «Convergir … etapas em E». A transição seguinte só é transposta quando **todas** essas etapas estão ativas: é uma sincronização.

> **Atenção:** costuma ser precisa uma etapa de espera (sem ações) no fim de cada ramo, para que o ramo rápido espere pelo lento.

## Não misturar

Um OU fecha-se com um OU, e um E com um E. Se uma divergência em E se fechar com uma convergência em OU, ficam etapas ativas soltas e o grafcet acaba com mais etapas ativas do que devia: comprove-o simulando.

```ejemplo clasificadora
Divergência em OU: cada peça vai para o seu sítio.
```

```ejemplo mezcladora
Divergência em E: dois depósitos ao mesmo tempo.
```

Para praticar o OU e a exclusividade passo a passo:

```tutorial divergencia-o
```
