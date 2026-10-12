# Del grafcet al autómata

El botón **Ladder** traduce el grafcet a programa de autómata, en varios lenguajes:

- **Ladder** (contactos), para ver e imprimir.
- **ST** (texto estructurado IEC 61131-3) y **SCL** de TIA Portal.
- **AWL / STL** para S7-300 y S7-200, listo para importar.

## El método

Es el método clásico de **una marca por etapa con SET y RESET**, el que se enseña en clase. El programa se ordena en apartados:

1. **Inicialización**: en el primer ciclo se activan las etapas iniciales y se desactivan las demás.
2. **Condiciones de franqueo**: una marca por transición = etapas anteriores activas · receptividad.
3. **Desactivación** de las etapas anteriores y **activación** de las siguientes (RESET y SET).
4. **Temporizaciones** y **contadores**.
5. **Acciones**: memorizadas con SET/RESET; continuas, una bobina por salida con la O de sus etapas.

Calcular primero todas las transiciones y después activar y desactivar hace que las que se pueden franquear a la vez se franqueen a la vez, como dice la norma.

> **Ojo:** las salidas se escriben una sola vez, al final. Si una salida aparece en varias etapas, su bobina lleva la O de todas: no pongas dos bobinas a la misma salida.

## Llevarlo al autómata

- **STEP 7-Micro/WIN (S7-200)**: descarga el `.awl` e impórtalo con Archivo > Importar. La tabla de símbolos se copia y se pega.
- **TIA Portal**: copia el SCL en una fuente externa o en un bloque SCL.
- **Otros (CODESYS, etc.)**: el ST es estándar.

Clic derecho en una etapa o transición > «Ver en el ladder» lleva a los segmentos que genera.

El ladder se abre en un **panel junto al grafcet**, como la planta y el esquema eléctrico: arrastra su borde izquierdo para cambiar el ancho (doble clic: reparto igual) o pásalo a pantalla completa con su botón. Mientras simulas se ve **en vivo** (contactos cerrados y salidas activas en verde) a la vez que el grafcet y la planta. Clic en un segmento: lo resalta en el grafcet, sin cerrar el ladder. Con dos o más paneles abiertos, el botón **Apilar** de su cabecera los pone en una columna, uno encima de otro (por ejemplo, la planta arriba y el ladder abajo, con el grafcet a la izquierda); arrastra el borde entre ellos para repartir el alto. Doble clic en la cabecera de un panel: pantalla completa o vuelta. En pantallas estrechas (tabletas, móviles), los paneles van en **pestañas** encima de la zona de trabajo (Grafcet, Planta, Esquema eléctrico, Ladder): se ve uno cada vez, ocupando todo el sitio.

```ejemplo taladradora
Ábrelo y pulsa Ladder.
```
