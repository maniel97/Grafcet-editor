# La planta virtual

La **planta virtual** es una maqueta animada de la máquina: pulsadores, cilindros, cintas, detectores, depósitos… Se mueve con las **salidas** del grafcet y activa sola las **entradas**: es como probar el programa en la máquina real, sin romper nada.

## Abrirla

Al simular se abre junto al grafcet, si el proyecto tiene planta; en el panel de simulación, **«Planta virtual»** la cierra y la vuelve a abrir. Arrastra la separación para repartir el ancho (doble clic: mitad y mitad).

## Usar y Editar

- **Usar**: se acciona como la máquina: pulsadores, interruptores, alimentadores de piezas. Las entradas que da la planta aparecen en el panel con la marca «planta». Los potenciómetros se ajustan con la rueda del ratón (con Mayús, más fino), con las flechas del teclado o, en pantalla táctil, arrastrando el dedo despacio.
- **Editar**: se colocan y configuran elementos. Pulsa uno de la paleta y ponlo con un clic donde quieras (arrastrando, pones una fila; doble clic en la paleta lo pone en un hueco libre), o arrástralo desde la paleta; gíralos con **R**, bórralos con **Supr**. En sus propiedades se elige la variable de cada uno (si no existe, se añade a la tabla). Las medidas (largo de una cinta, carrera de un cilindro, tamaño de una imagen…) se cambian arrastrando los cuadraditos del elemento seleccionado; en pantalla táctil o pizarra digital, dos dedos hacen zoom y desplazan.

«Conexiones» muestra qué está conectado y qué falta: entradas del grafcet que nadie da, salidas que no mueven nada.

## Diagrama espacio-fase

Mientras simulas, la sección **«Diagrama espacio-fase»** del panel dibuja lo que han hecho los cilindros: una fila por cilindro con sus posiciones 0 (dentro) y 1 (fuera) y una columna por fase, con cada movimiento en diagonal. Es el diagrama de los apuntes de neumática, pero de lo que hace **tu** programa: compáralo con el que pide el enunciado.

- **Fases** o **Tiempo**: el eje horizontal por fases (etapas) o en segundos (diagrama espacio-tiempo).
- Si al final todos vuelven a su posición inicial, la última fase se marca «5=1»: el ciclo se cierra.
- **Secuencia esperada** (p. ej. `A+ B+ B− A−`; el generador neumático la deja puesta): su diagrama se dibuja en gris debajo y se comprueba si coincide; si no, dice en qué fase está la diferencia. También sale en el dossier, con el escenario de prueba.
- **Líneas de señal**: en cada cambio de fase, el final de carrera que da paso al movimiento siguiente (`a1`, `b1`…).

## Más realismo

- **Gravedad**: vista de frente; las piezas caen, se apoyan en plataformas y en el vástago de los cilindros.
- **Relieve**: dibujo con volumen, solo de presentación.
- **Isométrica** (en la vista desde arriba): la planta apoyada en el suelo, en perspectiva, y cada elemento con su altura: las cintas como mesas, las piezas como cubos encima, los detectores en un poste. Solo cambia el dibujo: se simula y se edita igual (arrastrar, poner, girar).
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

```ejemplo clasificacion-frente
Con gravedad: cada pieza cae sobre la cinta y, por un extremo u otro, a su recogida.
```

Para probarla paso a paso:

```tutorial planta
```
