// GEMMA (Guía de Estudio de los Modos de Marcha y Parada): estados que se usan, transiciones entre
// ellos y qué orden de forzado da cada estado al grafcet de producción. A partir de ahí se genera
// el grafcet de conducción (GC): una etapa por estado usado (con el código del estado como número:
// A1, F1, D1...), una transición por cada paso entre estados y, como acción de la etapa, la orden
// de forzado (F/G1{INIT}, F/G1{}...). La descripción del estado va como comentario de la etapa.

export const GEMMA_STATES = [
  { id: 'A1', family: 'A', name: 'Parada en el estado inicial' },
  { id: 'A2', family: 'A', name: 'Parada pedida a final de ciclo' },
  { id: 'A3', family: 'A', name: 'Parada pedida en un estado determinado' },
  { id: 'A4', family: 'A', name: 'Parada obtenida' },
  { id: 'A5', family: 'A', name: 'Preparación para la puesta en marcha después de un defecto' },
  { id: 'A6', family: 'A', name: 'Puesta del sistema en el estado inicial' },
  { id: 'A7', family: 'A', name: 'Puesta del sistema en un estado determinado' },
  { id: 'F1', family: 'F', name: 'Producción normal' },
  { id: 'F2', family: 'F', name: 'Marcha de preparación' },
  { id: 'F3', family: 'F', name: 'Marcha de cierre' },
  { id: 'F4', family: 'F', name: 'Marcha de verificación sin orden' },
  { id: 'F5', family: 'F', name: 'Marcha de verificación en orden' },
  { id: 'F6', family: 'F', name: 'Marcha de prueba' },
  { id: 'D1', family: 'D', name: 'Parada de emergencia' },
  { id: 'D2', family: 'D', name: 'Diagnóstico y/o tratamiento de los defectos' },
  { id: 'D3', family: 'D', name: 'Producción a pesar de los defectos' },
]
export const FAMILIES = { A: 'Procedimientos de parada', F: 'Procedimientos de funcionamiento', D: 'Procedimientos en defecto' }

// Orden de forzado que da un estado al grafcet de producción.
export const FORCINGS = [
  { id: '', label: 'Ninguna (el grafcet de producción evoluciona)' },
  { id: 'INIT', label: 'Situación inicial: F/G{INIT}' },
  { id: 'EMPTY', label: 'Sin etapas activas: F/G{}' },
  { id: 'FREEZE', label: 'Congelado: F/G{*}' },
]
const forcingText = (kind, grafcet) => ({ INIT: `F/${grafcet}{INIT}`, EMPTY: `F/${grafcet}{}`, FREEZE: `F/${grafcet}{*}` })[kind]

// Configuración típica: marcha / paro a fin de ciclo / emergencia con rearme e inicialización.
export const TYPICAL_GEMMA = {
  production: 'G1',
  states: { A1: '', F1: '', A2: '', D1: 'EMPTY', A5: 'EMPTY', A6: 'INIT' },
  transitions: [
    { from: 'A1', to: 'F1', condition: 'Marcha' },
    { from: 'F1', to: 'A2', condition: 'Paro' },
    { from: 'A2', to: 'A1', condition: 'Fin_ciclo' },
    { from: 'F1', to: 'D1', condition: 'Emergencia' },
    { from: 'D1', to: 'A5', condition: '!Emergencia' },
    { from: 'A5', to: 'A6', condition: 'Rearme' },
    { from: 'A6', to: 'A1', condition: 'Inicio_ok' },
  ],
}
export const EMPTY_GEMMA = { production: 'G1', states: {}, transitions: [] }

const stateById = new Map(GEMMA_STATES.map((s) => [s.id, s]))
export const gemmaState = (id) => stateById.get(id)

// Problemas de la configuración antes de generar.
export function checkGemma(gemma) {
  const used = new Set(Object.keys(gemma.states))
  const problems = []
  if (!used.size) problems.push('Marca al menos un estado.')
  if (used.size && !used.has('A1')) problems.push('Falta A1 (parada en el estado inicial): es la situación inicial del grafcet de conducción.')
  for (const t of gemma.transitions) {
    if (!used.has(t.from) || !used.has(t.to)) problems.push(`La transición ${t.from} → ${t.to} usa un estado no marcado.`)
    if (!String(t.condition ?? '').trim()) problems.push(`La transición ${t.from} → ${t.to} no tiene condición.`)
  }
  for (const id of used) {
    if (id !== 'A1' && !gemma.transitions.some((t) => t.to === id)) problems.push(`Al estado ${id} no se llega desde ningún otro.`)
    if (!gemma.transitions.some((t) => t.from === id)) problems.push(`Del estado ${id} no se sale nunca.`)
  }
  if (Object.values(gemma.states).some(Boolean) && !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(gemma.production ?? '')) {
    problems.push('Indica el nombre del grafcet de producción (p. ej. G1).')
  }
  return problems
}

// Grafcet de conducción: { nodes, edges, comments } colocados por niveles desde A1 (los pasos hacia
// atrás se dibujan como bucles). comments: { idDeEtapa: descripción del estado }.
export function generateConduction(gemma, { origin = { x: 0, y: 0 }, sheet } = {}) {
  const used = GEMMA_STATES.filter((s) => s.id in gemma.states).map((s) => s.id)
  // Niveles: recorrido en anchura desde A1; lo inalcanzable, al final.
  const level = new Map([['A1', 0]])
  const queue = ['A1']
  while (queue.length) {
    const id = queue.shift()
    for (const t of gemma.transitions) {
      if (t.from === id && !level.has(t.to) && used.includes(t.to)) {
        level.set(t.to, level.get(id) + 1)
        queue.push(t.to)
      }
    }
  }
  let extra = Math.max(0, ...level.values()) + 1
  for (const id of used) if (!level.has(id)) level.set(id, extra++)

  const ROW = 170 // etapa -> transición -> etapa
  const COL = 260
  // Columnas: cada estado sigue en la columna de quien lo alcanza primero (la primera salida sigue
  // recta; las demás abren columna nueva a la derecha). Así la rama de defecto (D1 -> A5 -> A6)
  // queda en su propia columna y no se cruza con la de funcionamiento.
  const column = new Map([['A1', 0]])
  let nextColumn = 1
  for (const id of [...used].sort((a, b) => level.get(a) - level.get(b))) {
    if (!column.has(id)) column.set(id, nextColumn++)
    let first = true
    for (const t of gemma.transitions) {
      if (t.from !== id || column.has(t.to) || level.get(t.to) <= level.get(id)) continue
      column.set(t.to, first ? column.get(id) : nextColumn++)
      first = false
    }
  }
  const nodes = []
  const stepId = new Map()
  const data = (extraData) => (sheet ? { ...extraData, sheet } : extraData)
  const comments = {}
  for (const id of used.sort((a, b) => level.get(a) - level.get(b) || used.indexOf(a) - used.indexOf(b))) {
    const row = level.get(id)
    const col = column.get(id)
    const nodeId = `gemma-${id}`
    stepId.set(id, nodeId)
    const forcing = forcingText(gemma.states[id], gemma.production)
    nodes.push({
      id: nodeId,
      type: 'step',
      position: { x: origin.x + col * COL, y: origin.y + row * ROW },
      data: data({ label: id, initial: id === 'A1', actions: forcing ? [forcing] : [] }),
    })
    comments[nodeId] = `${id}: ${gemmaState(id).name}`
  }
  const edges = []
  for (const [i, t] of gemma.transitions.entries()) {
    const a = nodes.find((n) => n.id === stepId.get(t.from))
    const b = nodes.find((n) => n.id === stepId.get(t.to))
    if (!a || !b) continue
    const tid = `gemma-t${i}`
    // La transición, bajo la etapa de origen (desplazada si sale más de una de la misma etapa).
    const siblings = gemma.transitions.slice(0, i).filter((x) => x.from === t.from).length
    nodes.push({
      id: tid,
      type: 'transition',
      position: { x: a.position.x + siblings * 120, y: a.position.y + 100 },
      data: data({ condition: t.condition }),
    })
    edges.push({ id: `e-${a.id}-${tid}`, source: a.id, target: tid, type: 'grafcet' }, { id: `e-${tid}-${b.id}`, source: tid, target: b.id, type: 'grafcet' })
  }
  return { nodes, edges, comments }
}
