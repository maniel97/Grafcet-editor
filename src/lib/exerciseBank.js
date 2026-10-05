// Banco de ejercicios (fase 5): ejercicios de los niveles 1 a 5 sacados de los ejemplos, que son
// su solución de referencia. Cada uno trae su enunciado (lo que hace la máquina, no cómo se hace
// el grafcet), un escenario de prueba con los mandos que pulsaría una persona, pistas graduales y
// los requisitos que tiene sentido pedir. Un robot comprueba cada uno
// (tests/unit/exerciseBank.test.js): la solución pasa, el escenario hace funcionar la máquina, el
// alumno no recibe el grafcet y un grafcet estropeado no pasa.
import { EXAMPLES } from './examples'
import { normalizeProject } from './projectFile'
import { DEFAULT_EXERCISE } from './exercise'

// Escenario: [instante, entrada, valor]; pulsar(t, entrada, cuánto) = pulsación de un pulsador NA.
const scenario = (id, name, duration, events) => ({ id, name, duration, events: events.map(([t, n, v]) => ({ t, name: n, value: v })) })
const press = (t, name, hold = 0.3) => [
  [t, name, 1],
  [Math.round((t + hold) * 100) / 100, name, 0],
]
// Pulsador NC (Paro, setas): pulsarlo es ponerlo a 0.
const pressNC = (t, name, hold = 0.3) => [
  [t, name, 0],
  [Math.round((t + hold) * 100) / 100, name, 1],
]

function fromExample(exampleId, { title, statement, scenarios, hints = [], requirements = [], parts = {} }) {
  const project = normalizeProject(EXAMPLES.find((e) => e.id === exampleId).build())
  return {
    ...project,
    name: title,
    plc: {
      ...project.plc,
      scenarios: [...(project.plc.scenarios ?? []), ...scenarios],
      exercise: {
        ...DEFAULT_EXERCISE,
        title,
        statement,
        parts: { ...DEFAULT_EXERCISE.parts, ...parts },
        checks: { ...DEFAULT_EXERCISE.checks, behaviour: { scenarios: scenarios.map((s) => s.id), outputs: [], tolerance: 0.5, counts: true }, requirements },
        hints: { enabled: true, items: hints },
      },
    },
  }
}

const entry = (id, level, example, title, description, spec) => ({ id, level, title, description, teacher: () => fromExample(example, { title, ...spec }) })

export const BANK = [
  // --- Nivel 1 ---------------------------------------------------------------------------------
  entry('ej-luz-pulsador', 1, 'luz-pulsador', 'Luz con un solo pulsador', 'El mismo pulsador enciende y apaga: los flancos.', {
    statement: 'Una luz (**Luz**) se enciende al pulsar **P** y se apaga al volver a pulsarlo, como un telerruptor.\n\n- Mantener el pulsador apretado no debe hacer que la luz cambie una y otra vez.',
    scenarios: [scenario('telerruptor', 'Tres pulsaciones (la primera, larga)', 7, [...press(0.5, 'P', 1.2), ...press(3, 'P'), ...press(5, 'P')])],
    requirements: [{ id: 'edge' }],
    hints: ['Dos etapas: luz apagada (la inicial) y luz encendida.', 'Si la transición es `P` a secas, mientras lo mantienes pulsado se cumplen las dos seguidas. Usa el flanco `↑P`: solo el instante de pulsar.'],
  }),
  entry('ej-contador', 1, 'contador', 'Contar pulsaciones', 'Un contador y un flanco: a la tercera, la luz.', {
    statement: 'Tras pulsar **Marcha**, cada pulsación de **P** cuenta. A la **tercera**, se enciende la **Luz**, que sigue encendida hasta pulsar **Reset**; entonces todo vuelve a empezar.',
    scenarios: [scenario('tres', 'Marcha, tres pulsaciones y Reset', 7, [...press(0.3, 'Marcha'), ...press(1, 'P', 0.2), ...press(2, 'P', 0.2), ...press(3, 'P', 0.2), ...press(5, 'Reset')])],
    requirements: [{ id: 'counter' }, { id: 'edge' }],
    hints: ['Lleva la cuenta en una variable, por ejemplo `C`: ponla a 0 al empezar con una acción memorizada `C:=0`.', 'Cada pulsación suma 1 con `C:=C+1`, en una etapa que dura un instante (receptividad `1`).', 'Con `↑P` y una comparación (`C < 2`, `C >= 2`) eliges entre contar o encender la luz.'],
  }),
  entry('ej-semaforo', 1, 'semaforo', 'Semáforo', 'Tres luces y tres temporizaciones, en bucle.', {
    statement: 'Un semáforo para coches: **Rojo** 10 s, **Verde** 8 s, **Ámbar** 3 s y vuelta a empezar. No tiene pulsadores: funciona solo.',
    scenarios: [scenario('ciclo', 'Dos ciclos', 44, [])],
    requirements: [{ id: 'timer' }],
    hints: ['Una etapa por luz, cada una con su acción continua (`Rojo`, `Verde`, `Ámbar`).', 'Las transiciones son temporizaciones de la etapa anterior: `10s/X0`, `8s/X1`…'],
  }),
  // --- Nivel 2 ---------------------------------------------------------------------------------
  entry('ej-taladradora', 2, 'taladradora', 'Taladradora', 'Una secuencia con finales de carrera y una espera.', {
    statement: 'Con una pieza colocada (**Pieza**) y al pulsar **Marcha**, la broca baja girando (**Bajar**, **Motor_broca**) hasta su final de carrera de abajo (**Fc_abajo**). Allí repasa **2 s** girando y después sube (**Subir**) hasta **Fc_arriba**, donde se para.',
    scenarios: [scenario('pieza', 'Pieza y Marcha', 9, [[0.3, 'Pieza', 1], ...press(0.6, 'Marcha')])],
    requirements: [{ id: 'timer' }],
    hints: ['Cuatro etapas: reposo, bajar, repasar y subir.', 'El motor de la broca gira mientras baja y mientras repasa (etapas 1 y 2): es una acción de las dos. Al subir ya no gira.', 'La espera es la transición `2s/X2` (la etapa en la que repasa).'],
  }),
  entry('ej-garaje', 2, 'garaje', 'Puerta de garaje', 'Abrir, esperar y cerrar, con una fotocélula de seguridad.', {
    statement: 'Al pulsar **Abrir**, con la puerta cerrada (**Cerrada**), la puerta sube (**Subir**) hasta **Abierta**. Espera **5 s** abierta y baja (**Bajar**) hasta **Cerrada**.\n\n- Mientras la puerta se mueve se enciende la **Luz**.\n- Si la fotocélula (**Foto**) ve algo mientras baja, vuelve a subir (seguridad); y no empieza a bajar si hay algo delante.',
    scenarios: [scenario('ciclo', 'Abrir y dejar que cierre', 16, press(0.5, 'Abrir'))],
    requirements: [{ id: 'timer' }, { id: 'or' }],
    hints: ['Cuatro etapas: cerrada, subiendo, abierta (esperando) y bajando.', 'La espera abierta termina con `5s/X2 · !Foto`.', 'Desde «bajando» hay dos caminos: `Cerrada · !Foto` (llega) o `Foto` (vuelve a subir).'],
  }),
  entry('ej-aparcamiento', 2, 'aparcamiento', 'Aparcamiento con contador de plazas', 'Contar entradas y salidas, con pilotos de libre y completo.', {
    statement: 'Un aparcamiento de **5 plazas** cuenta los coches que hay dentro: suma con **Entra** y resta con **Sale**.\n\n- Con plazas libres se enciende **Libre**; con las 5 ocupadas, **Completo**.\n- Con el aparcamiento lleno no se cuenta una entrada, ni una salida con él vacío.',
    scenarios: [scenario('seis', 'Seis entradas y una salida', 9, [...press(0.5, 'Entra'), ...press(1.5, 'Entra'), ...press(2.5, 'Entra'), ...press(3.5, 'Entra'), ...press(4.5, 'Entra'), ...press(5.5, 'Entra'), ...press(7, 'Sale')])],
    requirements: [{ id: 'counter' }, { id: 'edge' }, { id: 'conditional' }],
    hints: ['Cuenta con `C`: `C:=C+1` en una etapa y `C:=C-1` en otra, que duran un instante.', 'Los pilotos son acciones condicionadas de la etapa de reposo: `Libre` si `C < 5`, `Completo` si `C >= 5`.', 'Para no contar de más: `↑Entra · !Sale · C < 5` y `↑Sale · !Entra · C > 0`.'],
  }),
  entry('ej-silo', 2, 'silo-vibrador', 'Silo con vibrador', 'Acciones retardadas y limitadas en el tiempo.', {
    statement: 'Con el silo lleno (**Lleno**) y al pulsar **Marcha**, se descarga (**Descarga**) hasta **Vacio**; después se llena (**Llenar**) hasta **Lleno**.\n\n- Al empezar la descarga, la sirena **Aviso** suena solo los **2 primeros segundos**.\n- El **Vibrador** arranca a los **4 s** de descarga, para que el producto no se atasque.',
    scenarios: [scenario('ciclo', 'Marcha y un ciclo', 30, press(0.5, 'Marcha'))],
    requirements: [{ id: 'conditional' }, { id: 'timer' }],
    hints: ['Tres etapas: reposo, descargar y llenar.', 'El aviso es una acción condicionada que deja de cumplirse a los 2 s: condición `!2s/X1`.', 'El vibrador, otra acción condicionada que empieza a los 4 s: `4s/X1`.'],
  }),
  entry('ej-estrella-triangulo', 2, 'estrella-triangulo-plc', 'Arranque estrella-triángulo', 'Temporizaciones y una pausa de seguridad entre contactores.', {
    statement: 'Al pulsar **Marcha**, el motor arranca en **estrella** (**Linea** y **Estrella**) y a los **5 s** pasa a **triángulo** (**Linea** y **Triangulo**).\n\n- Entre estrella y triángulo hay una pausa de **0,5 s** con los dos apagados: si entraran a la vez sería un cortocircuito.\n- **Paro** es un pulsador NC (sin pulsar da 1) y para el motor en cualquier momento, también durante el arranque.',
    scenarios: [scenario('arranque', 'Arrancar y parar', 10, [...press(0.5, 'Marcha'), ...pressNC(8, 'Paro')])],
    requirements: [{ id: 'timer' }],
    hints: ['Cuatro etapas: reposo, estrella, pausa y triángulo.', 'La línea va en las etapas de estrella, pausa y triángulo; la estrella y el triángulo, cada uno en la suya.', 'Paro es NC: la transición de paro es `!Paro`, y la de arranque lleva `Paro` para no arrancar con él pulsado.'],
  }),
  // --- Nivel 3 ---------------------------------------------------------------------------------
  entry('ej-clasificadora', 3, 'clasificadora', 'Clasificadora por material', 'Una cinta, un detector inductivo y un desviador.', {
    statement: 'Con el interruptor **Marcha** encendido, la cinta (**M**) lleva las piezas. Cuando el detector inductivo (**Metal**) ve una pieza de metal, el desviador (**D**) se abre **1,5 s** para sacarla a su recogida; las de plástico siguen hasta el final.\n\n- Al apagar Marcha, la cinta se para.',
    scenarios: [scenario('marcha', 'Marcha 20 s', 22, [[0.5, 'Marcha', 1], [20, 'Marcha', 0]])],
    requirements: [{ id: 'edge' }, { id: 'timer' }],
    hints: ['Tres etapas: parada, cinta en marcha y desviando.', 'La pieza de metal se detecta con el flanco `↑Metal`: una vez por pieza.', 'Mientras desvía, la cinta sigue en marcha (acción también de esa etapa) y vuelve con `1.5s/X2`.'],
  }),
  entry('ej-cinta-reversible', 3, 'cinta-reversible', 'Cinta reversible', 'Elegir un sentido de dos posibles, con detectores en los extremos.', {
    statement: 'Una cinta mueve una pieza a la derecha (**Derecha**, salida **Adelante**) o a la izquierda (**Izquierda**, salida **Atras**), según el pulsador. Se para al llegar la pieza al detector de ese extremo (**Fin_dcha**, **Fin_izq**) o con **Paro** (NC).\n\n- Para probarla, **Poner** deja una pieza en la cinta.\n- Nunca puede moverse en los dos sentidos a la vez.\n- No arranca hacia un extremo si la pieza ya está en él.',
    scenarios: [scenario('ida-vuelta', 'Poner pieza, a la derecha y a la izquierda', 22, [...press(0.3, 'Poner', 0.2), ...press(1, 'Derecha'), ...press(10, 'Izquierda')])],
    requirements: [{ id: 'or' }],
    hints: ['Tres etapas: reposo, adelante y atrás; desde el reposo se elige (divergencia en O).', 'Las dos receptividades de salida tienen que ser excluyentes: `Derecha · !Izquierda` y `Izquierda · !Derecha` (más los detectores y el paro).', 'Cada sentido vuelve al reposo con su detector o con `!Paro`.'],
  }),
  entry('ej-dos-carros', 3, 'dos-carros', 'Dos carros con un tramo común', 'Dos grafcets que se coordinan con variables de etapa.', {
    statement: 'Dos carros, **A** y **B**, comparten un tramo de vía: nunca pueden estar los dos en él. Cada uno entra al pedirlo (**Pide_A**, **Pide_B**; salidas **A+**, **B+**), llega al final (**a1**, **b1**) y vuelve (**A-**, **B-**) hasta **a0**, **b0**.\n\n- Si los dos piden a la vez, entra **A** primero.',
    scenarios: [scenario('a-la-vez', 'Los dos piden a la vez', 12, [...press(0.5, 'Pide_A'), ...press(0.5, 'Pide_B', 4)])],
    hints: ['Un grafcet para cada carro, con su propia etapa inicial.', 'Para entrar, el otro carro tiene que estar en reposo: usa su variable de etapa (por ejemplo, `X30` en la receptividad de A).', 'La prioridad de A: en la receptividad de B, `!Pide_A`.'],
  }),
  entry('ej-semaforo-peatones', 3, 'semaforo-peatones', 'Semáforo con pulsador de peatones', 'Recordar una petición con un grafcet parcial.', {
    statement: 'Los coches tienen verde (**VerdeC**) hasta que un peatón pulsa (**Pulsador**), pero al menos **10 s**. Entonces: ámbar (**AmbarC**) **3 s**, rojo para coches (**RojoC**) y, a **1 s**, verde para peatones (**VerdeP**) **8 s**; y vuelta al verde de coches.\n\n- La petición se recuerda aunque se suelte el pulsador: mientras espera, se enciende **Espere**.\n- Los peatones tienen rojo (**RojoP**) salvo en su verde.',
    scenarios: [scenario('peaton', 'Un peatón pulsa a los 2 s', 30, press(2, 'Pulsador'))],
    requirements: [{ id: 'timer' }, { id: 'edge' }],
    hints: ['Un grafcet para el semáforo y otro, pequeño, que recuerda la petición (dos etapas).', 'La petición se recuerda con `↑Pulsador` y se borra cuando los peatones tienen verde (`X3`).', 'El verde de coches termina con `10s/X0 · X11`: tiempo mínimo y petición.'],
  }),
  // --- Nivel 4 ---------------------------------------------------------------------------------
  entry('ej-emergencia', 4, 'emergencia', 'Paro de emergencia con forzado', 'Un grafcet de seguridad que fuerza al de producción.', {
    statement: 'Con **Marcha**, un carro avanza (**Avanzar**) hasta **Fc_delante** y retrocede (**Retroceder**) hasta **Fc_detras**.\n\n- Con **Emergencia**, todo se para al momento y se enciende la **Alarma**.\n- Con **Rearme** (y sin emergencia), la producción vuelve a su situación inicial y espera una nueva Marcha.',
    scenarios: [scenario('emergencia', 'Emergencia a mitad de ciclo y rearme', 10, [...press(0.5, 'Marcha'), ...press(1.2, 'Emergencia'), ...press(3, 'Rearme'), ...press(4.5, 'Marcha')])],
    hints: ['Dos grafcets: uno de seguridad (G1) y otro de producción (G2).', 'En emergencia, G1 congela la producción sin etapas activas: orden de forzado `F/G2{}`.', 'Al rearmar, G1 la devuelve a su inicio: `F/G2{INIT}`.'],
  }),
  entry('ej-manual-auto', 4, 'manual-auto', 'Manual / Automático', 'Un grafcet de conducción que manda sobre el de producción.', {
    statement: 'Un cilindro (**A+**, **A-**, finales de carrera **a0**, **a1**) se maneja en dos modos, con el interruptor **Auto**:\n\n- **Manual**: el cilindro sale mientras se pulsa **Avanzar** y entra mientras se pulsa **Retroceder**.\n- **Automático** (piloto **Luz_auto**): con cada **Ciclo**, sale y entra una vez.\n- Solo se pasa a automático con el cilindro dentro, y solo se vuelve a manual al terminar el ciclo.',
    scenarios: [scenario('modos', 'Manual, y después un ciclo automático', 12, [...press(0.5, 'Avanzar', 1.5), ...press(2.5, 'Retroceder', 1.5), [5, 'Auto', 1], ...press(5.5, 'Ciclo')])],
    requirements: [{ id: 'conditional' }],
    hints: ['Dos grafcets: conducción (manual / automático) y producción (el ciclo).', 'En manual, el cilindro se mueve con acciones condicionadas: `A+` si `Avanzar`, `A-` si `Retroceder`.', 'En manual, la conducción mantiene la producción en su inicio: `F/GP{INIT}`.'],
  }),
  // --- Nivel 5 ---------------------------------------------------------------------------------
  entry('ej-encapsulacion', 5, 'encapsulacion', 'Paro inmediato con encapsulación', 'Una etapa encapsulante corta el ciclo esté donde esté.', {
    statement: 'Al pulsar **Marcha**, un cilindro sale y entra sin parar (**A+** hasta **a1**, **A-** hasta **a0**) y se enciende **En_marcha**.\n\n- Con **Paro**, el ciclo se corta en el acto, esté donde esté.\n- Resuélvelo con una **etapa encapsulante** (IEC 60848).',
    scenarios: [scenario('paro', 'Marcha y paro a mitad de ciclo', 6, [...press(0.5, 'Marcha'), ...press(1.6, 'Paro')])],
    hints: ['Una etapa encapsulante (la 1) contiene el ciclo del cilindro: mientras está activa, lo está su grafcet encapsulado.', 'Al activarse, la etapa marcada con un asterisco del encapsulado se activa a la vez.', 'Al desactivarse la encapsulante con `Paro`, todo lo encapsulado se desactiva.'],
  }),
]
