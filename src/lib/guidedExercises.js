// Ejercicios guiados (fase 5, niveles 1 y 2): el mismo ejercicio del banco, pero con una visita
// (components/Tour.jsx) que acompaña paso a paso sobre el ejercicio del alumno, con el foco en lo
// que toca hacer, y termina en «Comprobar». Escritos para quien no sabe nada, como los tutoriales
// (lib/tutorials.js). Un robot hace cada uno entero (tests/e2e/ejercicios.spec.js).
import { N_ } from './i18n'
import { tourHelpers } from './tutorials'

const { one, steps, transitions, transitionWith, firstOf, panel, plusBelow, plusAction, loopButton, stepNode, transitionNode, emptyTransition, verified } = tourHelpers
const exercisePanel = () => one('[data-tour="ejercicio"]')
const solved = () => Boolean(one('[data-exercise="resuelto"]'))
// ¿Alguna transición con esta variable negada (raya encima)?
const negated = (name) => () => transitions().some((n) => [...n.querySelectorAll('.overline')].some((s) => s.textContent.trim() === name))
const stepWith = (...texts) => () => steps().some((n) => texts.every((x) => n.textContent.includes(x)))

const comprobar = {
  target: exercisePanel,
  free: true,
  title: N_('Comprobar'),
  text: N_('Ya está dibujado. Ahora, que lo corrija el editor:\n1. En el panel del ejercicio (a la derecha), pulsa «Comprobar».\n2. Cada comprobación sale en verde o en rojo. Si algo sale en rojo, léelo: dice qué falla. Arréglalo y vuelve a comprobar.'),
  waitFor: solved,
  hint: N_('Pulsa Comprobar hasta que todo salga en verde.'),
}

export const GUIDED = {
  'ej-marcha-paro': {
    id: 'guiado-marcha-paro',
    title: N_('Marcha y paro de un motor (guiado)'),
    auto: true,
    steps: [
      {
        target: exercisePanel,
        title: N_('El ejercicio'),
        text: N_('A la derecha está el enunciado: un motor que se enciende con Marcha y se apaga con Paro, con un piloto que se enciende con él.\nA la izquierda, la tabla de variables que te da el profesor: son los nombres que tienes que usar.\nLo vamos a hacer juntos, paso a paso.'),
      },
      {
        target: () => one('[data-tour="Etapa inicial"]'),
        free: true,
        title: N_('La etapa inicial'),
        text: N_('Primero, la situación de reposo: el motor apagado.\n1. Pulsa «Etapa inicial» en la barra de arriba.\nAparece la etapa 0, con el cuadrado doble: es la que está activa al encender.'),
        waitFor: () => steps().length >= 1,
        hint: N_('Pulsa «Etapa inicial» en la barra.'),
      },
      {
        target: firstOf(panel, emptyTransition, () => [stepNode('0')(), plusBelow()].filter(Boolean)),
        free: true,
        title: N_('Arrancar con Marcha'),
        text: N_('Para pasar de reposo a marcha hace falta una transición con su condición.\n1. Haz clic una vez sobre la etapa 0 y pulsa el + de debajo («Añadir transición»).\n2. Haz doble clic sobre la transición nueva y, en su panel, cambia el nombre provisional (T1) por Marcha.'),
        waitFor: transitionWith('Marcha'),
        hint: N_('Transición Marcha debajo de la etapa 0.'),
      },
      {
        target: () => [transitionNode(/^Marcha$/)(), plusBelow()].filter(Boolean),
        free: true,
        title: N_('La etapa de marcha'),
        text: N_('Ahora la situación de marcha.\n1. Haz clic una vez sobre la transición Marcha.\n2. Pulsa el + de debajo («Añadir etapa»): aparece la etapa 1, ya unida.'),
        waitFor: () => steps().length >= 2,
        hint: N_('Selecciona la transición Marcha y pulsa su + de abajo.'),
      },
      {
        target: firstOf(panel, () => [stepNode('1')(), plusAction()].filter(Boolean)),
        free: true,
        title: N_('El motor y el piloto'),
        text: N_('En la etapa 1 se encienden dos cosas: el motor y el piloto. Son dos acciones.\n1. Haz clic sobre la etapa 1 y pulsa el + de su derecha («Añadir acción»). Escribe Motor.\n2. Vuelve a pulsar el + de la derecha y escribe Piloto.\nOtra forma: doble clic en la etapa y, en su panel, «Añadir acción».'),
        waitFor: stepWith('Motor', 'Piloto'),
        hint: N_('Acciones Motor y Piloto en la etapa 1.'),
      },
      {
        target: firstOf(panel, plusBelow, emptyTransition, stepNode('1')),
        free: true,
        title: N_('Parar con Paro (NC)'),
        text: N_('Paro es un pulsador normalmente cerrado (NC): sin pulsar da 1 y al pulsarlo da 0. La transición tiene que cumplirse al pulsarlo, o sea, cuando Paro vale 0.\n1. Selecciona la etapa 1 y pulsa su + de abajo.\n2. Doble clic en la transición nueva y escribe !Paro (con la exclamación delante: «no Paro»). Se dibuja con una raya encima.'),
        waitFor: negated('Paro'),
        hint: N_('Transición !Paro debajo de la etapa 1.'),
      },
      {
        target: () => [loopButton() ?? transitionNode(/^Paro$/)(), stepNode('0')()].filter(Boolean),
        free: true,
        title: N_('Volver al reposo'),
        text: N_('Al parar, se vuelve a la etapa 0.\n1. Haz clic sobre la transición !Paro.\n2. Pulsa el botón de su izquierda, el de la flecha hacia arriba («Bucle»).\n3. Haz clic sobre la etapa 0.\nVerificar se pone en verde (✓) cuando el grafcet cumple la norma.'),
        waitFor: verified,
        hint: N_('Bucle de !Paro a la etapa 0 (Verificar en verde).'),
      },
      comprobar,
      {
        target: exercisePanel,
        title: N_('¡Ejercicio resuelto!'),
        text: N_('Todo en verde. Pruébalo también en la simulación: pulsa Simular y usa Marcha y Paro en la planta.\nEl siguiente ejercicio ya lo puedes hacer sin guía: en el panel tienes pistas si te atascas.'),
      },
    ],
  },
  'ej-cilindros': {
    id: 'guiado-cilindros',
    title: N_('Cilindros A+ B+ A− B− (guiado)'),
    auto: true,
    steps: [
      {
        target: exercisePanel,
        title: N_('El ejercicio'),
        text: N_('Dos cilindros, A y B, con sus finales de carrera: a0 y a1 (A dentro y fuera), b0 y b1 (B dentro y fuera). Al pulsar Marcha hacen A+ B+ A− B−: sale A, sale B, entra A, entra B.\nLa idea: una etapa por movimiento, y cada transición espera a que el movimiento anterior llegue a su final de carrera.'),
      },
      {
        target: () => one('[data-tour="Etapa inicial"]'),
        free: true,
        title: N_('El reposo'),
        text: N_('1. Pulsa «Etapa inicial» en la barra de arriba: es la etapa 0, los dos cilindros dentro y quietos.'),
        waitFor: () => steps().length >= 1,
        hint: N_('Pulsa «Etapa inicial».'),
      },
      {
        target: firstOf(panel, emptyTransition, () => [stepNode('0')(), plusBelow()].filter(Boolean)),
        free: true,
        title: N_('Arrancar solo si están dentro'),
        text: N_('Arranca con Marcha, pero solo con los dos cilindros dentro (a0 y b0).\n1. Selecciona la etapa 0 y pulsa su + de abajo.\n2. Doble clic en la transición y escribe: Marcha * a0 * b0\nEl * es «y»: se dibuja como un punto (·).'),
        waitFor: () => transitions().some((n) => /Marcha.*a0.*b0/.test(n.textContent)),
        hint: N_('Transición Marcha * a0 * b0.'),
      },
      {
        target: firstOf(panel, () => [steps().at(-1), plusBelow()].filter(Boolean)),
        free: true,
        title: N_('Sale A'),
        text: N_('1. Selecciona la transición y pulsa su + de abajo: etapa 1.\n2. Añádele la acción A+ (el + de su derecha y escribe A+).'),
        waitFor: stepWith('A+'),
        hint: N_('Etapa 1 con la acción A+.'),
      },
      {
        target: firstOf(panel, emptyTransition, () => [steps().at(-1), plusBelow()].filter(Boolean)),
        free: true,
        title: N_('Hasta a1'),
        text: N_('A sale hasta que llega fuera: su final de carrera a1.\n1. Selecciona la etapa 1 y pulsa su + de abajo.\n2. Doble clic en la transición y escribe a1.'),
        waitFor: transitionWith('a1'),
        hint: N_('Transición a1 debajo de la etapa 1.'),
      },
      {
        target: firstOf(panel, emptyTransition, () => [steps().at(-1), plusBelow()].filter(Boolean)),
        free: true,
        title: N_('El resto: igual'),
        text: N_('Repite lo mismo para los otros tres movimientos, siempre debajo del último:\n• etapa 2 con B+, y transición b1\n• etapa 3 con A-, y transición a0\n• etapa 4 con B-, y transición b0\n(Para el + de debajo, selecciona antes la etapa o la transición.)'),
        waitFor: () => stepWith('B-')() && transitions().some((n) => n.textContent.trim() === 'b0'),
        hint: N_('Etapas B+, A-, B- con sus transiciones b1, a0, b0.'),
      },
      {
        target: () => [loopButton() ?? transitions().find((n) => n.textContent.trim() === 'b0'), stepNode('0')()].filter(Boolean),
        free: true,
        title: N_('Vuelta al principio'),
        text: N_('Con B dentro (b0), el ciclo ha terminado: vuelta a la etapa 0.\n1. Selecciona la transición b0 y pulsa «Bucle» (la flecha hacia arriba, a su izquierda).\n2. Haz clic sobre la etapa 0.'),
        waitFor: verified,
        hint: N_('Bucle de b0 a la etapa 0 (Verificar en verde).'),
      },
      comprobar,
      {
        target: exercisePanel,
        title: N_('¡Ejercicio resuelto!'),
        text: N_('Pulsa Simular y Marcha en la planta: verás los dos cilindros hacer la secuencia, y en el panel de simulación, su diagrama espacio-fase.'),
      },
    ],
  },
}
