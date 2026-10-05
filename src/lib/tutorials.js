// Tutoriales de la ayuda: una visita guiada (components/Tour.jsx) que parte de un proyecto
// (start: 'vacio' o el id de un ejemplo) y va pidiendo cosas al alumno; cada paso comprueba en la
// página que se ha hecho (waitFor) y, con auto, pasa solo al siguiente. free: deja usar toda la
// pantalla (paneles, menús) en ese paso. Cada tutorial lo hace entero un robot (tests/e2e/ayuda.spec.js).
//
// Escritos para quien no sabe nada: cada paso dice qué es, para qué sirve y exactamente qué pulsar
// (y la otra forma de hacerlo). El foco (target) sigue a lo que toca hacer en cada momento: la
// etapa, su botón +, el panel que se abre al editar…
import { N_ } from './i18n'

const all = (selector) => [...document.querySelectorAll(selector)]
const one = (selector) => document.querySelector(selector)
const transitions = () => all('.react-flow__node-transition')
const steps = () => all('.react-flow__node-step')
const transitionWith = (text) => () => transitions().some((n) => n.textContent.includes(text))
// Transiciones cuya receptividad dibujada (la negación es una raya, sin «!») cumple la expresión.
const transitionsMatching = (re) => transitions().filter((n) => re.test(n.textContent.replace(/\s+/g, ' ').trim()))
const transitionMatching = (re) => () => transitionsMatching(re).length > 0
const labelOf = (n) => n.querySelector('.diagram-step-label')?.textContent.trim()
const stepActive = (label) => () => steps().some((n) => n.querySelector('.diagram-step-label[data-active]')?.textContent.trim() === label)
const simulating = () => Boolean(one('[data-tour="simulacion"]'))
const plantOpen = () => Boolean(one('[data-tour="planta"]'))
// Pasa por las etapas en este orden (esperas que el alumno no controla: la máquina hace el ciclo).
const sequence = (...labels) => (memory) => {
  memory.seen ??= 0
  if (memory.seen < labels.length && stepActive(labels[memory.seen])()) memory.seen++
  return memory.seen === labels.length
}
const verified = () => (one('[data-tour="Verificar"]')?.textContent ?? '').includes('✓')

// Para el foco: lo primero que exista de la lista (funciones que devuelven elementos o nada).
const firstOf =
  (...options) =>
  () => {
    for (const option of options) {
      const el = option()
      if (el) return el
    }
    return 'lienzo'
  }
const panel = () => one('[data-tour="propiedades"]')
const plusBelow = () => one('[data-tour="mas-siguiente"]')
const plusAction = () => one('[data-tour="mas-accion"]')
const loopButton = () => one('[data-tour="bucle"]')
const stepNode = (label) => () => steps().find((n) => labelOf(n) === label)
const transitionNode = (re) => () => transitionsMatching(re)[0]
// Transición recién creada: sin texto o con el nombre provisional (T1, T2…).
const emptyTransition = () => transitions().find((n) => /^(T\d+)?$/.test(n.textContent.replace(/\s+/g, '')))
// ¿Hay un enlace de este nodo a este otro? (React Flow etiqueta cada enlace con sus extremos).
const linked = (from, to) => Boolean(from && to) && all('.react-flow__edge').some((e) => e.getAttribute('aria-label') === `Edge from ${from.dataset.id} to ${to.dataset.id}`)

// «Elegir un camino»: la etapa de Motor_lento y la transición !Paro que sale de ella.
const slowStep = () => steps().find((n) => n.textContent.includes('Motor_lento'))
const newParo = () => transitionsMatching(/^Paro$/).find((n) => linked(slowStep(), n))

// Tutorial del profesorado: el modo educativo, el escenario guardado y el diálogo del ejercicio.
const education = () => {
  try {
    return JSON.parse(localStorage.getItem('grafcet-editor:settings'))?.education === true
  } catch {
    return false
  }
}
const scenarioSaved = () => Boolean(one('[data-scenario]'))
const exerciseDialogOpen = () => Boolean(one('#exercise-title-input'))
const behaviourChecked = () => Boolean(one('[data-tour="pruebas-comportamiento"] input[type=checkbox]:checked'))
const dialogAllGreen = () => {
  const items = all('[data-tour="probar-ejercicio"] [data-check]')
  return items.length > 0 && items.every((i) => i.dataset.ok === 'si')
}
const exerciseSaved = () => Boolean(one('[data-tour="ejercicio"]')) && !exerciseDialogOpen()
const behaviourRed = () => Boolean(one('[data-tour="ejercicio"] [data-check^="comportamiento"][data-ok="no"]'))
const solved = () => Boolean(one('[data-exercise="resuelto"]'))

// Para los ejercicios guiados (lib/guidedExercises.js), que siguen el mismo patrón.
export const tourHelpers = { all, one, steps, transitions, transitionWith, transitionsMatching, transitionMatching, stepActive, simulating, verified, firstOf, panel, plusBelow, plusAction, loopButton, stepNode, transitionNode, emptyTransition, linked }

export const TUTORIALS = [
  {
    id: 'primer-grafcet',
    title: N_('Tu primer grafcet'),
    description: N_('Un marcha-paro desde cero: etapas, transiciones, una acción, un bucle, Verificar y simular.'),
    start: 'vacio',
    auto: true,
    steps: [
      {
        target: stepNode('0'),
        title: N_('La etapa inicial'),
        text: N_('Esto es una etapa: una situación en la que puede estar la máquina (parada, en marcha…). La 0 tiene el cuadrado doble porque es la inicial: la que está activa al encender.\nVamos a hacer un marcha-paro: con el pulsador Marcha se enciende un motor y con Paro se apaga.'),
      },
      {
        target: () => [stepNode('0')(), plusBelow()].filter(Boolean),
        free: true,
        title: N_('Añade una transición'),
        text: N_('Para pasar de una etapa a otra hace falta una transición: una raya horizontal con su condición.\n1. Haz clic una vez sobre la etapa 0: queda seleccionada (borde azul).\n2. Aparecen unos botones redondos con +. Pulsa el de debajo («Añadir transición»).\nOtra forma: el botón «Transición» de la barra de arriba, y después unirla arrastrando desde el punto de abajo de la etapa.'),
        waitFor: () => transitions().length >= 1,
        hint: N_('Selecciona la etapa 0 y pulsa su + de abajo.'),
      },
      {
        target: firstOf(panel, emptyTransition),
        free: true,
        title: N_('Su condición'),
        text: N_('Cada transición tiene una receptividad: la condición que se tiene que cumplir para pasar a la etapa siguiente.\n1. Haz doble clic sobre la raya de la transición (o selecciónala con un clic y pulsa Intro).\n2. A la derecha se abre su panel. En «Receptividad / condición» pone T1 (un nombre provisional): bórralo y escribe Marcha.\nSe guarda sola: no hay que pulsar nada más.'),
        waitFor: transitionWith('Marcha'),
        hint: N_('Escribe Marcha en la receptividad.'),
      },
      {
        target: () => [transitionNode(/^Marcha$/)(), plusBelow()].filter(Boolean),
        free: true,
        title: N_('La etapa 1'),
        text: N_('Ahora, la situación a la que se llega al pulsar Marcha: la etapa 1.\n1. Haz clic una vez sobre la transición Marcha para seleccionarla.\n2. Pulsa el + de debajo («Añadir etapa»): aparece la etapa 1, ya unida.'),
        waitFor: () => steps().length >= 2,
        hint: N_('Selecciona la transición y pulsa su + de abajo.'),
      },
      {
        target: firstOf(panel, () => [stepNode('1')(), plusAction()].filter(Boolean)),
        free: true,
        title: N_('Una acción'),
        text: N_('Lo que hace la máquina mientras está en una etapa es su acción: aquí, encender el motor.\n1. Haz clic una vez sobre la etapa 1.\n2. Pulsa el + de su derecha («Añadir acción»): se añade una acción llamada «Acción» y se abre el panel de la etapa.\n3. Escribe Motor (el texto «Acción» ya está seleccionado: lo que escribas lo sustituye).\nOtra forma: doble clic en la etapa y, en su panel, «Añadir acción».'),
        waitFor: () => steps().some((n) => n.textContent.includes('Motor')),
        hint: N_('Añade la acción Motor a la etapa 1.'),
      },
      {
        target: firstOf(panel, plusBelow, emptyTransition, stepNode('1')),
        free: true,
        title: N_('La transición de paro'),
        text: N_('Para apagar hace falta otra transición, debajo de la etapa 1.\n1. Haz clic sobre la etapa 1 y pulsa su + de abajo.\n2. Haz doble clic en la transición nueva y, en su panel, cambia el nombre provisional (T2) por Paro.'),
        waitFor: transitionWith('Paro'),
        hint: N_('Transición Paro debajo de la etapa 1.'),
      },
      {
        target: () => [loopButton() ?? transitionNode(/^Paro$/)(), stepNode('0')()].filter(Boolean),
        free: true,
        title: N_('Volver al principio'),
        text: N_('Al apagar, la máquina vuelve a la situación inicial: hay que unir la transición Paro con la etapa 0. Es un bucle.\n1. Haz clic una vez sobre la transición Paro.\n2. Pulsa el botón de su izquierda, el de la flecha hacia arriba («Bucle»).\n3. Haz clic sobre la etapa 0. La unión sube por la izquierda con una flecha.\nOtra forma: clic derecho en la transición > «Bucle a etapa».'),
        waitFor: verified,
        hint: N_('Bucle de la transición Paro a la etapa 0 (Verificar en verde).'),
      },
      {
        target: 'Verificar',
        title: N_('Conforme'),
        text: N_('El botón Verificar revisa el grafcet con las reglas de la norma IEC 60848. Está en verde (✓): todo correcto.\nSi algo falla, muestra cuántos errores o avisos hay; al pulsarlo, cada uno explica qué pasa y cómo arreglarlo.'),
      },
      {
        target: firstOf(() => one('[data-tour="entradas"]'), () => one('[data-tour="Simular"]')),
        free: true,
        title: N_('Pruébalo'),
        text: N_('Simular es probar el grafcet como si estuviera en el autómata.\n1. Pulsa Simular (en la barra de arriba).\n2. En el panel de la derecha, en Entradas, activa Marcha con su interruptor (o la tecla 1).\nLa etapa 1 se pone verde con un punto: está activa. Y el motor (la acción) se enciende.'),
        waitFor: stepActive('1'),
        hint: N_('Simula y activa Marcha.'),
      },
      {
        target: 'simulacion',
        title: N_('¡Hecho!'),
        text: N_('Ya tienes tu primer grafcet. Prueba ahora: desactiva Marcha y activa Paro, y vuelve a la etapa 0.\nPara seguir editando, pulsa Detener. En Ayuda tienes más tutoriales y la explicación de cada parte.'),
      },
    ],
  },
  {
    id: 'temporizacion',
    title: N_('Una espera'),
    description: N_('Sobre el marcha-paro: el motor se para solo a los 5 s, con una temporización 5s/X1.'),
    start: 'marcha-paro',
    auto: true,
    steps: [
      {
        target: 'lienzo',
        title: N_('El punto de partida'),
        text: N_('Es el marcha-paro: con Marcha se pasa a la etapa 1 (motor en marcha) y con Paro se vuelve a la 0. Vamos a cambiar el paro por una espera: el motor funcionará 5 s y se parará solo.'),
      },
      {
        target: firstOf(panel, transitionNode(/^Paro$/)),
        free: true,
        title: N_('La temporización'),
        text: N_('El tiempo se escribe en la receptividad: 5s/X1 quiere decir «han pasado 5 s desde que se activó la etapa 1».\n1. Haz doble clic sobre la transición de debajo de la etapa 1 (la de Paro).\n2. En su panel, borra lo que hay y escribe 5s/X1.'),
        waitFor: transitionMatching(/5s\/X1/),
        hint: N_('Escribe 5s/X1 en la receptividad.'),
      },
      {
        target: firstOf(() => one('[data-tour="planta"]'), () => one('[data-tour="Simular"]')),
        free: true,
        title: N_('Pruébalo'),
        text: N_('1. Pulsa Simular (en la barra de arriba): se abre la planta (la maqueta de la máquina) junto al grafcet.\n2. Pulsa el botón verde Marcha del panel de control de la planta.\nSe activa la etapa 1 y el motor gira.'),
        waitFor: stepActive('1'),
        hint: N_('Simula y pulsa Marcha en la planta.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Espera'),
        text: N_('Ahora espera sin tocar nada: la transición se pone verde a los 5 s y el grafcet vuelve solo a la etapa 0, con el motor parado.'),
        waitFor: stepActive('0'),
        hint: N_('Espera 5 s.'),
      },
      {
        target: 'simulacion',
        title: N_('¡Hecho!'),
        text: N_('El tiempo siempre se escribe sobre una variable: 5s/X1 cuenta desde que se activó la etapa 1. Más formas (retardos, 3s/a/2s) en el artículo Temporizaciones.'),
      },
    ],
  },
  {
    id: 'divergencia-o',
    title: N_('Elegir un camino'),
    description: N_('Sobre el marcha-paro: una segunda forma de arrancar (divergencia en O) y por qué sus receptividades deben ser excluyentes.'),
    start: 'marcha-paro',
    auto: true,
    steps: [
      {
        target: 'lienzo',
        title: N_('El punto de partida'),
        text: N_('Es el marcha-paro. Vamos a añadir otra forma de salir de la etapa 0: con Lento se irá a otra etapa, que mueve el motor despacio. Desde la etapa 0 habrá que elegir un camino: es una divergencia en O.'),
      },
      {
        target: firstOf(() => one('[role="menu"]'), transitionNode(/^Marcha$/)),
        free: true,
        title: N_('La alternativa'),
        text: N_('1. Haz clic derecho sobre la transición Marcha: se abre su menú.\n2. Elige «Añadir alternativa en O».\nAparece otra transición, al lado, que también sale de la etapa 0.'),
        waitFor: () => transitions().length >= 3,
        hint: N_('Añade una alternativa en O a la transición Marcha.'),
      },
      {
        target: firstOf(panel, emptyTransition),
        free: true,
        title: N_('Su receptividad'),
        text: N_('1. Haz doble clic sobre la transición nueva (la que tiene un nombre provisional, T…).\n2. En su panel, cambia el nombre provisional (T…) por Lento.'),
        waitFor: transitionMatching(/^Lento$/),
        hint: N_('Escribe Lento en la transición nueva.'),
      },
      {
        target: firstOf(panel, plusBelow, plusAction, emptyTransition, transitionNode(/^Lento$/)),
        free: true,
        title: N_('Su camino'),
        text: N_('Ahora, lo que pasa al elegir Lento:\n1. Selecciona la transición Lento y pulsa su + de abajo: aparece una etapa.\n2. Selecciona esa etapa y pulsa su + de la derecha: escribe la acción Motor_lento.\n3. Selecciona la etapa otra vez y pulsa su + de abajo; en la transición nueva escribe !Paro (! es «no»: Paro sin pulsar).'),
        waitFor: () => steps().some((n) => n.textContent.includes('Motor_lento')) && transitionsMatching(/^Paro$/).length >= 2,
        hint: N_('Etapa con Motor_lento y, debajo, transición !Paro.'),
      },
      {
        target: () => [loopButton() ?? newParo(), stepNode('0')()].filter(Boolean),
        free: true,
        title: N_('Cierra el camino'),
        text: N_('1. Haz clic sobre la transición !Paro nueva.\n2. Pulsa el botón de su izquierda, el de la flecha hacia arriba («Bucle»).\n3. Haz clic sobre la etapa 0 (si no la ves, «Encuadrar todo el diagrama», abajo a la izquierda).'),
        waitFor: () => linked(newParo(), stepNode('0')()),
        hint: N_('Bucle de la transición !Paro nueva a la etapa 0.'),
      },
      {
        target: firstOf(panel, () => one('[data-tour="Verificar"]')),
        free: true,
        title: N_('¿Y si pulso las dos?'),
        text: N_('Verificar avisa: Marcha y Lento pueden cumplirse a la vez, y entonces se activarían los dos caminos. En una divergencia en O las receptividades deben ser excluyentes.\nDoble clic en la transición Lento y cámbiala por Lento · !Marcha («Lento y no Marcha»; el punto · es «y»).'),
        waitFor: () => transitionMatching(/^Lento · Marcha$/)() && verified(),
        hint: N_('Receptividad Lento · !Marcha (Verificar en verde).'),
      },
      {
        target: 'Verificar',
        title: N_('¡Hecho!'),
        text: N_('Ahora, si se pulsan las dos, gana Marcha. Simúlalo para comprobarlo. Las divergencias en Y (hacer cosas a la vez) se explican en el artículo Elegir y hacer a la vez.'),
      },
    ],
  },
  {
    id: 'planta',
    title: N_('Probar con la planta'),
    description: N_('La taladradora con su planta virtual: simular moviendo la máquina y ver cómo el grafcet sigue a los finales de carrera.'),
    start: 'taladradora',
    auto: true,
    steps: [
      {
        target: 'lienzo',
        title: N_('La taladradora'),
        text: N_('Con pieza y Marcha, la broca baja girando hasta su final de carrera, repasa 2 s y sube. Las entradas Fc_abajo y Fc_arriba no las vas a tocar tú: las da la planta.'),
      },
      {
        target: 'Simular',
        title: N_('Simular'),
        text: N_('Pulsa Simular.'),
        waitFor: () => simulating() && plantOpen(),
        hint: N_('Pulsa «Simular».'),
      },
      {
        target: 'planta',
        title: N_('La planta'),
        text: N_('Al simular, la planta se abre junto al grafcet: arriba la máquina y abajo su panel de control. «Planta virtual», en el panel de simulación, la cierra y la vuelve a abrir.'),
      },
      {
        target: 'planta',
        free: true,
        title: N_('Manos a la obra'),
        text: N_('1. En el panel de control de la planta, pulsa el interruptor «Pieza colocada» (se queda puesto).\n2. Pulsa el botón Marcha.\nLa broca baja: mira cómo la etapa activa del grafcet sigue a la máquina.'),
        waitFor: stepActive('1'),
        hint: N_('Pieza colocada y Marcha, en la planta.'),
      },
      {
        target: 'planta',
        free: true,
        title: N_('Un ciclo entero'),
        text: N_('Al llegar abajo, Fc_abajo pasa a la etapa 2 (2 s de repaso); después sube y, con Fc_arriba, vuelve a la 0. Espera a que acabe el ciclo.'),
        waitFor: sequence('2', '3', '0'),
        hint: N_('Espera a que la broca vuelva arriba.'),
      },
      {
        target: 'planta',
        title: N_('¡Hecho!'),
        text: N_('Así se prueba un programa sin máquina. Con «Editar» puedes cambiar la planta, y con las averías (en Usar, sobre cada elemento) practicar qué pasa si un detector falla. Más en el artículo La planta virtual.'),
      },
    ],
  },
  {
    id: 'preparar-ejercicio',
    title: N_('Prepara tu primer ejercicio'),
    description: N_('Para profesorado: de tu solución a un ejercicio con autocorrección. Qué se le dice al editor, cómo lo comprueba y cómo se reparte.'),
    start: 'marcha-paro',
    auto: true,
    steps: [
      {
        target: 'lienzo',
        title: N_('Tu solución'),
        text: N_('Esto es un marcha-paro resuelto: el motor arranca con Marcha y se para con Paro (NC). Haz de cuenta que es tu solución.\nVas a convertirlo en un ejercicio. Lo importante: al editor no se le escriben reglas. Todo lo que comprueba sale de tu solución y de lo que marques en un diálogo.'),
      },
      {
        target: 'Opciones',
        free: true,
        title: N_('El modo educativo'),
        text: N_('Las herramientas de clase están escondidas para no llenar los menús.\n1. Pulsa Opciones (el engranaje de arriba a la derecha).\n2. Marca «Mostrar las herramientas para clase» (Modo educativo) y pulsa Listo.'),
        waitFor: education,
        hint: N_('Opciones > Modo educativo.'),
      },
      {
        target: firstOf(() => one('[data-tour="simulacion"]'), () => one('[data-tour="Simular"]')),
        free: true,
        title: N_('Un escenario de prueba'),
        text: N_('Para comprobar el comportamiento, el editor necesita saber qué hace una persona con la máquina: un escenario de prueba (qué se pulsa y cuándo).\n1. Pulsa Simular.\n2. En el panel de la derecha, en «Escenarios de prueba», pulsa «Grabar escenario».\n3. En la planta, pulsa Marcha; espera un par de segundos y pulsa Paro.\n4. Pulsa «Detener y guardar».\n(Otra forma: «Dibujar escenario», sin simular.)'),
        waitFor: scenarioSaved,
        hint: N_('Graba un escenario: Marcha, espera, Paro, y guárdalo.'),
      },
      {
        target: 'Simular',
        title: N_('Termina de simular'),
        text: N_('El escenario queda guardado en el proyecto. Pulsa Detener para volver a editar.'),
        waitFor: () => !simulating(),
        hint: N_('Pulsa Detener.'),
      },
      {
        target: 'Exportar',
        free: true,
        title: N_('Prepara el ejercicio'),
        text: N_('Abre Exportar > «Ejercicio para el alumnado». Ahí se dice todo lo que tendrá el ejercicio.'),
        waitFor: exerciseDialogOpen,
        hint: N_('Exportar > Ejercicio para el alumnado.'),
      },
      {
        target: firstOf(() => one('[data-tour="pruebas-comportamiento"]'), () => one('#exercise-title-input')),
        free: true,
        title: N_('Qué se comprueba'),
        text: N_('Arriba van el título, el enunciado (con negrita y listas) y lo que recibe hecho el alumnado (tabla, planta, esquema; dado o bloqueado).\nLo que se comprueba:\n• Que cumple la norma y usa las variables de la tabla: siempre.\n• El comportamiento: marca tu escenario en «Pruebas de comportamiento». El editor ejecutará tu solución con él, apuntará cuándo se enciende y se apaga cada salida, y exigirá lo mismo al alumno (con un margen de tiempo).\nMarca tu escenario.'),
        waitFor: behaviourChecked,
        hint: N_('Marca tu escenario en «Pruebas de comportamiento».'),
      },
      {
        target: firstOf(() => one('[data-tour="probar-ejercicio"]')),
        free: true,
        title: N_('Pruébalo con tu solución'),
        text: N_('Pulsa «Probar» (en el recuadro «Prueba con tu solución»). Con tu solución todo tiene que salir en verde: si algo sale en rojo, el ejercicio pediría algo que ni tu solución cumple.'),
        waitFor: dialogAllGreen,
        hint: N_('Pulsa Probar: todo en verde.'),
      },
      {
        target: firstOf(() => one('[data-tour="probar-ejercicio"]')),
        free: true,
        title: N_('Guárdalo'),
        text: N_('Pulsa «Guardar» (abajo). Al guardar se fija lo que se comprueba con tu solución de este momento.'),
        waitFor: exerciseSaved,
        hint: N_('Pulsa Guardar.'),
      },
      {
        target: () => one('[data-tour="ejercicio"]'),
        title: N_('La vista del profesor'),
        text: N_('A la derecha, el panel del ejercicio: lo que verá el alumnado (enunciado y «Comprobar»), con una franja de profesor para editarlo y descargarlo. Aquí «Comprobar» corrige tu proyecto como corregirá el del alumno.'),
      },
      {
        target: firstOf(panel, () => transitions().find((n) => n.querySelector('.overline')), () => one('[data-tour="ejercicio"]')),
        free: true,
        title: N_('Rómpelo a propósito'),
        text: N_('La mejor forma de ver qué compara el editor: equivócate como lo haría un alumno.\n1. Haz doble clic en la transición de abajo (la de Paro, con la raya encima: !Paro).\n2. Cambia !Paro por Paro (sin la exclamación).\n3. En el panel del ejercicio, pulsa «Comprobar».'),
        waitFor: behaviourRed,
        hint: N_('Cambia !Paro por Paro y pulsa Comprobar.'),
      },
      {
        target: firstOf(() => one('[data-tour="ejercicio"] [data-check^="comportamiento"][data-ok="no"]'), () => one('[data-tour="ejercicio"]')),
        title: N_('Qué ha detectado'),
        text: N_('La norma se cumple y las variables son las de la tabla, pero la máquina no responde como tu solución: con tu escenario, el motor no se enciende cuando debía. El mensaje dice qué salida, cuándo se esperaba y qué ha pasado; «Verlo en la simulación» reproduce el escenario para verlo.\nEl aviso amarillo recuerda que tu solución ha cambiado: se comprueba contra lo que guardaste.'),
      },
      {
        target: () => one('[data-tour="ejercicio"]'),
        free: true,
        title: N_('Déjalo como estaba'),
        text: N_('Vuelve a poner !Paro (o pulsa Ctrl+Z) y pulsa Comprobar: todo en verde.'),
        waitFor: solved,
        hint: N_('Vuelve a !Paro y comprueba.'),
      },
      {
        target: () => one('[data-tour="ejercicio"]'),
        title: N_('Listo para repartir'),
        text: N_('• «Para el alumnado» descarga el ejercicio sin tu grafcet.\n• En el diálogo, «Hoja de prácticas (PDF)» crea una hoja para imprimir con el ejercicio dentro.\n• También puedes pedir requisitos (una temporización, un contador…), escribir pistas y mostrar una nota.\n• Abrir > «Corregir entregas» corrige de golpe los dossiers de la clase.\nTodo está explicado en el artículo Ejercicios de la ayuda.'),
      },
    ],
  },
]

export const tutorialById = (id) => TUTORIALS.find((tut) => tut.id === id) ?? null
