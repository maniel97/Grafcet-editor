# Ejercicios

Un **ejercicio** trae un enunciado y lo que el profesor da hecho (la planta, la tabla de variables, el esquema…). El grafcet lo dibujas tú, y el editor te dice si está bien.

## Para el alumnado

1. Abre el ejercicio: Abrir > Ejercicios, o el archivo que te haya dado el profesor.
2. Lee el enunciado en el panel **Ejercicio** (a la derecha; el botón de la barra lo abre y lo cierra).
3. Dibuja el grafcet. Puedes simularlo y verificarlo como siempre.
4. Pulsa **Comprobar** cuantas veces quieras. Cada comprobación sale en verde o en rojo, con lo que falla.

> **Ojo:** lo que el profesor da bloqueado (por ejemplo, la tabla de variables) no se puede cambiar: usa esos nombres en el grafcet. Si escribes uno que no está, la comprobación te lo señala como posible errata.

## Qué se comprueba

- Que hay un grafcet (etapa inicial y alguna transición).
- Que cumple la norma: Verificar sin errores.
- Con la tabla de variables dada, que solo usas sus variables.
- En los ejercicios con planta, que la máquina hace la secuencia pedida con el escenario de prueba del profesor.
- Con cada escenario de prueba, que la máquina responde como la del profesor: las salidas se encienden y se apagan en los mismos momentos (con un margen de tiempo) y llegan las mismas piezas. Si algo falla, **Verlo en la simulación** reproduce ese escenario para que veas dónde.

## Para el profesorado

1. Resuelve el ejercicio en el editor: esa es tu solución y no se reparte.
2. Prepara los escenarios de prueba: grábalos en la simulación (por ejemplo, pulsar Marcha y esperar un ciclo) o pulsa **Dibujar escenario** y arrastra en la fila de cada entrada para decidir cuándo se pulsa; debajo ves en vivo lo que hace tu grafcet.
3. Exportar > **Ejercicio para el alumnado**: escribe el enunciado, elige qué se da hecho (y si va bloqueado) y qué se comprueba. Pulsa **Probar**: con tu solución, todo debe salir en verde.
4. **Guardar y descargar para el alumnado** crea el archivo que se reparte, sin tu grafcet.

> **Ojo:** las comprobaciones viajan selladas en el archivo, pero no es un sistema de seguridad: el corrector se basa en el comportamiento, no en copiar tu grafcet.

```ejemplo cilindros
Un buen punto de partida para un ejercicio con planta.
```
