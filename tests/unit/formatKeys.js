// Campos de un proyecto, como rutas («nodes[step].data.actions[].kind», «plc.variables.*.type»), para
// comprobar que todo lo que se guarda está en docs/formato-proyecto.md. Se baja hasta el nivel que
// documenta el texto: las secciones con catálogos largos (elementos de la planta, componentes del
// esquema eléctrico, pasos del dosier…) se paran en su lista y el detalle está en el código.

// Rutas donde no se baja más (su contenido se documenta por remisión al código).
const STOP = new Set([
  'plc.scene.elements[]',
  'plc.scene.groups[]',
  'plc.electrical.components[]',
  'plc.electrical.wires[]',
  'plc.exercise.checks',
  'plc.exercise.sealed',
  'plc.exercise.frozen',
  'plc.exercise.student',
  'plc.exercise.process',
  'plc.exercise.parts',
  'plc.exercise.hints',
  'plc.exercise.grade',
  'plc.exercise.sheet',
  'plc.dossier.sections',
  'plc.dossier.cover',
  'plc.guide.sheet',
  'plc.guide.practices[]',
  'plc.gemma.states',
  'plc.gemma.transitions[]',
  'plc.scenarios[].events[]',
  'nodes[].measured',
  'nodes[].style',
  'nodes[].internals',
  'viewport',
])
// Objetos que son diccionarios (las claves son nombres, no campos).
const MAPS = new Set(['plc.variables', 'plc.steps'])

function walk(value, path, out) {
  out.add(path)
  if (STOP.has(path) || value === null || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) walk(item, `${path}[]`, out)
    return
  }
  for (const [key, child] of Object.entries(value)) {
    const sub = MAPS.has(path) ? `${path}.*` : `${path}.${key}`
    walk(child, sub, out)
  }
}

export function keyPaths(project) {
  const out = new Set()
  for (const [key, value] of Object.entries(project)) {
    if (key === 'nodes') {
      for (const node of value) {
        for (const [k, v] of Object.entries(node)) {
          if (k === 'data') walk(v, `nodes[${node.type}].data`, out)
          else walk(v, `nodes[].${k}`, out)
        }
      }
    } else if (key === 'edges') {
      for (const edge of value) walk(edge, 'edges[]', out)
    } else walk(value, key, out)
  }
  out.delete('edges[]')
  return out
}
