# Contadores

Em grafcet, um **contador** é uma variável que guarda um número (`C`, `Piezas`, `Plazas`…). Não há um bloco «contador» para acrescentar: conta-se com **ações memorizadas** que mudam o seu valor, e verifica-se com **comparações** nas receptividades.

## As três peças

| Para… | Escreve-se | Onde |
|---|---|---|
| pôr a zero | `C:=0` | ação **memorizada na ativação** (↑) da etapa onde tudo começa, normalmente a inicial |
| somar um | `C:=C+1` | ação **memorizada na ativação** da etapa que se ativa uma vez por cada coisa contada |
| comparar | `[C >= 3]` | receptividade de uma transição (ou condição de uma ação) |

Comparações admitidas: `=`, `<>` (diferente), `<`, `<=`, `>`, `>=`. Os parênteses retos são a forma da norma; também funciona sem eles (`C >= 3`) e combinado: `↑P · [C < 3]`.

Quando escreves `C:=…` numa ação nova, o editor passa-a sozinho a **memorizada na ativação**: uma atribuição como ação contínua não faria nada (Verificar marca-a como erro).

## Contar com um ciclo (o mais claro)

Conta-se **uma vez por cada ativação** de uma etapa. Por exemplo, acender uma luz à terceira pressão de P:

```
Etapa 0 (inicial)   C:=0
  Marcha
Etapa 1             (espera uma pressão)
  ↑P · [C < 2]  → etapa 2          ↑P · [C >= 2] → etapa 3
Etapa 2             C:=C+1, e volta à 1 (transição «1»)
Etapa 3             Luz
```

- `↑P` (flanco): cada pressão conta **uma vez**, mesmo que se mantenha o botão carregado.
- As duas transições por baixo da etapa 1 são uma **escolha**: uma volta a contar, a outra termina. Têm de ser exclusivas (`< 2` e `>= 2`).
- A comparação olha para o valor **antes** da pressão que chega: com 2 já contadas, a terceira vai para a luz.

```ejemplo contador
Este mesmo grafcet, pronto a simular.
```

## Contar sem mudar de etapa: ação no evento

Se a máquina tem de continuar na mesma etapa enquanto conta, usa-se uma ação **no evento**: executa-se no instante do evento, enquanto a etapa está ativa.

1. Duplo clique na etapa, **Adicionar ação**, tipo «No evento».
2. Texto: `C:=C+1`. Na sua condição (o evento): `↑P`.

Cada flanco de P soma um enquanto a etapa está ativa. A saída da etapa pode ser `[C >= 10]`.

## Contar para baixo

`C:=C-1` subtrai um. Com as duas, um parque de estacionamento conta os lugares ocupados: `C:=C+1` quando entra um carro e `C:=C-1` quando sai; `[C < 5]` deixa entrar e `[C > 0]` deixa sair.

```ejemplo aparcamiento
Lugares de um parque: somar, subtrair, e as luzes Libre / Completo como ações condicionais (C < 5, C >= 5).
```

Outras operações também funcionam: `N:=N+5`, `D:=A*2`, `M:=(A+B)/2`.

## O que se vê ao simular

- No painel da direita, **Marcas e contadores**, com o seu valor em cada momento.
- **O que o grafcet espera** diz que comparação falta e o valor atual: com `[C >= 3]` e C a 1, «C = 1».
- O **cronograma** mostra quando cada etapa se ativou (e, portanto, quando se contou).

## Erros típicos

- **Esquecer `C:=0`**: o contador começa com o que tinha da vez anterior. Põe-no na etapa inicial (ou naquela onde começa cada ciclo).
- **Contar sem flanco** (`P` em vez de `↑P`): enquanto P está carregado, a transição cumpre-se uma e outra vez e conta a mais.
- **Comparações que não são exclusivas** (`[C <= 3]` e `[C >= 3]`): com C a 3 cumprem-se as duas. Verificar deteta-o nas divergências em OU.
- **Contar numa etapa que não se repete**: `C:=C+1` soma uma vez **por ativação**; se a etapa continua ativa, não volta a somar (para isso, a ação no evento).

## No autómato

O editor não usa os blocos contadores do autómato (CTU, CTD): um contador é uma **palavra** (`MW100` em S7-300/1200, `VW` em S7-200) e `C:=C+1` transforma-se numa soma (`+I` em S7-200). As comparações usam os comparadores de palavras. Assim, qualquer operação traduz-se tal como no grafcet (`+5`, `-1`, `*2`), não só contar de um em um.

Ver também: [Ações](acciones) (memorizadas e no evento) · [Ciclos e saltos](bucles) · [Transições e receptividades](transiciones).
