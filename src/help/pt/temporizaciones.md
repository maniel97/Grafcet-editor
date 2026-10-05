# Temporizações

Uma **temporização** é uma condição que se cumpre quando passou um certo tempo. Não é um aparelho que se acrescenta: **escreve-se** numa receptividade ou por cima de uma ação, e o editor cria sozinho o temporizador (e o do autómato, ao passar para ladder).

## A forma mais comum: esperar numa etapa

Para que uma etapa dure um certo tempo, escreve-se na transição de baixo:

```
5s/X2
```

Lê-se «**5 segundos desde que a etapa 2 se ativou**». Vale 0 quando a etapa 2 se ativa e passa a 1 quando está ativa há 5 s; então a transição é transposta.

Passo a passo:

1. Seleciona a etapa (por exemplo, a 2) e carrega no **+** de baixo: aparece uma transição.
2. Faz duplo clique na transição e escreve `5s/X2`. Em «Receptividades frequentes» há um botão que a escreve com a etapa de cima.
3. Carrega em **Simular**: quando a etapa 2 se ativar, a transição será transposta sozinha ao fim de 5 s.

> **Atenção:** o número depois do X é o da **etapa que se espera**, normalmente a de cima. Se escreveres `5s/X1` por baixo da etapa 2, conta desde que a 1 se ativou (Verificar avisa com um conselho).

```ejemplo semaforo
Um semáforo: cada luz, uma etapa com o seu tempo (10s/X0, 8s/X1, 3s/X2).
```

## Unidades

`ms` (milissegundos), `s` (segundos), `min` (minutos) e `h` (horas). Admitem-se decimais com ponto ou vírgula: `0.5s/X3`, `1,5s/X3`, `2min/X4`.

## Esperar que algo dure: atraso sobre uma variável

A temporização também se pode pôr sobre uma entrada ou qualquer variável, não só sobre uma etapa:

| Escreve-se | Vale 1… | Para quê |
|---|---|---|
| `3s/a` | quando `a` está a 1 há **3 s seguidos**. Se `a` cair antes, recomeça | filtrar: uma peça que só passa não conta, só uma que fica |
| `0s/a/2s` | quando `a` sobe, e continua a 1 **2 s depois** de `a` descer | prolongar: uma luz que fica acesa um pouco depois de largar o botão |
| `3s/a/2s` | 3 s depois de `a` subir, e desce 2 s depois de `a` descer | as duas coisas ao mesmo tempo |

A forma geral da norma é `t1/a/t2`: `t1` atrasa a subida e `t2` a descida.

```ejemplo apilador-trampilla
1s/Pila: o alçapão só abre se o detetor vir a pilha durante 1 s (uma caixa que cai corta o feixe um instante e não conta).
```

## Numa ação: ligar mais tarde, ou só durante um tempo

Uma **ação condicional** com uma temporização por cima (duplo clique na etapa, tipo de ação «Condicional», e a temporização na sua condição):

- **Atrasada** (`4s/X1` por cima de `Vibrador`): o vibrador liga 4 s depois de a etapa 1 se ativar, e continua até a etapa se desativar.
- **Limitada** (`!2s/X1` por cima de `Aviso`): o aviso só toca nos 2 primeiros segundos da etapa 1. O `!` quer dizer «não»: «enquanto **não** tiverem passado 2 s».

```ejemplo silo-vibrador
As duas na mesma etapa: o aviso toca 2 s ao começar a descarga e o vibrador arranca ao fim de 4 s.
```

## O que se vê ao simular

- No painel da direita, **Temporizações**: uma barra para cada uma, com o tempo decorrido e o total (`1.2 / 5 s`). A verde quando já se cumpriu; «etapa inativa» se ainda não começou.
- **O que o grafcet espera** diz quanto falta, por exemplo para 5s/X2: faltam 3,8 s.
- Para não esperar: **+1 s** adianta o tempo um segundo, e o seletor de **velocidade** (×2, ×5…) acelera tudo.

## Regras que convém saber

- O tempo **recomeça do zero** cada vez que a etapa se ativa (ou que a variável sobe). Se a etapa se desativar antes do tempo, a contagem perde-se.
- Uma temporização não é uma variável que tenhas de declarar: não é preciso acrescentá-la à tabela.
- Na **tabela de variáveis** aparecem em *Temporizadores* com o seu endereço (T1, T37…). O tempo vem do grafcet: para o mudar, muda a receptividade ou a ação.

## No autómato

Ao passar para ladder (botão **Ladder**), cada temporização diferente transforma-se num temporizador **TON** (atraso à ligação). As da forma `a/2s` (atraso ao desligar) usam também uma marca auxiliar. No S7-200 são temporizadores de 100 ms, a partir do T37; se um tempo for demasiado longo para o temporizador, a exportação avisa.

Ver também: [Contadores](contadores) · [Ações](acciones) · [Transições e receptividades](transiciones).

Para praticar passo a passo:

```tutorial temporizacion
```
