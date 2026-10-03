// «Mis grupos» de la planta: conjuntos de elementos guardados con un nombre para reutilizarlos en
// cualquier proyecto (en este navegador; se pueden exportar e importar en un archivo).
//
// Grupo: { id, name, elements: [...] } con las posiciones relativas a su esquina superior
// izquierda y los ids propios del grupo (para las referencias internas: un cilindro montado en
// otro del mismo grupo).

const KEY = 'grafcet-editor:scene-groups'
const FORMAT = 'grafcet-editor-scene-groups'

const valid = (g) => g && typeof g.name === 'string' && Array.isArray(g.elements) && g.elements.every((e) => e && typeof e.type === 'string')

export function loadGroups() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter(valid) : []
  } catch {
    return []
  }
}

export function storeGroups(groups) {
  try {
    localStorage.setItem(KEY, JSON.stringify(groups))
    return true
  } catch {
    return false
  }
}

// Grupo nuevo a partir de unos elementos de la escena.
export function makeGroup(name, elements, id = `g${Date.now().toString(36)}`) {
  const minX = Math.min(...elements.map((e) => e.x))
  const minY = Math.min(...elements.map((e) => e.y))
  const ids = new Set(elements.map((e) => e.id))
  return {
    id,
    name: name.trim(),
    elements: elements.map((e) => ({
      ...e,
      x: e.x - minX,
      y: e.y - minY,
      // Montado en un cilindro que no va en el grupo: queda fijo.
      ...(e.mountedOn && !ids.has(e.mountedOn) ? { mountedOn: '' } : {}),
    })),
  }
}

// Elementos para colocar un grupo con su esquina en `at`: ids nuevos y referencias internas
// actualizadas.
export function placeGroup(group, at, newId) {
  const ids = new Map(group.elements.map((e) => [e.id, newId()]))
  return group.elements.map((e) => ({
    ...e,
    id: ids.get(e.id),
    x: e.x + at.x,
    y: e.y + at.y,
    ...(e.mountedOn ? { mountedOn: ids.get(e.mountedOn) ?? '' } : {}),
  }))
}

export const exportGroups = (groups) => JSON.stringify({ format: FORMAT, version: 1, groups }, null, 2)

// Grupos de un archivo exportado, añadidos a los que ya hay (con ids nuevos si coinciden).
// Lanza un Error con un mensaje claro si el archivo no es de grupos.
export function importGroups(text, current) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  if (data?.format !== FORMAT || !Array.isArray(data.groups)) throw new Error('El archivo no contiene grupos de la planta.')
  const taken = new Set(current.map((g) => g.id))
  const added = data.groups.filter(valid).map((g, i) => (taken.has(g.id) || !g.id ? { ...g, id: `g${Date.now().toString(36)}${i}` } : g))
  return [...current, ...added]
}
