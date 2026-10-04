# La planta virtual

La **planta virtual** es una maqueta animada de la máquina: pulsadores, cilindros, cintas, detectores, depósitos… Se mueve con las **salidas** del grafcet y activa sola las **entradas**: es como probar el programa en la máquina real, sin romper nada.

## Abrirla

Al simular se abre junto al grafcet, si el proyecto tiene planta; en el panel de simulación, **«Planta virtual»** la cierra y la vuelve a abrir. Arrastra la separación para repartir el ancho (doble clic: mitad y mitad).

## Usar y Editar

- **Usar**: se acciona como la máquina: pulsadores, interruptores, alimentadores de piezas. Las entradas que da la planta aparecen en el panel con la marca «planta».
- **Editar**: se colocan y configuran elementos. Arrástralos desde la paleta, gíralos con **R**, bórralos con **Supr**. En sus propiedades se elige la variable de cada uno (si no existe, se añade a la tabla).

«Conexiones» muestra qué está conectado y qué falta: entradas del grafcet que nadie da, salidas que no mueven nada.

## Diagrama espacio-fase

Mientras simulas, la sección **«Diagrama espacio-fase»** del panel dibuja lo que han hecho los cilindros: una fila por cilindro con sus posiciones 0 (dentro) y 1 (fuera) y una columna por fase, con cada movimiento en diagonal. Es el diagrama de los apuntes de neumática, pero de lo que hace **tu** programa: compáralo con el que pide el enunciado.

- **Fases** o **Tiempo**: el eje horizontal por fases (etapas) o en segundos (diagrama espacio-tiempo).
- Si al final todos vuelven a su posición inicial, la última fase se marca «5=1»: el ciclo se cierra.

## Más realismo

- **Gravedad**: vista de frente; las piezas caen, se apoyan en plataformas y en el vástago de los cilindros.
- **Relieve**: dibujo con volumen, solo de presentación.
- **Averías** (en Usar): un detector que no da señal, un cilindro que se atasca… para practicar el diagnóstico.
- **Panel de control**: los pulsadores y pilotos pueden ir en un pupitre aparte.
- **Mis grupos**: guarda una estación para reutilizarla en otros proyectos.

> **Ojo:** si algo no se mueve, mira primero «Conexiones» y después la sección «Qué espera el grafcet» del panel de simulación.

```ejemplo taladradora
Una taladradora con su planta.
```

```ejemplo cargador-gravedad
Con gravedad: las piezas caen del cargador.
```

Para probarla paso a paso:

```tutorial planta
```
