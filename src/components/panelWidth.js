// Ancho máximo de un panel lateral que se estira arrastrando su borde izquierdo (esquema eléctrico,
// planta): todo el sitio desde su borde derecho hasta el principio de la fila, menos lo que ocupan
// los otros paneles a su izquierda y un mínimo para el lienzo del grafcet. Lo que haya a su derecha
// (el panel de simulación) no cuenta: el borde derecho no se mueve.
export const CANVAS_MIN = 160

export function maxPanelWidth(section, canvasMin = CANVAS_MIN) {
  // La fila de paneles (los envoltorios con display: contents no tienen caja).
  let row = section.parentElement
  while (row && getComputedStyle(row).display === 'contents') row = row.parentElement
  if (!row) return Infinity
  const self = section.getBoundingClientRect()
  const canvas = row.firstElementChild
  const boxes = [...row.querySelectorAll(':scope > *, :scope > .contents > *')]
    .filter((el) => el !== section && el !== canvas && getComputedStyle(el).display !== 'contents')
    .map((el) => el.getBoundingClientRect())
  const others = boxes.filter((r) => r.width > 0 && r.right <= self.left + 1).reduce((sum, r) => sum + r.width, 0)
  return self.right - row.getBoundingClientRect().left - canvasMin - others
}
