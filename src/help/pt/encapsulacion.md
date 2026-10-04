# Encapsulamento

O **encapsulamento** (IEC 60848) é outra forma de estruturar: uma etapa **contém** um grafcet inteiro, que só vive enquanto ela está ativa.

## Como funciona

- A **etapa encapsulante** desenha-se com os cantos cortados.
- O seu **grafcet encapsulado** vai numa moldura com o seu nome.
- Ao ativar-se a encapsulante, ativam-se as etapas do encapsulado marcadas com a **ligação de ativação** (um asterisco *).
- Enquanto está ativa, o encapsulado evolui por sua conta.
- Ao desativar-se, **tudo o que está encapsulado se desativa**, esteja onde estiver.

## Macroetapa ou encapsulamento?

- A **macroetapa** é um pedaço de sequência: entra-se por E1 e é preciso chegar a S1 para continuar.
- O **encapsulamento** é uma atividade que dura o que dura a sua etapa: o grafcet de fora pode seguir em qualquer momento e o de dentro é interrompido. É o natural para «enquanto estiveres em marcha, faz isto» ou para a vigilância de uma fase.

## Como se desenha

1. Clique direito numa etapa > «Converter em etapa encapsulante»: cria também a sua moldura.
2. Desenhe o grafcet encapsulado dentro da moldura.
3. Clique direito na etapa pela qual deve começar > «Ligação de ativação (*)».

> **Atenção:** se uma etapa encapsulada for inicial, a encapsulante também tem de o ser. E nenhuma ligação pode atravessar a moldura: as etapas de dentro só se ativam pela ligação de ativação. Verificar comprova as duas coisas.

```ejemplo encapsulacion
Uma etapa encapsulante com o seu grafcet encapsulado.
```
