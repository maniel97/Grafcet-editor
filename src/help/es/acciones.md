# Acciones

Las **acciones** dicen qué se hace mientras una etapa está activa. Se dibujan en rectángulos a la derecha de la etapa. Se añaden con el **+** a la derecha de la etapa, desde sus propiedades (doble clic) o con clic derecho > «Añadir acción».

## Tipos (IEC 60848)

- **Continua**: la salida vale 1 mientras la etapa está activa. Es la más habitual: `Motor`.
- **Condicionada**: además de la etapa, exige una condición, que se escribe sobre un trazo vertical encima de la acción. `Motor` con la condición `!Termico`.
- **Retardada o limitada**: una condicionada con tiempo. `3s/X2` encima: se enciende 3 s después de activarse la etapa.
- **Memorizada al activar** (flecha ↑): se ejecuta una vez, al activarse la etapa. `A:=1` pone A a 1 y la deja así hasta que otra acción la ponga a 0. También para contadores: `C:=C+1`.
- **Memorizada al desactivar** (flecha ↓): igual, al desactivarse la etapa.
- **Al evento**: se ejecuta en el instante de un evento mientras la etapa está activa, p. ej. `↑b`.

## ¿Continua o memorizada?

Con acciones **continuas** basta mirar las etapas activas para saber qué salidas están encendidas. Con **memorizadas**, no: hay que saber qué pasó antes. Por eso:

- Usa continuas siempre que puedas.
- Usa memorizadas cuando la salida deba durar varias etapas que no están seguidas, o para contadores y valores.
- Cada `A:=1` debe tener en algún sitio su `A:=0`; si no, la salida se queda a 1 para siempre.

> **Ojo:** si una salida aparece como continua en dos etapas, vale 1 si cualquiera de las dos está activa (es una O). Si además está memorizada en otra, las dos formas se pisan: Verificar lo señala con un consejo.

```ejemplo cilindros
Solo acciones continuas: cada etapa, un movimiento.
```

```ejemplo contador
Acciones memorizadas: C:=0 al empezar y C:=C+1 en cada vuelta.
```
