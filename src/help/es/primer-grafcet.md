# Tu primer grafcet

Vamos a dibujar un **marcha-paro**: al pulsar Marcha se enciende un motor; al pulsar Paro, se apaga. Si prefieres que te guíe el propio editor, haz el tutorial:

```tutorial primer-grafcet
```

## Paso a paso

1. **Etapa inicial.** En la barra, «Etapa inicial» (o clic derecho en el lienzo > «Etapa inicial aquí»). Es la etapa 0: la situación de reposo.
2. **Transición.** Selecciona la etapa y pulsa el **+** que aparece debajo: añade una transición ya enlazada.
3. **Receptividad.** Doble clic en la transición y escribe `Marcha`. Es la condición para salir del reposo.
4. **Etapa 1.** Selecciona la transición y pulsa su **+**.
5. **Acción.** Doble clic en la etapa 1 > «Añadir acción» y escribe `Motor` (o el **+** a la derecha de la etapa).
6. **Volver al reposo.** Añade una transición bajo la etapa 1 con la receptividad `Paro`. Clic derecho en ella > «Bucle a etapa» y pulsa la etapa 0.
7. **Verificar.** El botón se pone en verde (✓) si todo cumple la norma.
8. **Simular.** Pulsa Simular, activa Marcha (clic o tecla 1) y mira cómo la etapa 1 se activa y Motor se enciende.

> **Ojo:** las variables (Marcha, Paro, Motor) aparecen solas en la tabla de variables al escribirlas. Allí les das su dirección del autómata; ver [Variables y direcciones](variables).

## ¿Y si el paro es un pulsador normalmente cerrado?

Por seguridad, los pulsadores de paro suelen ser **NC**: en reposo dan 1 y al pulsarlos, 0 (así un cable roto también para). Entonces la receptividad es `!Paro` («Paro no activado»), con la raya encima. El ejemplo lo hace así:

```ejemplo marcha-paro
```
