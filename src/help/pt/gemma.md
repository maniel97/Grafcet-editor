# GEMMA: modos de marcha e paragem

O **guia GEMMA** (*Guide d'Étude des Modes de Marches et d'Arrêts*) é um modelo para não esquecer nenhuma situação de uma máquina real: não só produzir, mas também parar, arrancar, ir para a posição inicial ou reagir a uma falha.

## Os três grupos de estados

- **A — Procedimentos de paragem**: A1 paragem no estado inicial, A2 paragem pedida no fim do ciclo, A6 colocação no estado inicial…
- **F — Procedimentos de funcionamento**: F1 produção normal, F2–F3 marchas de preparação e de fecho, F4–F6 marchas de verificação e ensaio.
- **D — Procedimentos em falha**: D1 paragem de emergência, D2 diagnóstico, D3 produção apesar da falha.

Cada máquina usa só alguns. O GEMMA preenche-se marcando os que se usam e as condições para passar de um a outro.

## Do GEMMA ao grafcet

O resultado é um **grafcet de condução**: uma etapa por estado GEMMA, e em cada uma a **ordem de forçagem** que impõe ao grafcet de produção (ver [Grafcets parciais e forçagem](grafcets-parciales)). Por exemplo:

- D1 (emergência): `F/G1{}` — produção parada.
- A6 (colocação no estado inicial): `F/G1{INIT}`.
- F1 (produção normal): sem forçagem, a produção evolui.

## O assistente

1. Enquadre o grafcet de produção num grafcet parcial (G1).
2. Botão **GEMMA** da barra: marque os estados que usa, acrescente as transições entre eles com a sua condição e escreva a ordem de forçagem de cada estado. «Carregar o exemplo típico» preenche um caso habitual para começar.
3. «Gerar o grafcet de condução» desenha-o na folha GEMMA, numa moldura GC.

> **Atenção:** o GEMMA não substitui a segurança cablada. O botão de emergência corta a potência por hardware; o GEMMA decide como o programa se comporta antes e depois.

```ejemplo gemma-linea
Marcha, paragem no fim do ciclo, emergência com falha e rearme para a posição inicial.
```
