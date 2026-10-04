# Macroetapas

Cuando un grafcet crece, una parte de la secuencia se puede **resumir en una sola etapa** y dibujar aparte. Esa etapa es una **macroetapa**: un cuadrado con un trazo arriba y otro abajo, numerado M1, M2…

## ¿Por qué?

- El grafcet principal se lee de un vistazo: «dosificar», «taladrar», «evacuar».
- El detalle de cada parte está en su sitio, sin cruzarse con lo demás.
- Una misma idea (la *expansión*) se puede revisar y probar por separado.

## Cómo funciona (IEC 60848)

La macroetapa M1 se detalla en su **expansión**: un trozo de grafcet con una **etapa de entrada E1** y una **etapa de salida S1**.

1. Cuando se franquea la transición anterior a M1, se activa **E1**.
2. La expansión evoluciona como cualquier grafcet.
3. La transición posterior a M1 solo está validada cuando **S1** está activa. Al franquearla, S1 se desactiva.

> **Ojo:** según la norma, una macroetapa no tiene acciones propias (lo que hace está en su expansión) y no puede ser inicial; esto último lo comprueba Verificar.

## Cómo se dibuja

1. Clic derecho en una etapa > «Convertir en macroetapa».
2. Dibuja la expansión y enciérrala en un marco con el mismo nombre (M1): selecciona sus etapas y, con clic derecho, «Encerrar como expansión de macroetapa» (o clic derecho en el lienzo > «Marco de expansión aquí»).
3. Numera su etapa de entrada **E1** y la de salida **S1** (para M2, E2 y S2).

Verificar avisa si a la macroetapa le falta su expansión, o si a la expansión le falta la etapa de entrada o la de salida.

```ejemplo macroetapa
La dosificación, resumida en M1 y detallada en su expansión.
```
