// Visitas guiadas (components/Tour.jsx). Cada paso: { target, title, text, waitFor?, hint? }.
// target: ancla [data-tour] (los botones de la barra usan su nombre interno: 'Simular',
// 'Verificar'…) o varias; waitFor(): lo que tiene que pasar para seguir (mirando la página).
import { N_ } from './i18n'

const has = (selector) => () => Boolean(document.querySelector(selector))
const simulating = has('[data-tour="simulacion"]')

export const FIRST_TOUR = {
  id: 'primera',
  title: N_('Visita guiada'),
  steps: [
    {
      title: N_('Bienvenido al editor GRAFCET'),
      text: N_('En unos pasos verás lo principal: dibujar el grafcet, comprobarlo, simularlo y pasarlo al autómata.\nPuedes salir cuando quieras (Esc) y repetir la visita desde Ayuda.'),
    },
    {
      target: ['Etapa inicial', 'Etapa', 'Transición', 'Acción', 'Nota'],
      title: N_('Dibujar'),
      text: N_('Con estos botones añades etapas, transiciones, acciones y notas. En el lienzo: arrastra desde el punto de abajo de un elemento para enlazarlo, doble clic para editarlo y clic derecho para el menú (divergencias, bucles, macroetapas…).'),
    },
    {
      target: 'lienzo',
      title: N_('El lienzo'),
      text: N_('Aquí está tu grafcet (IEC 60848). Rueda: zoom; arrastrar el fondo: desplazar. Las receptividades se escriben con la notación de la norma: a · b (Y), a + b (O), ↑a (flanco), 5s/X2 (temporización).'),
    },
    {
      target: 'hojas',
      title: N_('Hojas'),
      text: N_('Un proyecto puede tener varias hojas, como un plano: + añade una y doble clic en su pestaña la renombra.'),
    },
    {
      target: 'Variables',
      title: N_('Tabla de variables'),
      text: N_('Las variables aparecen solas al escribir receptividades y acciones. En la tabla les das su dirección del autómata (I0.0, Q0.0…) y un comentario.'),
    },
    {
      target: 'Verificar',
      title: N_('Verificar'),
      text: N_('Comprueba que el grafcet cumple la norma y puede evolucionar. El número es de errores (rojo) o avisos (ámbar); con ✓, todo en orden. Cada aviso explica el porqué.'),
    },
    {
      target: 'Simular',
      title: N_('Simular'),
      text: N_('Prueba el grafcet como si estuviera en el autómata.'),
      waitFor: simulating,
      hint: N_('Pulsa «Simular».'),
    },
    {
      target: 'entradas',
      title: N_('Entradas'),
      text: N_('Activa y desactiva las entradas con un clic (o con las teclas 1…9) y mira cómo evolucionan las etapas activas, en verde. Si algo no avanza, pasa el ratón por la transición: te dice qué falta.'),
    },
    {
      target: ['simulacion', 'Esquema eléctrico'],
      title: N_('Planta virtual y esquema eléctrico'),
      text: N_('En los ejemplos que la tienen, la planta virtual (cilindros, cintas, detectores…) se mueve con tus salidas. El esquema eléctrico muestra el autómata cableado con sus pulsadores, contactores y electroválvulas, y también se simula.'),
    },
    {
      target: 'Simular',
      title: N_('Volver a editar'),
      text: N_('Mientras simulas, el diagrama no se puede cambiar.'),
      waitFor: () => !simulating(),
      hint: N_('Pulsa «Detener».'),
    },
    {
      target: 'Ladder',
      title: N_('Al autómata'),
      text: N_('El grafcet se traduce a ladder, texto estructurado (ST, SCL de TIA Portal) y AWL/STL (S7-300, S7-200), listo para pasarlo al autómata.'),
    },
    {
      target: 'Abrir',
      title: N_('Ejemplos y proyectos'),
      text: N_('Abre un ejemplo (ordenados por niveles, del 1 al 5), un proyecto guardado o uno nuevo. «Guardar» crea un archivo .json con todo: grafcet, tabla, planta y esquema.'),
    },
    {
      target: 'Exportar',
      title: N_('Exportar'),
      text: N_('Imagen (PNG, SVG), PDF para imprimir y el dossier de la práctica, listo para entregar.'),
    },
    {
      target: 'Ayuda',
      title: N_('Ayuda'),
      text: N_('Aquí tienes los atajos de teclado, la notación y esta visita, para cuando quieras repasarla. ¡A dibujar!'),
    },
  ],
}

// Si ya se ha hecho (o descartado) la visita de bienvenida: no se vuelve a ofrecer.
const SEEN_KEY = 'grafcet-tour'
export const tourSeen = () => {
  try {
    return Boolean(localStorage.getItem(SEEN_KEY))
  } catch {
    return true
  }
}
export const markTourSeen = () => {
  try {
    localStorage.setItem(SEEN_KEY, 'visto')
  } catch {
    // sin almacenamiento: se volverá a ofrecer, sin más
  }
}
