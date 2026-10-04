// Tutoriales de la ayuda: una visita guiada (components/Tour.jsx) que parte de un proyecto
// (start: 'vacio' o el id de un ejemplo) y va pidiendo cosas al alumno; cada paso comprueba en la
// página que se ha hecho (waitFor) y, con auto, pasa solo al siguiente. free: deja usar toda la
// pantalla (paneles, menús) en ese paso. Cada tutorial lo hace entero un robot (tests/e2e/ayuda.spec.js).
import { N_ } from './i18n'

const all = (selector) => [...document.querySelectorAll(selector)]
const transitions = () => all('.react-flow__node-transition')
const steps = () => all('.react-flow__node-step')
const transitionWith = (text) => () => transitions().some((n) => n.textContent.includes(text))
// Transiciones cuya receptividad dibujada (la negación es una raya, sin «!») cumple la expresión.
const transitionsMatching = (re) => transitions().filter((n) => re.test(n.textContent.replace(/\s+/g, ' ').trim()))
const transitionMatching = (re) => () => transitionsMatching(re).length > 0
const stepActive = (label) => () => steps().some((n) => n.querySelector('.diagram-step-label[data-active]')?.textContent.trim() === label)
const simulating = () => Boolean(document.querySelector('[data-tour="simulacion"]'))
const plantOpen = () => Boolean(document.querySelector('[data-tour="planta"]'))
// Pasa por las etapas en este orden (esperas que el alumno no controla: la máquina hace el ciclo).
const sequence = (...labels) => (memory) => {
  memory.seen ??= 0
  if (memory.seen < labels.length && stepActive(labels[memory.seen])()) memory.seen++
  return memory.seen === labels.length
}
const verified = () => (document.querySelector('[data-tour="Verificar"]')?.textContent ?? '').includes('✓')

export const TUTORIALS = [
  {
    id: 'primer-grafcet',
    title: N_('Tu primer grafcet'),
    description: N_('Un marcha-paro desde cero: etapas, transiciones, una acción, un bucle, Verificar y simular.'),
    start: 'vacio',
    auto: true,
    steps: [
      {
        target: '.react-flow__node-step',
        title: N_('La etapa inicial'),
        text: N_('Empezamos con la etapa 0: el doble cuadrado indica que es inicial, la que está activa al arrancar. Vamos a hacer un marcha-paro: con Marcha se enciende un motor y con Paro se apaga.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Añade una transición'),
        text: N_('Selecciona la etapa 0 con un clic y pulsa el + que aparece debajo: se añade una transición ya enlazada.'),
        waitFor: () => transitions().length >= 1,
        hint: N_('Añade una transición debajo de la etapa 0.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Su receptividad'),
        text: N_('La receptividad es la condición para pasar a la etapa siguiente. Haz doble clic en la transición y escribe Marcha en el campo de la receptividad.'),
        waitFor: transitionWith('Marcha'),
        hint: N_('Escribe Marcha en la receptividad.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('La etapa 1'),
        text: N_('Selecciona la transición y pulsa su +: añade la etapa 1 debajo.'),
        waitFor: () => steps().length >= 2,
        hint: N_('Añade la etapa 1.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Una acción'),
        text: N_('Lo que hace la etapa mientras está activa es su acción. Haz doble clic en la etapa 1, pulsa «Añadir acción» y escribe Motor.'),
        waitFor: () => steps().some((n) => n.textContent.includes('Motor')),
        hint: N_('Añade la acción Motor a la etapa 1.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Cierra el ciclo'),
        text: N_('Añade una transición debajo de la etapa 1 con la receptividad Paro. Después, con ella seleccionada, pulsa el botón de bucle de su izquierda (o clic derecho > «Bucle a etapa») y pulsa la etapa 0: el grafcet vuelve a empezar.'),
        waitFor: () => transitionWith('Paro')() && verified(),
        hint: N_('Transición Paro con un bucle a la etapa 0 (Verificar en verde).'),
      },
      {
        target: 'Verificar',
        title: N_('Conforme'),
        text: N_('Verificar está en verde (✓): el grafcet cumple la norma. Si algo falta, el botón muestra cuántos errores o avisos hay y cada uno explica qué hacer.'),
      },
      {
        target: ['Simular', 'simulacion'],
        free: true,
        title: N_('Pruébalo'),
        text: N_('Pulsa Simular y activa la entrada Marcha (en el panel de la derecha, o la tecla 1): la etapa 1 se activa y el motor se enciende.'),
        waitFor: stepActive('1'),
        hint: N_('Simula y activa Marcha.'),
      },
      {
        target: 'simulacion',
        title: N_('¡Hecho!'),
        text: N_('Ya tienes tu primer grafcet. Desactiva Marcha y activa Paro: vuelve a la etapa 0. Sigue con la wiki (Ayuda) o abre un ejemplo de nivel 1.'),
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
        target: 'lienzo',
        free: true,
        title: N_('La temporización'),
        text: N_('Haz doble clic en la transición de debajo de la etapa 1 y cambia su receptividad por 5s/X1: «han pasado 5 s desde que se activó la etapa 1».'),
        waitFor: transitionMatching(/5s\/X1/),
        hint: N_('Escribe 5s/X1 en la receptividad.'),
      },
      {
        target: ['Simular', 'simulacion'],
        free: true,
        title: N_('Pruébalo'),
        text: N_('Pulsa Simular: se abre la planta junto al grafcet. Pulsa el botón Marcha de su panel de control: se activa la etapa 1.'),
        waitFor: stepActive('1'),
        hint: N_('Simula y pulsa Marcha en la planta.'),
      },
      {
        target: 'simulacion',
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
        target: 'lienzo',
        free: true,
        title: N_('La alternativa'),
        text: N_('Clic derecho en la transición Marcha > «Añadir alternativa en O»: aparece otra transición que también sale de la etapa 0.'),
        waitFor: () => transitions().length >= 3,
        hint: N_('Añade una alternativa en O a la transición Marcha.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Su receptividad'),
        text: N_('Doble clic en la transición nueva y escribe Lento.'),
        waitFor: transitionMatching(/^Lento$/),
        hint: N_('Escribe Lento en la transición nueva.'),
      },
      {
        target: 'lienzo',
        free: true,
        title: N_('Su camino'),
        text: N_('Con la transición Lento seleccionada, pulsa su + para añadir una etapa y dale la acción Motor_lento. Debajo, una transición con la receptividad !Paro y, con el botón de bucle de su izquierda, vuelve a la etapa 0 (si no la ves, «Encuadrar todo el diagrama», abajo a la izquierda).'),
        waitFor: () => steps().some((n) => n.textContent.includes('Motor_lento')) && transitionsMatching(/^Paro$/).length >= 2,
        hint: N_('Etapa con Motor_lento y transición !Paro con bucle a la 0.'),
      },
      {
        target: 'Verificar',
        free: true,
        title: N_('¿Y si pulso las dos?'),
        text: N_('Verificar avisa: Marcha y Lento pueden cumplirse a la vez, y entonces se activarían los dos caminos. En una divergencia en O las receptividades deben ser excluyentes. Cambia Lento por Lento · !Marcha («Lento y no Marcha»).'),
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
        text: N_('En la planta, coloca la pieza (interruptor «Pieza colocada») y pulsa Marcha. La broca baja: mira cómo la etapa activa sigue a la máquina.'),
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
]

export const tutorialById = (id) => TUTORIALS.find((tut) => tut.id === id) ?? null
