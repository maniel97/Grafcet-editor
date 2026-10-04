# Temporizações

Em grafcet o tempo escreve-se como uma **condição temporal** sobre uma variável: `t1/variable/t2`.

## As formas habituais

- `5s/X2`: vale 1 quando passaram 5 s desde que a etapa 2 se ativou. É a espera típica: uma transição com `5s/X2` por baixo da etapa 2 espera 5 s e segue.
- `3s/a`: vale 1 quando `a` está a 1 há 3 s (atraso na ligação). Se `a` cair antes, recomeça.
- `3s/a/2s`: sobe 3 s depois de `a` subir e desce 2 s depois de `a` descer.
- `0s/a/2s`: segue `a` ao subir e prolonga-a 2 s ao descer (atraso no desligar).

As unidades admitidas são `ms`, `s`, `min` e `h`.

## Nas ações

Uma ação condicionada com uma condição temporal fica atrasada ou limitada:

- `3s/X4` por cima de `Bocina` (buzina): a buzina toca a partir dos 3 s da etapa 4.
- `!5s/X4` por cima de `Bocina`: toca só durante os 5 primeiros segundos da etapa 4.

> **Atenção:** o tempo conta desde que a variável sobe. Se a etapa se desativar e voltar a ativar, começa do zero.

## No autómato

O ladder usa um temporizador por cada condição temporal diferente (TON no S7-200 ou IEC). Pode vê-lo com o botão Ladder.

```ejemplo semaforo
Um semáforo: só tempos.
```

Para o praticar passo a passo:

```tutorial temporizacion
```
