# Formato `.sim` de PC_SIMU

PC_SIMU es un simulador de plantas para autómatas muy usado en FP: dibuja un panel o una máquina y la
conecta a un S7-200 simulado (o a uno real). El editor exporta la planta virtual a este formato
(`src/lib/pcsimu.js`).

Lo que sigue se ha sacado del propio `PC_SIMU.exe` (versión de 2020, compilada en modo depuración con
Visual C++ 6), para que los archivos sean compatibles: el guardado, la carga, el cuadro de propiedades
de cada objeto y lo que hace la simulación con cada campo. Se ha comprobado con los 51 `.sim` de ejemplo
que trae el programa (se leen y se vuelven a escribir idénticos) y en PC_SIMU con archivos de prueba.
No se ha copiado código ni imágenes del programa.

## El archivo

Texto en Windows-1252, en una sola línea:

```
PC_SIMU*  1* 50*<objeto>**<objeto>** … **<objeto>*$$$
```

- La cabecera la escribe un `sprintf("PC_SIMU*%3d*%3d")`.
- Detrás de `$$$` puede haber basura (restos del búfer): se ignora.
- Un archivo sin objetos es `PC_SIMU*  1* 50*$$$`.

Cada objeto:

```
n*tipo#nombre*x1*y1*x2*y2*f4*f5*f6*f7*f8*f9*f10*f11*f12*f13*f14*f15*f16*f17#texto#texto2#grupo*a*b
```

| Campo | Qué es |
|---|---|
| `n` | número del objeto (puede haber huecos en archivos reales) |
| `tipo` | tipo de objeto (tabla de abajo) |
| `nombre` | nombre que se ve en su cuadro de propiedades |
| `x1 y1 x2 y2` | rectángulo en la pantalla, en píxeles |
| `f4` … `f17` | 14 enteros; su sentido depende del tipo |
| `texto`, `texto2`, `grupo` | cadenas (rótulos, imágenes, grupo) |
| `a`, `b` | dos enteros más (`a`: «mantener relación de aspecto» en pulsadores y leds) |

En memoria, PC_SIMU guarda cada campo en una tabla de 100 enteros (un objeto por posición): como mucho
100 objetos por archivo. Ningún campo puede llevar `*`, `#` ni `$`.

## Tipos

| Tipo | Objeto | | Tipo | Objeto |
|---|---|---|---|---|
| 1 | Interruptor | | 16 | Barra |
| 2 | Pulsador | | 17 | Potenciómetro |
| 3 | Selector | | 18 | Motor |
| 4 | Teclado | | 19 | Actuadores (neumático, sin vástago, lineal eléctrico, giro, herramienta, perfil, ventosa, salidas) |
| 5 | Preselector | | 20 | Cinta |
| 6 | Final de carrera | | 21 | Puerta (abrir / cerrar) |
| 7 | Detector | | 22 | Depósito |
| 8 | Barrera emisor-receptor | | 23 | Válvula |
| 9 | Barrera réflex | | 24 | Tubería |
| 11 | Led | | 25 | Objeto (pieza) |
| 12 | Display | | 26 | Tope |
| 13 | Texto | | 27 | Ascensor |
| 14 | Imagen de entrada | | 29 | Baliza |
| 15 | Sonido | | 30 | Motor paso a paso |
| 1001–1006 | dibujo (línea, rectángulo, elipse…) | | 1008 | texto suelto |

## Campos de los tipos que exporta el editor

En todos, la dirección es de bit: **`f5` = byte y `f7` = bit** (`I f5.f7` en las entradas, `Q f5.f7` en
las salidas). **`f4` vale 1 en las salidas y 0 en las entradas**; en los finales de carrera, detectores
y barreras, `f4` es además «está pulsado» mientras se simula, así que en el archivo va a 0.

### 2 · Pulsador

| Campo | Valores |
|---|---|
| `f9` | 0 normalmente abierto (NA), 1 normalmente cerrado (NC) |
| `f15` | color: 0 verde, 1 negro, 2 azul, 3 cian, 4 rojo, 5 magenta, 6 amarillo, 7 blanco; cuadrados: 8 verde, 9 verde «I», 10 rojo, 11 rojo «O», 13 amarillo, 14 negro; **12 seta de emergencia** |
| `f16` | 0 redondo, 1 cuadrado |
| `a` | 1 mantener la relación de aspecto |

Un valor fuera de esta lista puede cerrar PC_SIMU al abrir el archivo (pasó con un archivo de prueba
que llevaba colores del 8 al 15 en pulsadores redondos y modelos de interruptor del 0 al 3).

### 1 · Interruptor

`f9` NA / NC como el pulsador; `f16` dibujo: 0 interruptor, 1 rotativo 1, 2 rotativo 2, 3 seccionador
rotativo.

### 6 · Final de carrera

| Campo | Valores |
|---|---|
| `f9` | 0 NA, 1 NC |
| `f14` | orientación: 0 extremo derecho, 1 izquierdo, 2 arriba, 3 abajo |
| `f15` | dibujo: 0 «Final de carrera 1», 1 «Final de carrera 2» |

Tamaño por defecto: 23 × 11 (orientación 0 y 1) o 11 × 23 (2 y 3).

### 7 · Detector (8 y 9 · barreras, igual en lo común)

| Campo | Valores |
|---|---|
| `f9` | 0 NA, 1 NC |
| `f12` | tipo: 0 inductivo, 1 capacitivo, 2 ultrasonido |
| `f13` | distancia de detección (10 por defecto) |
| `f14` | orientación: 0 derecha, 1 izquierda, 2 arriba, 3 abajo |
| `f15` | dibujo: 0 «Detector 1», 1 «Detector 2» |

Tamaño por defecto: 20 × 10 o 10 × 20 según la orientación.

**En simulación, los finales de carrera, detectores y barreras se accionan con un clic** (aunque no haya
ninguna pieza): la entrada pasa a 1 (NA) o a 0 (NC). Al empezar la simulación, la entrada vale `f9`.

### 11 · Led

| Campo | Valores |
|---|---|
| `f15` | color: 0 verde, 1 negro, 2 azul, 3 cian, 4 rojo, 5 magenta, 6 amarillo, 7 blanco; 8 piloto verde, 9 piloto rojo, 10 piloto naranja |
| `f16` | 0 redondo, 1 cuadrado |
| `a` | 1 mantener la relación de aspecto |

Tamaño por defecto: 15 × 15.

### 15 · Sonido

`f16`: 0 a 3 los cuatro sonidos de PC_SIMU, 4 un WAV propio (en `texto`).

### 18 · Motor

| Campo | Valores |
|---|---|
| `f5`, `f7` | salida de giro a la derecha |
| `f6`, `f8` | salida de giro a la izquierda |
| `f16` | salidas activas: 1 solo derecha, 10 solo izquierda, 11 las dos |
| `f14` | dibujo: 0 / 1 «Motor 1», 2 / 3 «Motor 2», 4 con patas, 5 con brida, 6 motorreductor (1, 3, 7, 8 y 9: con variador de velocidad) |
| `f17` | velocidad: 0 3000, 1 1500, 2 1000, 3 750 rpm, 4 otra |
| `f12`, `f13` | frecuencia mínima y máxima del variador |
| `f15` | entrada analógica del variador |
| `f9` | margen analógico: 0 unipolar, 1 bipolar |

Tamaño por defecto: 25 × 25 (25 × 45 en las variantes 1 y 3).

### 19 · Actuador neumático (cilindro)

El tipo 19 reúne varios actuadores; `f15` dice cuál. Para el actuador neumático:

| Campo | Valores |
|---|---|
| `f5`, `f7` | salida «expandir cilindro» |
| `f6`, `f8` | salida «contraer cilindro» |
| `f16` | salidas activas: 1 solo expandir, 10 solo contraer, 11 las dos |
| `f4` | electroválvula: 0 monoestable (vuelve por muelle), 1 biestable |
| `f9` | 1: tiene captador «actuador contraído», en la entrada `f11.f13` |
| `f10` | 1: tiene captador «actuador expandido», en la entrada `f12.a` (el bit va en `a`) |
| `f14` | orientación: 0 extremo derecho, 1 izquierdo, 2 arriba, 3 abajo |
| `f15` | dibujo y estado inicial: 11 / 21 gráfico 1 contraído / expandido, 13 / 23 gráfico 2, 15 / 25 gráfico 3 |
| `f17` | velocidad al expandir (los ejemplos usan 50) |
| `texto` | `.%3d.%3d.%3d.%1d.%3d.%1d.%1d`: velocidad al contraer; byte y bit del captador del centro y si lo tiene; entrada analógica de posición y si la tiene; 0 unipolar, 1 bipolar |

Tamaño por defecto: 60 × 20 (orientación 0 y 1) o 20 × 60 (2 y 3).

Cómo lo mueve la simulación (la posición del vástago va en `b`, de 0 a 110):

- **Si empieza dentro** (`f15` = 11, 13 o 15), monoestable o biestable, usa **las dos salidas**: sale
  con expandir = 1 y contraer = 0, y vuelve con expandir = 0 y contraer = 1. Una vez arrancado, llega
  hasta el final aunque la salida se apague. No tiene vuelta por muelle: sin salida de contraer no
  vuelve. (Por eso el editor, para un cilindro sin A−, le da una salida libre y añade al `.awl` una red
  que la pone a NOT A+.)
- **Si empieza fuera** (`f15` = 21, 23 o 25) y es monoestable, solo mira la salida de contraer: vuelve
  con ella a 1 y sale por muelle con ella a 0. Biestable, como el anterior.
- Velocidades: `f17` / 10 al salir y el primer número de `texto` / 10 al volver (como poco, 1 por paso).

### 20 · Cinta

| Campo | Valores |
|---|---|
| `f5`, `f7` | salida «desplazamiento derecha» (cuenta si `f16` = 1) |
| `f6`, `f8` | salida «desplazamiento izquierda» (cuenta si `f15` = 1) |
| `f14` | dibujo e inclinación: 0 / 1 / 2 «Cinta (V1.0)» horizontal / 45° / 135°; 3–5 «Cinta 2»; 6–8 «Cinta 2 con motor» |
| `f17` | velocidad: avanza `f17` / 12 px por paso |
| `f9`, `f10`, `f11` | variador: unipolar / bipolar, si lo tiene y su entrada analógica |

Mueve las piezas que tienen la base sobre su cara de arriba (con 12 px de margen). Con las dos salidas a
la vez, no se mueve.

### 25 · Objeto (alimentador de piezas)

| Campo | Valores |
|---|---|
| `f10` | 1: suelta piezas con una señal, la de `f5.f7` |
| `f4` | esa señal es una entrada (0) o una salida (1) |
| `f9` | 1: suelta piezas sin señal |
| `f14` | lado por el que sale la pieza: 0 derecha, 1 izquierda, 2 arriba, 3 abajo |
| `f16` | pieza: 0 caja, 1 bolsa, 2 áridos, 3 botella, 4 bote, 5 metálica, 6 plástica, 7 de color, 8 persona, 9 vehículo, 11 imagen propia |
| `f17` | pasos entre pieza y pieza mientras sigue activo |

La pieza tiene el tamaño del rectángulo del objeto y aparece pegada a él. Suelta una en cuanto se activa
y otra cada `f17` pasos mientras siga activo.

### 19 · Perfil de aluminio (`f15` de 50 a 61)

`f15`: par horizontal, impar vertical (50 / 51 gris claro, 52 / 53 gris oscuro, y luego rectangular y
redondo). `f13` = 1 «detener objeto»: las piezas se apoyan encima. `f14` = 1 «destruir objeto»: las piezas
que lo tocan desaparecen. `f11`, `f12`: desplazar en X, en Y. Solo actúa por arriba: no frena una pieza
que le llega de lado.

### Las piezas

Cada pieza es un rectángulo (hasta 100 a la vez). Caen si no tienen nada debajo, y desaparecen al salir
de la pantalla (x > 1920 o y > 1080). Los detectores y los finales de carrera las ven en una franja
pegada a su lado (el de `f14`), de `f13` px de largo (10 en los finales de carrera).

### 12 · Display

Muestra en BCD cuatro salidas seguidas por cifra, a partir de `f5.f7` (`f11` cifras). `f4` = 1, `f10` = 1.
Los ejemplos de PC_SIMU usan displays de una cifra: las decenas en `Q0.4`, a la izquierda, y las
unidades en `Q0.0`, a la derecha. El editor exporta así un visualizador: cuatro displays de una cifra en
dos bytes libres, que el `.awl` llena con el valor en BCD (`IBCD`).

### 17 · Potenciómetro

`f5`: n.º de la entrada analógica (`AIW f5`). `f9`: forma (0 lineal vertical, 1 horizontal, 2 redondo,
3 numérico). `f12`, `f13`: escala del valor que muestra; `f10`, `f11`: su unidad (dos letras); `f16`: 0
unipolar, 1 bipolar.

### 22 · Depósito

| Campo | Valores |
|---|---|
| `f15`, `f5.f7` | captador de nivel máximo (si `f15` = 1) |
| `f17`, `f6.f8` | captador de nivel medio |
| `f9`, `f10.f11` | captador de nivel mínimo |
| `f4`, `f12` | nivel analógico en la `AIW f12` |
| `f16` | 0 / 1 líquidos / sólidos (V1.0), 2 / 3 líquidos / sólidos |
| `texto2` | capacidad (1000 en casi todos los ejemplos de PC_SIMU) |
| `b` | el nivel, de 0 a la capacidad |

### 23 · Válvula

`f5.f7`: su salida; `f10`: caudal (lo que sube o baja por paso el nivel, en la escala de la capacidad);
`f11` = 1: tiene líquido en su entrada; `f16`: 0 horizontal, 1 vertical; `f15`, `f12`: salida analógica.
Con su salida activa y líquido en la entrada, la de llenado sube el nivel del depósito de líquidos en
cuyo borde de arriba apoya (dentro de su ancho, con 10 px de margen); la de vaciado va pegada por debajo.
(Los ejemplos de PC_SIMU la ponen más arriba y llevan el líquido con una tubería, tipo 24.)

### 29 · Baliza

Tres luces: **rojo `f5.f7`, ámbar `f6.f8` y verde `f14.f15`** (todas salidas Q). Tamaño por defecto
50 × 125.

### 1008 · Texto suelto

El texto va en `texto`; el rectángulo, 8 px por letra y 17 de alto.

## Cómo exporta el editor una planta

- **El pupitre** (lo que en el editor va en el pupitre: mandos, pilotos, visualizadores…) sale como un
  panel en filas: salidas arriba, mandos en medio y detectores abajo, cada uno con su nombre debajo.
- **Una planta vista de frente** (como PC_SIMU) sale a escala, con cada elemento en su sitio: cintas,
  alimentadores, detectores, finales de carrera, cilindros (con el cuerpo a la medida de su recorrido),
  plataformas, recogidas, barreras, rampas y rótulos. El panel, a su derecha.
- **Una planta vista desde arriba** se proyecta: las cintas, de frente; la pieza del alimentador, apoyada
  en su cinta; los detectores cuyo haz cruza la cinta, encima de ella mirando hacia abajo (si en el
  editor el haz solo llega a media cinta, de frente solo ven las piezas altas). Lo que aparta las piezas a
  un lado de la cinta (desviadores, rampas) no tiene equivalente de frente.
- **Lo que PC_SIMU necesita y el programa no tiene** se añade al `.awl` en salidas libres: la de recoger
  un cilindro con vuelta por muelle, la de cerrar una barrera que cierra por su peso y los dos bytes en
  BCD de cada visualizador (una analógica, pasada antes a sus unidades con reales: el simulador S7_200 no
  hace `MUL` / `DIV` como Micro/WIN; y entre 0 y 9999, lo que admite `IBCD`).
- **El captador de vacío** de un depósito del editor vale 1 con el depósito vacío; el de mínimo de
  PC_SIMU, cuando el líquido lo cubre. El programa lo lee invertido: su entrada se cambia por una marca
  que una red nueva, la primera, pone a NOT entrada.
- **El potenciómetro de PC_SIMU** sube mientras se mantiene pulsado (cada vez más deprisa), hasta 32768;
  un clic suelto apenas lo mueve.
- **El tiempo:** PC_SIMU mueve piezas, cintas y líquidos al ritmo con el que redibuja la pantalla (y de
  su «velocidad de simulación»), no al del autómata. Las velocidades se calculan para un paso de 100 ms
  (el de su velocidad por defecto), pero lo que se ve no coincide con los tiempos del programa.
- **El simulador S7_200** viene con una CPU 214, que no tiene `<`, `>`, `<>` (el editor los reescribe
  con `=`, `>=` y `<=`) ni las instrucciones de reales de las entradas analógicas escaladas.

## Cómo se ha averiguado

1. El guardado es un único `sprintf` con el formato
   `*%d*%d#%s*%d*…*%d#%s#%s#%s*%d*%d*`: sus argumentos dan la tabla de memoria de cada campo.
2. El cuadro de propiedades de cada tipo (sus textos están en los recursos del programa) rellena sus
   controles desde esas tablas al abrirse: de ahí sale qué es cada campo y qué valores admite.
3. El arranque de la simulación y el manejo del ratón dicen cómo se usan las entradas (`f5`, `f7`, `f9`)
   y que los sensores se accionan con un clic.
4. Al colocar un objeto nuevo, PC_SIMU le da su tamaño por defecto según el tipo y la orientación.
