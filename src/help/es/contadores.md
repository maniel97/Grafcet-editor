# Contadores

En grafcet un **contador** es una variable que guarda un número (`C`, `Piezas`, `Plazas`…). No hay un bloque «contador» que añadir: se cuenta con **acciones memorizadas** que cambian su valor, y se comprueba con **comparaciones** en las receptividades.

## Las tres piezas

| Para… | Se escribe | Dónde |
|---|---|---|
| poner a cero | `C:=0` | acción **memorizada al activar** (↑) de la etapa donde empieza todo, normalmente la inicial |
| sumar uno | `C:=C+1` | acción **memorizada al activar** de la etapa que se activa una vez por cada cosa contada |
| comparar | `[C >= 3]` | receptividad de una transición (o condición de una acción) |

Comparaciones admitidas: `=`, `<>` (distinto), `<`, `<=`, `>`, `>=`. Los corchetes son la forma de la norma; también funciona sin ellos (`C >= 3`) y combinado: `↑P · [C < 3]`.

Cuando escribes `C:=…` en una acción nueva, el editor la pasa solo a **memorizada al activar**: una asignación como acción continua no haría nada (Verificar lo marca como error).

## Contar con un bucle (lo más claro)

Se cuenta **una vez por cada activación** de una etapa. Por ejemplo, encender una luz a la tercera pulsación de P:

```
Etapa 0 (inicial)   C:=0
  Marcha
Etapa 1             (espera una pulsación)
  ↑P · [C < 2]  → etapa 2          ↑P · [C >= 2] → etapa 3
Etapa 2             C:=C+1, y vuelve a la 1 (transición «1»)
Etapa 3             Luz
```

- `↑P` (flanco): cada pulsación cuenta **una vez**, aunque se mantenga apretado.
- Las dos transiciones bajo la etapa 1 son una **elección**: una vuelve a contar, la otra termina. Tienen que ser excluyentes (`< 2` y `>= 2`).
- La comparación mira el valor **antes** de la pulsación que llega: con 2 ya contadas, la tercera va a la luz.

```ejemplo contador
Este mismo grafcet, listo para simular.
```

## Contar sin cambiar de etapa: acción al evento

Si la máquina tiene que seguir en la misma etapa mientras cuenta, se usa una acción **al evento**: se ejecuta en el instante del evento, mientras la etapa está activa.

1. Doble clic en la etapa, **Añadir acción**, tipo «Al evento».
2. Texto: `C:=C+1`. En su condición (el evento): `↑P`.

Cada flanco de P suma uno mientras la etapa está activa. La salida de la etapa puede ser `[C >= 10]`.

## Contar hacia abajo

`C:=C-1` resta uno. Con las dos, un aparcamiento lleva las plazas ocupadas: `C:=C+1` al entrar un coche y `C:=C-1` al salir; `[C < 5]` deja entrar y `[C > 0]` deja salir.

```ejemplo aparcamiento
Plazas de un aparcamiento: sumar, restar, y los pilotos Libre / Completo como acciones condicionadas (C < 5, C >= 5).
```

Otras operaciones también valen: `N:=N+5`, `D:=A*2`, `M:=(A+B)/2`.

## Cómo se ve al simular

- En el panel de la derecha, **Marcas y contadores**, con su valor en cada momento.
- **Qué espera el grafcet** dice qué comparación falta y el valor actual: con `[C >= 3]` y C a 1, «C = 1».
- El **cronograma** muestra cuándo se activó cada etapa (y por tanto cuándo se contó).

## Errores típicos

- **Olvidar `C:=0`**: el contador empieza con lo que tuviera de la vez anterior. Ponlo en la etapa inicial (o en la que empieza cada ciclo).
- **Contar sin flanco** (`P` en vez de `↑P`): mientras P está apretado, la transición se cumple una y otra vez y cuenta de más.
- **Comparaciones que no son excluyentes** (`[C <= 3]` y `[C >= 3]`): con C a 3 se cumplen las dos. Verificar lo detecta en las divergencias en O.
- **Contar en una etapa que no se repite**: `C:=C+1` suma una vez **por activación**; si la etapa sigue activa, no vuelve a sumar (para eso, la acción al evento).

## En el autómata

El editor no usa los bloques contador del autómata (CTU, CTD): un contador es una **palabra** (`MW100` en S7-300/1200, `VW` en S7-200) y `C:=C+1` se convierte en una suma (`+I` en S7-200). Las comparaciones usan los comparadores de palabras. Así se traduce igual que en el grafcet cualquier operación (`+5`, `-1`, `*2`), no solo contar de uno en uno.

Ver también: [Acciones](acciones) (memorizadas y al evento) · [Bucles y saltos](bucles) · [Transiciones y receptividades](transiciones).
