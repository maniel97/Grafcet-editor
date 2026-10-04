# Macroetapas

Quando um grafcet cresce, uma parte da sequência pode **resumir-se numa só etapa** e desenhar-se à parte. Essa etapa é uma **macroetapa**: um quadrado com um traço em cima e outro em baixo, numerado M1, M2…

## Porquê?

- O grafcet principal lê-se num relance: «dosear», «furar», «evacuar».
- O detalhe de cada parte está no seu sítio, sem se cruzar com o resto.
- Cada ideia (a *expansão*) pode ser revista e testada separadamente.

## Como funciona (IEC 60848)

A macroetapa M1 detalha-se na sua **expansão**: um pedaço de grafcet com uma **etapa de entrada E1** e uma **etapa de saída S1**.

1. Quando a transição anterior a M1 é transposta, ativa-se **E1**.
2. A expansão evolui como qualquer grafcet.
3. A transição posterior a M1 só fica validada quando **S1** está ativa. Ao transpô-la, S1 desativa-se.

> **Atenção:** segundo a norma, uma macroetapa não tem ações próprias (o que faz está na sua expansão) e não pode ser inicial; isto último verifica-o Verificar.

## Como se desenha

1. Clique direito numa etapa > «Converter em macroetapa».
2. Desenhe a expansão e enquadre-a numa moldura com o mesmo nome (M1): selecione as suas etapas e, com clique direito, «Enquadrar como expansão de macroetapa» (ou clique direito na tela > «Moldura de expansão aqui»).
3. Numere a sua etapa de entrada **E1** e a de saída **S1** (para M2, E2 e S2).

Verificar avisa se faltar à macroetapa a sua expansão, ou se faltar à expansão a etapa de entrada ou a de saída.

```ejemplo macroetapa
A dosagem, resumida em M1 e detalhada na sua expansão.
```
