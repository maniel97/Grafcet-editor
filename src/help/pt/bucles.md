# Retornos e saltos

Quase todos os grafcets são cíclicos: ao acabar, voltam à etapa de repouso. E às vezes é preciso saltar etapas ou repeti-las.

## Recomeçar

Clique direito na última transição > «Retorno à etapa» e clique na etapa de destino (normalmente a inicial). A ligação sobe **pela esquerda e com seta**: a norma lê as ligações de cima para baixo, e as que sobem devem levar seta.

## Repetir (ciclo)

Uma divergência em OU em que um dos caminhos sobe para uma etapa anterior: «enquanto não acabar, repete».

- Por baixo da etapa, uma transição `[C < 3]` que volta acima e outra `[C >= 3]` que segue.
- O contador gere-se com ações memorizadas: `C:=0` antes do ciclo e `C:=C+1` dentro dele.

## Saltar etapas

O mesmo para baixo: uma alternativa em OU que desce diretamente para uma etapa posterior.

## Ligações longas

Se uma ligação atravessa meio desenho, clique direito sobre ela > «Cortar com referências»: desenha-se como uma seta com «para a etapa 0» na origem e «de …» no destino. Continua a ser a mesma ligação.

> **Atenção:** de uma transição sai ou um retorno ou etapas por baixo, não as duas coisas: ativar-se-iam ambas ao mesmo tempo. O menu só oferece o que faz sentido.

```ejemplo contador
Um ciclo que se repete até o contador chegar ao seu valor.
```
