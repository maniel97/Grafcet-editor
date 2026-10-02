// Clave del contenido del diagrama SIN posiciones: cambia al añadir, quitar o editar nodos, pero
// no al moverlos. Sirve para que lo que solo depende del contenido (variables, etapas, tabla) no
// se recalcule ni haga re-dibujar todos los nodos en cada movimiento de un arrastre.
//
// React Flow conserva el mismo objeto `data` mientras solo cambia la posición; a cada objeto
// `data` distinto se le da un número, y la clave es la lista de (id, tipo, número de data).

const dataIds = new WeakMap()
let nextId = 0

const idOf = (data) => {
  if (!data || typeof data !== 'object') return 0
  let id = dataIds.get(data)
  if (id === undefined) {
    id = ++nextId
    dataIds.set(data, id)
  }
  return id
}

export const diagramContentKey = (nodes) => nodes.map((n) => `${n.id}:${n.type}:${idOf(n.data)}`).join('|')
