# ¿Qué es un grafcet?

Un **grafcet** describe, con un dibujo normalizado, cómo se comporta un automatismo: qué hace la máquina en cada momento y qué tiene que pasar para cambiar de una situación a la siguiente. Lo define la norma **IEC 60848** (en España, UNE-EN 60848).

## ¿Por qué un grafcet y no directamente el programa?

- **Se entiende sin saber programar.** El mecánico, el electricista y el programador leen lo mismo.
- **Separa el qué del cómo.** Primero se piensa la secuencia; después se traduce a ladder, ST o AWL para el autómata que toque. Este editor hace esa traducción.
- **Evita olvidos.** Cada situación es una etapa y cada cambio, una transición con su condición: si falta algo, se ve (y Verificar lo señala).

## Las piezas

- **Etapas** (cuadrados): las situaciones en las que puede estar el sistema. Las activas marcan dónde está. Ver [Etapas](etapas).
- **Transiciones** (trazos horizontales): el paso de unas etapas a otras, con su **receptividad**, la condición que lo permite. Ver [Transiciones](transiciones).
- **Acciones** (rectángulos a la derecha de la etapa): lo que se hace mientras la etapa está activa. Ver [Acciones](acciones).
- **Enlaces**: unen etapas y transiciones, que siempre se alternan. Se leen de arriba abajo; los que suben llevan flecha.

## Cómo evoluciona

1. Al arrancar se activan las **etapas iniciales** (doble cuadrado).
2. Una transición está **validada** cuando todas sus etapas anteriores están activas.
3. Si además su receptividad es verdadera, se **franquea**: se desactivan las etapas anteriores y se activan las siguientes, a la vez.
4. Las transiciones que pueden franquearse al mismo tiempo se franquean a la vez.

> **Ojo:** una transición validada con la receptividad falsa espera. El grafcet no «salta» etapas: siempre hay una transición en medio.

```ejemplo marcha-paro
El grafcet más sencillo: dos etapas, dos transiciones. Ábrelo y pulsa Simular.
```

Para dibujar el tuyo paso a paso:

```tutorial primer-grafcet
```
