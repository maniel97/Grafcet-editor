# Variables y direcciones

Las **variables** son los nombres que usas en receptividades y acciones: `Marcha`, `Motor`, `C`… Aparecen solas en la **tabla de variables** al escribirlas, clasificadas en entradas, salidas, internas, contadores y analógicas.

## La tabla

- Botón **Variables** de la barra: la tabla completa. También se puede poner en el lienzo (clic derecho > «Tabla de variables aquí»), para que salga en la impresión.
- Cada variable tiene **dirección** del autómata (`I0.0`, `Q0.1`, `M0.0`…) y **comentario**.
- «Rellenar vacías» (en la tabla completa; en la del lienzo, clic derecho > «Rellenar direcciones vacías») asigna direcciones a las que no tienen, según el formato elegido: **S7-200**, **S7-300/1200** o **IEC 61131-3** (`%I0.0`).
- Arrastra una variable a otra sección para cambiar su tipo.

## Cambiar un nombre

Escribe el nombre nuevo en la tabla: cambia en todas las receptividades y acciones, en la planta y en el esquema, y **conserva** su dirección y su comentario.

## Variables de etapa

`X2` es la etapa 2. En la tabla puedes elegir que el ladder, el ST, el AWL y la simulación la llamen `E2` (costumbre en algunos centros); en el grafcet se sigue escribiendo `X2`, como manda la norma.

## Analógicas

Una entrada comparada con un número (`[Temperatura > 60]`) es analógica. En la tabla eliges su señal (4–20 mA o 0–10 V) y su rango físico; el ladder la escala y la simulación usa un deslizador en esas unidades.

> **Ojo:** el nombre de una variable no puede tener espacios ni empezar por número. Usa `PiezaArriba` o `pieza_arriba`.
