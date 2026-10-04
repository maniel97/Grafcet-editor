# GEMMA: modos de marcha y parada

La **guía GEMMA** (*Guide d'Étude des Modes de Marches et d'Arrêts*) es una plantilla para no olvidar ninguna situación de una máquina real: no solo producir, también parar, arrancar, ir a la posición inicial o reaccionar ante un fallo.

## Los tres grupos de estados

- **A — Procedimientos de parada**: A1 parada en el estado inicial, A2 parada pedida a fin de ciclo, A6 puesta en el estado inicial…
- **F — Procedimientos de funcionamiento**: F1 producción normal, F2–F3 marchas de preparación y de cierre, F4–F6 marchas de verificación y prueba.
- **D — Procedimientos en defecto**: D1 parada de emergencia, D2 diagnóstico, D3 producción a pesar del defecto.

Cada máquina usa solo algunos. El GEMMA se rellena marcando los que se usan y las condiciones para pasar de uno a otro.

## Del GEMMA al grafcet

El resultado es un **grafcet de conducción**: una etapa por estado GEMMA, y en cada una la **orden de forzado** que impone al grafcet de producción (ver [Grafcets parciales y forzado](grafcets-parciales)). Por ejemplo:

- D1 (emergencia): `F/G1{}` — producción parada.
- A6 (puesta en estado inicial): `F/G1{INIT}`.
- F1 (producción normal): sin forzado, la producción evoluciona.

## El asistente

1. Encierra el grafcet de producción en un grafcet parcial (G1).
2. Botón **GEMMA** de la barra: marca los estados que usas, añade las transiciones entre ellos con su condición y escribe la orden de forzado de cada estado. «Cargar el ejemplo típico» rellena un caso habitual para empezar.
3. «Generar grafcet de conducción» lo dibuja en la hoja GEMMA, en un marco GC.

> **Ojo:** el GEMMA no sustituye a la seguridad cableada. La seta de emergencia corta la potencia por hardware; el GEMMA decide cómo se comporta el programa antes y después.

```ejemplo gemma-linea
Marcha, paro a fin de ciclo, emergencia con defecto y rearme a la posición inicial.
```
