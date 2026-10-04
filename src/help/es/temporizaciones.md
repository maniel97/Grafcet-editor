# Temporizaciones

En grafcet el tiempo se escribe como una **condición temporal** sobre una variable: `t1/variable/t2`.

## Las formas habituales

- `5s/X2`: vale 1 cuando han pasado 5 s desde que se activó la etapa 2. Es la espera típica: una transición con `5s/X2` bajo la etapa 2 espera 5 s y sigue.
- `3s/a`: vale 1 cuando `a` lleva 3 s a 1 (retardo a la conexión). Si `a` cae antes, vuelve a empezar.
- `3s/a/2s`: sube 3 s después de que `a` suba y baja 2 s después de que `a` baje.
- `0s/a/2s`: sigue a `a` al subir y la prolonga 2 s al bajar (retardo a la desconexión).

Las unidades admitidas son `ms`, `s`, `min` y `h`.

## En acciones

Una acción condicionada con una condición temporal se retrasa o se limita:

- `3s/X4` encima de `Bocina`: la bocina suena a partir de los 3 s de etapa 4.
- `!5s/X4` encima de `Bocina`: suena solo los 5 primeros segundos de la etapa 4.

> **Ojo:** el tiempo cuenta desde que la variable sube. Si la etapa se desactiva y se vuelve a activar, empieza de cero.

## En el autómata

El ladder usa un temporizador por cada condición temporal distinta (TON en S7-200 o IEC). Lo puedes ver con el botón Ladder.

```ejemplo semaforo
Un semáforo: solo tiempos.
```

Para practicarlo paso a paso:

```tutorial temporizacion
```
