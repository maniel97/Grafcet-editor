// Tutoriales de la ayuda: una visita guiada (components/Tour.jsx) que parte de un proyecto
// (start: 'vacio' o el id de un ejemplo) y va pidiendo cosas al alumno; cada paso comprueba en la
// página que se ha hecho (waitFor) y, con auto, pasa solo al siguiente. free: deja usar toda la pantalla (paneles, menús) en ese paso.
import { N_ } from './i18n'

const all = (selector) => [...document.querySelectorAll(selector)]
const transitions = () => all('.react-flow__node-transition')
const steps = () => all('.react-flow__node-step')
const transitionWith = (text) => () => transitions().some((n) => n.textContent.includes(text))
const stepActive = (label) => () => steps().some((n) => n.querySelector('.diagram-step-label[data-active]')?.textContent.trim() === label)
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
]

export const tutorialById = (id) => TUTORIALS.find((tut) => tut.id === id) ?? null
