# Auditoría de la CPU S7-200 simulada

Revisión instrucción por instrucción de `src/lib/plc/s7200cpu.js` (issue #1), la CPU que ejecuta en
el simulador el programa STL de STEP 7-Micro/WIN. Octubre de 2026.

## Fuentes

- **Referencia:** *S7-200 Programmable Controller System Manual*, Siemens, edición 08/2008
  (6ES7298-8FA24-8BH0), capítulos 4 (memoria), 6 (juego de instrucciones) y apéndice D (marcas
  especiales). Las páginas que se citan son las impresas.
- **Proyectos revisados para contrastar** (solo como referencia de comportamiento, sin copiar código):

| Proyecto | Qué es | Para qué ha servido |
|---|---|---|
| [awlsim](https://github.com/mbuesch/awlsim) | Python, GPL v2+, S7-300/400 | Tiene una batería de pruebas por instrucción (`tests/tc100_instructions`), pero de otra familia: acumuladores, RLO y temporizadores S5. No vale como «gold» del S7-200; sí como modelo de cómo organizar las pruebas. |
| [Evaristo](https://evaristo-sim.sourceforge.net/) | C++, GPL v2, S7-200, abandonado en 2013 | Confirma que EU/ED no dan flanco en el primer ciclo y que los contadores leen la pila sin vaciarla. Sus ejemplos (`TIMERS.AWL`) usan `R T90, 1`, que nuestra CPU no aceptaba. No implementa SCR. |
| [SIM7-200](https://github.com/seikosantana/SIM7-200) | Python, S7-200 SMART, sin licencia | Subconjunto pequeño (sin contadores ni SCR). Solo se ha leído la documentación. |

No existe ninguna batería de pruebas pública del S7-200. Las pruebas «gold» son, por tanto:

1. **Los ejemplos del manual**, con el resultado que dan sus cronogramas y figuras, en
   `tests/unit/s7200gold.test.js`.
2. **Un programa para una CPU real** con lo que el manual no deja claro:
   `docs/s7200/pruebas-cpu-real.awl` (ver al final).

## Fallos encontrados y corregidos

| # | Qué hacía mal | Según el manual | Efecto en clase |
|---|---|---|---|
| 1 | VB, VW, VD, QB… eran casillas separadas | Comparten bytes, el alto primero (VW100 = VB100·VB101) | `MOVB 0, QB0` no apagaba las salidas; `MOVW` a VW100 no cambiaba V100.x |
| 2 | Todos los temporizadores contaban al ejecutarse | 10 ms: al empezar el ciclo; 100 ms: al ejecutarse (p. 199) | El temporizador que se resetea con su propio bit daba el pulso donde no toca |
| 3 | La resolución salía de la tabla de TON también para TONR | T0/T64 1 ms, T1–T4/T65–T68 10 ms, T5–T31/T69–T95 100 ms (tabla 6-72) | TONR T1 contaba 10 veces más lento |
| 4 | El exportador aceptaba `TON T1` (direcciones de otro esquema) | TON/TOF solo con T32–T63 y T96–T255 | Micro/WIN rechaza el programa; ahora se cambia por T37… con aviso |
| 5 | `R T37` / `R C0` daba «no es un bit» | R pone a 0 el bit y el valor (p. 69); es la única forma de borrar un TONR | Imposible resetear un TONR |
| 6 | TON/TONR seguían contando sin límite | Se paran en 32767 | — |
| 7 | CTUD se quedaba en 32767 / −32768 | Da la vuelta (p. 107) | — |
| 8 | EU/ED daban flanco en el primer ciclo | En el primer ciclo solo se guarda el estado (p. 67) | Un pulsador pulsado al arrancar contaba una vez de más |
| 9 | +I, *I… saturaban; /0 paraba el programa | SM1.1 / SM1.3, ENO = 0, la salida no cambia y la CPU sigue (p. 141) | — |
| 10 | `END` terminaba siempre el ciclo | END es condicional; el fin incondicional lo pone Micro/WIN (p. 169) | — |
| 11 | La subrutina empezaba con la pila vacía | Empieza con la pila a 1 y la recupera al volver (p. 204) | Una bobina al principio de una SBR daba error |
| 12 | La pila no tenía límite | 9 niveles: al cargar el décimo se pierde el de abajo (p. 67) | — |
| 13 | Al habilitar un temporizador contaba ese mismo ciclo | Cuenta desde que se habilita | Terminaban un ciclo antes |
| 14 | Las constantes `16#FF` y `2#1010` no se entendían | Formatos de Micro/WIN | — |
| 15 | Una instrucción desconocida solo daba error al llegar a ella | — | Ahora se avisa al cargar el programa, con su línea |

## Instrucciones añadidas

SCR (`LSCR SCRT SCRE CSCRE`), `JMP/LBL`, `FOR/NEXT`, `LDS`, `AENO`, `STOP`, `WDR`, `NOP`, comparaciones
de byte (sin signo) y de doble entero, `+D −D *D /D MUL DIV`, `INCB/D DECB/D`, `SQRT LN EXP SIN COS TAN`,
`INV AND OR XOR` de byte/palabra/doble, desplazamientos y rotaciones, `SHRB`, `BTI ITB BCDI IBCD SEG`,
`BMB BMW BMD SWAP FILL`, marcas SM0.2, SM0.3, SM0.6, SM0.7, SM1.0–SM1.3, SM1.6 y SMW22.

## Lo que no se imita

- **Temporizadores de 1 ms** (T0, T32, T64, T96): en la CPU real se actualizan a la vez que el ciclo.
  Aquí se actualizan al empezar el ciclo, como los de 10 ms.
- **Granularidad:** un temporizador real puede terminar hasta un intervalo antes, porque empieza a
  contar a mitad de un tic (el manual aconseja PV+1). El simulado es exacto.
- **E/S inmediatas** (LDI, =I…): iguales que las normales, porque no hay módulo físico.
- **No están:** interrupciones (`ATCH`, `ENI`), contadores rápidos y salidas de impulsos (HSC, PLS),
  comunicaciones (NETR, XMT…), PID, tablas, reloj, punteros (`*VD`, `&VB`), memoria L y subrutinas con
  parámetros, y retentividad. Si un programa las usa, se avisa con su línea.

## A confirmar en una CPU real

El manual no deja claros estos puntos, o se contradice en ellos. Se han simulado como se indica, y
el programa `docs/s7200/pruebas-cpu-real.awl` los comprueba todos de una vez.

**Cómo probarlo:**
1. En Micro/WIN, Archivo > Importar el `.awl` y cargarlo en la CPU.
2. Pasar a RUN y, tras un segundo, poner I0.0 a 1.
3. En una tabla de estado, mirar las direcciones de la tabla siguiente.

| Prueba | Mirar | Simulada | Por qué hay duda |
|---|---|---|---|
| P1 = en un SCR inactivo | M10.0 / M10.1 | 0 / 1 | El manual dice que el segmento «depende» del bit S. Se ejecuta sin flujo de corriente: las `=` se apagan y las `S` se mantienen. Es coherente con la nota de los TOF (p. 198). |
| P2 +I que desborda | VW500 / M11.0 | 32767 / 1 | «Los operandos originales no se alteran» (p. 141): ¿tampoco OUT? |
| P3 INCB de 255 | VB502 / M11.1 / M11.2 | 255 / 1 / 0 | ¿El byte da la vuelta a 0 o desborda? |
| P4 CTU con CU a 1 en el primer ciclo | C10 | 1 | ¿Cuenta como flanco al arrancar? |
| P5 pila después de CTU | M11.3 / M11.4 | 0 / 0 | ¿La caja deja R, CU o el bit del contador arriba de la pila? |
| P6 ROUND de −2,5 | VD510 | −3 | «Con 0,5 o más se redondea hacia arriba»: ¿en valor absoluto? |
| P7 MOVW a AC1 | VD520 | 16#12340000 | ¿Escribir una palabra en un acumulador conserva su parte alta? |
| P8 TON de 100 ms dos veces por ciclo | T40 = T41 | sí | El manual avisa de que se descuadra, pero no dice cuánto (p. 199). |
| P9 CTD con carga y cuenta a la vez | C20 | 5 | ¿Manda la carga? |
| P10 EU en el primer ciclo | M11.5 | 0 | Confirmar la regla de la p. 67. |

Si alguna difiere, se cambia la CPU simulada y su prueba en `s7200gold.test.js`, que comprueba que la
simulada da exactamente la columna «Simulada».
