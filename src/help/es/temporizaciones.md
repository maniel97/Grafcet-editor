# Temporizaciones

Una **temporización** es una condición que se cumple cuando ha pasado un tiempo. No es un aparato que se añade: se **escribe** en una receptividad o encima de una acción, y el editor crea solo el temporizador (y el del autómata, al pasarlo a ladder).

## La forma más común: esperar en una etapa

Para que una etapa dure un tiempo, se escribe en la transición de debajo:

```
5s/X2
```

Se lee «**5 segundos desde que se activó la etapa 2**». Vale 0 al activarse la etapa 2 y pasa a 1 cuando lleva 5 s activa; entonces la transición se franquea.

Paso a paso:

1. Selecciona la etapa (por ejemplo, la 2) y pulsa el **+** de debajo: aparece una transición.
2. Doble clic en la transición y escribe `5s/X2`. En «Receptividades frecuentes» hay un botón que lo pone con la etapa de encima.
3. Pulsa **Simular**: cuando se active la etapa 2, la transición se franqueará sola a los 5 s.

> **Ojo:** el número de la X es el de la **etapa que se espera**, normalmente la de justo encima. Si escribes `5s/X1` debajo de la etapa 2, contará desde que se activó la 1 (Verificar avisa con un consejo).

```ejemplo semaforo
Un semáforo: cada luz, una etapa con su tiempo (10s/X0, 8s/X1, 3s/X2).
```

## Unidades

`ms` (milisegundos), `s` (segundos), `min` (minutos) y `h` (horas). Se admiten decimales con punto o coma: `0.5s/X3`, `1,5s/X3`, `2min/X4`.

## Esperar a que algo dure: retardo sobre una variable

La temporización también se puede poner sobre una entrada o cualquier variable, no solo sobre una etapa:

| Se escribe | Vale 1… | Para qué |
|---|---|---|
| `3s/a` | cuando `a` lleva **3 s seguidos** a 1. Si `a` cae antes, vuelve a empezar | filtrar: que una pieza que solo pasa no cuente, solo una que se queda |
| `0s/a/2s` | al subir `a`, y sigue a 1 **2 s después** de que `a` baje | prolongar: una luz que sigue encendida un poco tras soltar el pulsador |
| `3s/a/2s` | 3 s después de subir `a`, y baja 2 s después de bajar `a` | las dos cosas a la vez |

La forma general de la norma es `t1/a/t2`: `t1` retrasa la subida y `t2` la bajada.

```ejemplo apilador-trampilla
1s/Pila: la trampilla solo se abre si el detector ve la pila durante 1 s (una caja que cae lo corta un instante y no cuenta).
```

## En una acción: encender más tarde o solo un rato

Una **acción condicionada** con una temporización encima (doble clic en la etapa, tipo de acción «Condicionada», y la temporización en su condición):

- **Retardada** (`4s/X1` encima de `Vibrador`): el vibrador se enciende a los 4 s de activarse la etapa 1, y sigue hasta que la etapa se desactiva.
- **Limitada** (`!2s/X1` encima de `Aviso`): el aviso suena solo los 2 primeros segundos de la etapa 1. El `!` es «no»: «mientras **no** hayan pasado 2 s».

```ejemplo silo-vibrador
Las dos en la misma etapa: el aviso suena 2 s al empezar a descargar y el vibrador arranca a los 4 s.
```

## Cómo se ve al simular

- En el panel de la derecha, **Temporizaciones**: una barra por cada una, con el tiempo que lleva y el total (`1.2 / 5 s`). En verde cuando ya se ha cumplido; «etapa inactiva» si aún no ha empezado.
- **Qué espera el grafcet** dice cuánto falta: «falta 5s/X2: quedan 3,8 s».
- Para no esperar: **+1 s** adelanta el tiempo un segundo, y el selector de **velocidad** (×2, ×5…) lo acelera todo.

## Reglas que conviene saber

- El tiempo **empieza de cero** cada vez que la etapa se activa (o que la variable sube). Si la etapa se desactiva antes de tiempo, la cuenta se pierde.
- Una temporización no es una variable que tengas que declarar: no hace falta añadirla a la tabla.
- En la **tabla de variables** salen en *Temporizadores* con su dirección (T1, T37…). El tiempo sale del grafcet: para cambiarlo, cambia la receptividad o la acción.

## En el autómata

Al pasar a ladder (botón **Ladder**), cada temporización distinta se convierte en un temporizador **TON** (retardo a la conexión). Las de la forma `a/2s` (retardo a la bajada) usan además una marca auxiliar. En el S7-200 son temporizadores de 100 ms, desde T37; si un tiempo es demasiado largo para el temporizador, la exportación avisa.

Ver también: [Contadores](contadores) · [Acciones](acciones) · [Transiciones y receptividades](transiciones).

Para practicarlo paso a paso:

```tutorial temporizacion
```
