# Grafcets parciales y forzado

Un automatismo real tiene varias partes que funcionan a la vez: la producción, la seguridad, los modos de marcha… Cada una se dibuja como un **grafcet parcial** (G1, G2…) y unas pueden **mandar** sobre otras.

## Grafcets parciales

Selecciona las etapas y transiciones de una parte y, con clic derecho, «Encerrar en un grafcet parcial»: se dibujan dentro de un marco G1. Todos los grafcets parciales evolucionan a la vez, y cada uno puede leer las etapas de los otros (`X12` en una receptividad).

## Forzado

Una **orden de forzado** es una acción que impone una situación a otro grafcet parcial mientras dure la etapa que la tiene:

| Orden | Efecto sobre G2 |
|---|---|
| `F/G2{3}` | solo la etapa 3 activa |
| `F/G2{3, 5}` | solo las etapas 3 y 5 activas |
| `F/G2{}` | ninguna etapa activa (vacío) |
| `F/G2{*}` | congelado: se queda como esté |
| `F/G2{INIT}` | en su situación inicial |

Mientras está forzado, **G2 no evoluciona**: sus transiciones no se franquean. Al acabar el forzado, sigue desde la situación impuesta.

> **Ojo:** el forzado es una jerarquía. El grafcet que fuerza (seguridad, modos de marcha) está *por encima* del forzado (producción). Un grafcet no puede forzarse a sí mismo, y Verificar avisa si se fuerza un grafcet que no existe o una etapa que no es suya.

## El caso típico: la emergencia

- G1 (seguridad) está en reposo mientras no hay emergencia.
- Con la emergencia, G1 pasa a una etapa con `F/G2{}`: la producción se para en seco.
- Tras el rearme, una etapa con `F/G2{INIT}` deja la producción en su situación inicial, lista para empezar.

```ejemplo emergencia
La seguridad G1 fuerza a la producción G2 a parar y a reiniciarse.
```

Para organizar los modos de marcha y parada de forma sistemática, ver [GEMMA](gemma).
