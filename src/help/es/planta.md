# La planta virtual

La **planta virtual** es una maqueta animada de la máquina: pulsadores, cilindros, cintas, detectores, depósitos… Se mueve con las **salidas** del grafcet y activa sola las **entradas**: es como probar el programa en la máquina real, sin romper nada.

## Abrirla

Durante la simulación, en el panel de la derecha, **«Planta virtual»**. Se abre junto al grafcet; arrastra la separación para repartir el ancho (doble clic: mitad y mitad).

## Usar y Editar

- **Usar**: se acciona como la máquina: pulsadores, interruptores, alimentadores de piezas. Las entradas que da la planta aparecen en el panel con la marca «planta».
- **Editar**: se colocan y configuran elementos. Arrástralos desde la paleta, gíralos con **R**, bórralos con **Supr**. En sus propiedades se elige la variable de cada uno (si no existe, se añade a la tabla).

«Conexiones» muestra qué está conectado y qué falta: entradas del grafcet que nadie da, salidas que no mueven nada.

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
