// Diagrama espacio-fase (y espacio-tiempo) de los cilindros de la planta, a partir de lo que ha
// pasado en la simulación. Puro: se prueba sin navegador.
//
// - La simulación va anotando un registro (trace) de muestras { t, pos: { id: 0..1 }, phase }:
//   la posición de cada cilindro (0 = dentro, 1 = fuera) y la clave de las etapas activas
//   (phase; null con el autómata, que no tiene etapas).
// - Una fase es un tramo entre dos cambios de etapas activas. Sin etapas (autómata), entre dos
//   cambios de lo que se mueve (qué cilindros avanzan, retroceden o están quietos).
// - El diagrama empieza en la fase en que arranca el primer movimiento y acaba en la última fase
//   con movimiento (las esperas de en medio, p. ej. una temporización, se quedan: son fases).

export const MAX_TRACE = 6000
export const MAX_PHASES = 24
const MOVING = 0.002 // cambio de posición mínimo entre muestras para contar como movimiento
const POS_STEP = 0.005 // resolución con la que se anotan las posiciones
const MIN_TRAVEL = 0.05 // recorrido mínimo (fracción de la carrera) para que una fase cuente como movimiento

// Cilindros de la escena, en el orden en que se dibujan las filas: [{ id, name, letter, sensors }]
// letter: la del convenio de neumática si su salida se llama «A+» (para comparar con una secuencia);
// sensors: [dentro, fuera], sus finales de carrera (para las líneas de señal).
export function cylindersOf(scene) {
  return (scene?.elements ?? [])
    .filter((e) => e.type === 'cylinder')
    .map((e) => ({ id: e.id, name: String(e.text || e.id), letter: /^([A-Za-z])\+$/.exec(e.extend ?? '')?.[1]?.toUpperCase() ?? null, sensors: [e.retracted || '', e.extended || ''] }))
}

const round = (v) => Math.round(v / POS_STEP) * POS_STEP

// Muestra del instante actual; null si no hay cilindros.
export function motionSample(t, worldState, cylinders, phase) {
  if (!cylinders.length) return null
  const pos = {}
  for (const c of cylinders) pos[c.id] = round(worldState?.pos?.[c.id] ?? 0)
  return { t, pos, phase }
}

const samePos = (a, b) => Object.keys(b).every((k) => a[k] === b[k]) && Object.keys(a).length === Object.keys(b).length

// Añade la muestra al registro si cambia algo (posición o fase).
export function pushMotion(trace, sample) {
  if (!sample) return trace
  const last = trace[trace.length - 1]
  if (last && last.phase === sample.phase && samePos(last.pos, sample.pos)) return trace
  const next = [...trace, sample]
  return next.length > MAX_TRACE ? next.slice(-MAX_TRACE) : next
}

// Posición en una muestra; un cilindro añadido a mitad de la simulación no está en las anteriores:
// estaba (como todo cilindro nuevo) dentro.
const at = (sample, id) => sample.pos[id] ?? 0

// Qué hace cada cilindro entre dos muestras: '+', '-' o '' (quieto).
const motionKey = (a, b, ids) => ids.map((id) => (at(b, id) - at(a, id) > MOVING ? '+' : at(a, id) - at(b, id) > MOVING ? '-' : '')).join('|')

// Registro -> { phases: [{ start, end }], rows: [{ id, name, levels: [pos al empezar cada fase…, pos al acabar la última] }] }
// o null si no ha habido movimiento.
export function buildSpacePhase(source, cylinders) {
  if (!source?.length || !cylinders.length) return null
  const ids = cylinders.map((c) => c.id)
  const byPhase = source.some((s) => s.phase != null)

  // Cortes entre fases (índices del registro). La simulación avanza a saltos y en el mismo salto
  // cambia la etapa y se mueven los cilindros:
  // - si algún cilindro sigue el movimiento que traía, ese tramo es el final de la fase que acaba
  //   (corte en la muestra del cambio);
  // - si solo empiezan movimientos, son de la fase nueva: se añade una muestra en el instante del
  //   cambio con las posiciones de antes (no se movía nada: si no, habría muestras), y el corte va
  //   ahí. Así una espera, o el reposo inicial, acaba exactamente donde estaba.
  const trace = []
  const cuts = [0]
  const cut = (i) => i > cuts[cuts.length - 1] && cuts.push(i)
  let lastKey = null
  for (let i = 0; i < source.length; i++) {
    if (byPhase && i > 0 && source[i].phase !== source[i - 1].phase) {
      const now = motionKey(source[i - 1], source[i], ids).split('|')
      const before = i > 1 ? motionKey(source[i - 2], source[i - 1], ids).split('|') : []
      if (now.some((d, k) => d && d === before[k])) cut(trace.length)
      else {
        trace.push({ ...source[i - 1], t: source[i].t })
        cut(trace.length - 1)
      }
    }
    trace.push(source[i])
    if (!byPhase && i > 0) {
      const key = motionKey(trace[i - 1], trace[i], ids)
      if (lastKey !== null && key !== lastKey) cut(i - 1)
      lastKey = key
    }
  }
  const lastIndex = trace.length - 1
  if (cuts[cuts.length - 1] !== lastIndex) cuts.push(lastIndex)

  // Fases con movimiento: algún cilindro recorre en ella al menos MIN_TRAVEL de su carrera. Así
  // el resto de un movimiento que cae al otro lado de un corte (un salto de la simulación) no
  // cuenta como una fase más al principio o al final del diagrama.
  let phases = []
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k]
    const b = cuts[k + 1]
    const travel = (id) => {
      let sum = 0
      for (let i = a + 1; i <= b; i++) sum += Math.abs(at(trace[i], id) - at(trace[i - 1], id))
      return sum
    }
    phases.push({ from: a, to: b, moves: ids.some((id) => travel(id) >= MIN_TRAVEL) })
  }
  const first = phases.findIndex((p) => p.moves)
  if (first < 0) return null
  let last = phases.length - 1
  while (!phases[last].moves) last--
  phases = phases.slice(first, last + 1).slice(-MAX_PHASES)

  return {
    phases: phases.map((p) => ({ start: trace[p.from].t, end: trace[p.to].t })),
    rows: cylinders.map((c) => ({
      id: c.id,
      name: c.name,
      letter: c.letter,
      sensors: c.sensors,
      levels: [...phases.map((p) => at(trace[p.from], c.id)), at(trace[phases[phases.length - 1].to], c.id)],
    })),
    // Para el espacio-tiempo: las muestras del tramo dibujado.
    samples: trace.slice(phases[0].from, phases[phases.length - 1].to + 1),
  }
}

// --- Diagrama teórico, comparación y líneas de señal ------------------------------------------

// Secuencia (lib/pneumatic.js parseSequence: [[{ cyl, dir }]]) -> diagrama teórico con la misma
// forma que buildSpacePhase: una fase por grupo; cada cilindro empieza en la posición contraria a
// su primer movimiento (como el generador). Las fases duran 1 (para el espacio-tiempo).
export function theoreticalSpacePhase(groups) {
  if (!groups?.length) return null
  const names = [...new Set(groups.flat().map((m) => m.cyl))]
  const level = {}
  for (const name of names) level[name] = groups.flat().find((m) => m.cyl === name).dir === '+' ? 0 : 1
  const rows = names.map((name) => ({ id: name, name, sensors: [`${name.toLowerCase()}0`, `${name.toLowerCase()}1`], levels: [level[name]] }))
  for (const group of groups) {
    for (const m of group) level[m.cyl] = m.dir === '+' ? 1 : 0
    for (const r of rows) r.levels.push(level[r.name])
  }
  const phases = groups.map((_, i) => ({ start: i, end: i + 1 }))
  const samples = phases
    .map((p, i) => ({ t: p.start, pos: Object.fromEntries(rows.map((r) => [r.id, r.levels[i]])) }))
    .concat({ t: groups.length, pos: Object.fromEntries(rows.map((r) => [r.id, r.levels[groups.length]])) })
  return { phases, rows, samples }
}

// Movimientos de cada fase: [['A+'], ['B+', 'C−'], [] (espera)…]. Solo cuentan los recorridos de
// al menos media carrera (un movimiento a medias no es el movimiento pedido).
export function movesOf(diagram) {
  return diagram.phases.map((_, i) =>
    diagram.rows.flatMap((r) => {
      const d = r.levels[i + 1] - r.levels[i]
      return Math.abs(d) >= 0.5 ? [`${(r.letter ?? r.name).toUpperCase()}${d > 0 ? '+' : '−'}`] : []
    }),
  )
}

const sameMoves = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

// Lo grabado frente a lo esperado. Las fases sin movimiento de lo grabado (esperas) no cuentan;
// se compara el primer ciclo (tantas fases con movimiento como tiene lo esperado).
// -> { ok, phase: n.º de la primera fase distinta (1…), expected: ['B+'], got: ['A−'] | null }
export function compareSpacePhase(recorded, expected) {
  if (!recorded || !expected) return null
  const want = movesOf(expected)
  const got = movesOf(recorded).filter((m) => m.length)
  for (let i = 0; i < want.length; i++) {
    if (i >= got.length) return { ok: false, phase: i + 1, expected: want[i], got: null }
    if (!sameMoves(want[i], got[i])) return { ok: false, phase: i + 1, expected: want[i], got: got[i] }
  }
  return { ok: true }
}

// Líneas de señal: en cada frontera entre fases (1…n−1), el final de carrera al que llega lo que se
// movía en la fase anterior y lo que empieza a moverse en la siguiente.
// -> [{ boundary, from: { row, level }, to: { row, level } | null, sensor }]
export function signalsOf(diagram) {
  const out = []
  const n = diagram.phases.length
  for (let i = 1; i < n; i++) {
    const moved = diagram.rows.findIndex((r) => Math.abs(r.levels[i] - r.levels[i - 1]) >= 0.5)
    if (moved < 0) continue
    const r = diagram.rows[moved]
    const level = r.levels[i] >= 0.5 ? 1 : 0
    const next = diagram.rows.findIndex((x) => Math.abs(x.levels[i + 1] - x.levels[i]) >= 0.5)
    out.push({
      boundary: i,
      from: { row: moved, level },
      to: next < 0 ? null : { row: next, level: diagram.rows[next].levels[i] >= 0.5 ? 1 : 0 },
      sensor: r.sensors?.[level] || `${r.name.toLowerCase()}${level}`,
    })
  }
  return out
}
