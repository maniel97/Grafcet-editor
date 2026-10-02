// Constructores breves de nodos y enlaces para las pruebas.

export const step = (id, label, y, extra = {}, x = 0) => ({
  id,
  type: 'step',
  position: { x, y },
  data: { label, actions: [], ...extra },
})

export const transition = (id, condition, y, x = 0) => ({
  id,
  type: 'transition',
  position: { x, y },
  data: { condition },
})

export const links = (pairs) => pairs.map(([source, target]) => ({ id: `${source}-${target}`, source, target }))

// Nodo "interno" de React Flow (como en el store), para las funciones de trazado.
export const internal = (id, type, x, y, width = 56, height = type === 'step' ? 56 : 24) => [
  id,
  { id, type, position: { x, y }, internals: { positionAbsolute: { x, y } }, measured: { width, height } },
]
