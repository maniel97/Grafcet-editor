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

// --- Pasos que se repiten en los guiados ---------------------------------------------------------
const initialStep = (title, text) => ({
  target: () => one('[data-tour="Etapa inicial"]'),
  free: true,
  title,
  text,
  waitFor: () => steps().length >= 1,
  hint: N_('Pulsa «Etapa inicial» en la barra.'),
})
// Etapa con su contenido: la del número dado contiene todos esos textos.
const stepHas = (label, ...texts) => () => {
  const node = stepNode(label)()
  return Boolean(node) && texts.every((x) => node.textContent.includes(x))
}
const lastStepOrPanel = firstOf(panel, emptyTransition, () => [steps().at(-1), plusBelow()].filter(Boolean))
const loopBack = (lastCondition, text) => ({
  target: () => [loopButton() ?? transitions().find((n) => n.textContent.replace(/\s+/g, '') === lastCondition), stepNode('0')()].filter(Boolean),
  free: true,
  title: N_('Vuelta al principio'),
  text,
  waitFor: verified,
  hint: N_('Bucle de la última transición a la etapa 0 (Verificar en verde).'),
})
const done = (text) => ({ target: exercisePanel, title: N_('¡Ejercicio resuelto!'), text })

export const GUIDED_MORE = {
  'ej-luz-pulsador': {
    id: 'guiado-luz-pulsador',
    title: N_('Luz con un solo pulsador (guiado)'),
    auto: true,
    steps: [
      {
        target: exercisePanel,
        title: N_('El ejercicio'),
        text: N_('Un solo pulsador, P, enciende la luz y, al volver a pulsarlo, la apaga: como el telerruptor de una escalera.\nLa clave de este ejercicio es el flanco: que cuente el instante de pulsar, no el tiempo que se mantiene pulsado.'),
      },
      initialStep(N_('La luz apagada'), N_('1. Pulsa «Etapa inicial» en la barra de arriba: la etapa 0 es la luz apagada.')),
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Encender con ↑P'),
        text: N_('1. Selecciona la etapa 0 y pulsa su + de abajo: una transición.\n2. Doble clic en ella. En su panel, borra T1, pulsa el botón ↑ que hay debajo del campo («Flanco de subida») y escribe P. Queda ↑P.\n↑P se cumple solo en el instante en que P pasa de 0 a 1.'),
        waitFor: () => transitions().some((n) => /↑\s*P$/.test(n.textContent.trim())),
        hint: N_('Transición ↑P debajo de la etapa 0.'),
      },
      {
        target: firstOf(panel, () => [steps().at(-1), plusBelow(), plusAction()].filter(Boolean)),
        free: true,
        title: N_('La luz encendida'),
        text: N_('1. Selecciona la transición ↑P y pulsa su + de abajo: la etapa 1.\n2. Con la etapa 1 seleccionada, pulsa su + de la derecha y escribe Luz.'),
        waitFor: stepHas('1', 'Luz'),
        hint: N_('Etapa 1 con la acción Luz.'),
      },
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Apagar con otro ↑P'),
        text: N_('Para apagar, otra pulsación: otra vez ↑P.\n1. Selecciona la etapa 1 y pulsa su + de abajo.\n2. En su panel: botón ↑ y P.'),
        waitFor: () => transitions().filter((n) => /↑\s*P$/.test(n.textContent.trim())).length >= 2,
        hint: N_('Transición ↑P debajo de la etapa 1.'),
      },
      {
        target: () => transitions().at(-1),
        title: N_('¿Por qué el flanco?'),
        text: N_('Si las dos transiciones fueran P a secas, al mantener pulsado se cumplirían una detrás de otra y la luz se encendería y apagaría sin parar. Con ↑P, cada pulsación cuenta una sola vez, la mantengas lo que la mantengas.'),
      },
      loopBack('↑P', N_('1. Selecciona la última transición ↑P y pulsa «Bucle» (la flecha hacia arriba, a su izquierda).\n2. Haz clic sobre la etapa 0.')),
      comprobar,
      done(N_('Pruébalo en la simulación: mantén pulsado P y verás que la luz no parpadea.')),
    ],
  },
  'ej-semaforo': {
    id: 'guiado-semaforo',
    title: N_('Semáforo (guiado)'),
    auto: true,
    steps: [
      {
        target: exercisePanel,
        title: N_('El ejercicio'),
        text: N_('Un semáforo que funciona solo: rojo 10 s, verde 8 s, ámbar 3 s y vuelta a empezar. No hay pulsadores: las transiciones son temporizaciones.'),
      },
      initialStep(N_('El rojo'), N_('1. Pulsa «Etapa inicial» en la barra de arriba.\nEn el siguiente paso le pondrás la acción Rojo.')),
      {
        target: firstOf(panel, () => [stepNode('0')(), plusAction()].filter(Boolean)),
        free: true,
        title: N_('Su luz'),
        text: N_('1. Selecciona la etapa 0 y pulsa el + de su derecha.\n2. Escribe Rojo.'),
        waitFor: stepHas('0', 'Rojo'),
        hint: N_('Acción Rojo en la etapa 0.'),
      },
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Una temporización'),
        text: N_('El rojo dura 10 s: la transición se cumple a los 10 s de activarse la etapa 0.\n1. Selecciona la etapa 0 y pulsa su + de abajo.\n2. Doble clic en la transición y escribe 10s/X0 («10 segundos desde que se activa X0»).'),
        waitFor: transitionWith('10s/X0'),
        hint: N_('Transición 10s/X0.'),
      },
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('El verde y el ámbar'),
        text: N_('Lo mismo para las otras dos luces, siempre debajo de lo último:\n• etapa 1 con Verde, y transición 8s/X1\n• etapa 2 con Ámbar, y transición 3s/X2\n(Cada temporización mira su propia etapa: X1, X2.)'),
        waitFor: () => stepHas('1', 'Verde')() && stepHas('2', 'Ámbar')() && transitionWith('8s/X1')() && transitionWith('3s/X2')(),
        hint: N_('Etapas Verde y Ámbar con 8s/X1 y 3s/X2.'),
      },
      loopBack('3s/X2', N_('Tras el ámbar, otra vez rojo.\n1. Selecciona la transición 3s/X2 y pulsa «Bucle».\n2. Haz clic sobre la etapa 0.')),
      comprobar,
      done(N_('Pulsa Simular y mira el semáforo de la planta: rojo, verde, ámbar… En el cronograma se ven las tres luces turnándose.')),
    ],
  },
  'ej-taladradora': {
    id: 'guiado-taladradora',
    title: N_('Taladradora (guiado)'),
    auto: true,
    steps: [
      {
        target: exercisePanel,
        title: N_('El ejercicio'),
        text: N_('Con una pieza puesta y Marcha, la broca baja girando hasta abajo (Fc_abajo), repasa 2 s girando y sube (Subir) hasta arriba (Fc_arriba).\nFc_abajo y Fc_arriba no los tocas tú: los da la planta cuando la broca llega.'),
      },
      initialStep(N_('El reposo'), N_('1. Pulsa «Etapa inicial» en la barra de arriba: la broca arriba y quieta.')),
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Arrancar'),
        text: N_('Arranca con Marcha, pero solo si hay pieza.\n1. Selecciona la etapa 0 y pulsa su + de abajo.\n2. Doble clic en la transición y escribe Marcha * Pieza (el * es «y»).'),
        waitFor: () => transitions().some((n) => /Marcha.*Pieza/.test(n.textContent)),
        hint: N_('Transición Marcha * Pieza.'),
      },
      {
        target: firstOf(panel, () => [steps().at(-1), plusBelow(), plusAction()].filter(Boolean)),
        free: true,
        title: N_('Bajar girando'),
        text: N_('1. Selecciona la transición y pulsa su + de abajo: la etapa 1.\n2. Dos acciones con el + de su derecha: Motor_broca y Bajar.'),
        waitFor: stepHas('1', 'Motor_broca', 'Bajar'),
        hint: N_('Etapa 1 con Motor_broca y Bajar.'),
      },
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Hasta abajo'),
        text: N_('1. Selecciona la etapa 1 y pulsa su + de abajo.\n2. Escribe Fc_abajo: el final de carrera de abajo.'),
        waitFor: transitionWith('Fc_abajo'),
        hint: N_('Transición Fc_abajo.'),
      },
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Repasar 2 s'),
        text: N_('Abajo, la broca sigue girando 2 s sin bajar.\n1. Etapa 2 debajo, con la acción Motor_broca.\n2. Debajo, la transición 2s/X2: «2 segundos desde que se activa la etapa 2».'),
        waitFor: () => stepHas('2', 'Motor_broca')() && transitionWith('2s/X2')(),
        hint: N_('Etapa 2 con Motor_broca y transición 2s/X2.'),
      },
      {
        target: lastStepOrPanel,
        free: true,
        title: N_('Subir'),
        text: N_('1. Etapa 3 debajo, con la acción Subir (al subir ya no gira).\n2. Debajo, la transición Fc_arriba.'),
        waitFor: () => stepHas('3', 'Subir')() && transitionWith('Fc_arriba')(),
        hint: N_('Etapa 3 con Subir y transición Fc_arriba.'),
      },
      loopBack('Fc_arriba', N_('Arriba, vuelta al reposo.\n1. Selecciona la transición Fc_arriba y pulsa «Bucle».\n2. Haz clic sobre la etapa 0.')),
      comprobar,
      done(N_('Pruébalo con la planta: Simular, activa «Pieza colocada» y pulsa Marcha. La etapa activa sigue a la broca.')),
    ],
  },
}

export const GUIDED = {
  ...GUIDED_MORE,
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
