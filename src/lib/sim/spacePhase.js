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

// Cilindros de la escena, en el orden en que se dibujan las filas: [{ id, name }].
export function cylindersOf(scene) {
  return (scene?.elements ?? []).filter((e) => e.type === 'cylinder').map((e) => ({ id: e.id, name: String(e.text || e.id) }))
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

// Qué hace cada cilindro entre dos muestras: '+', '-' o '' (quieto).
// Posición en una muestra; un cilindro añadido a mitad de la simulación no está en las anteriores:
// estaba (como todo cilindro nuevo) dentro.
const at = (sample, id) => sample.pos[id] ?? 0

const motionKey = (a, b, ids) => ids.map((id) => (at(b, id) - at(a, id) > MOVING ? '+' : at(a, id) - at(b, id) > MOVING ? '-' : '')).join('|')

// Registro -> { phases: [{ start, end }], rows: [{ id, name, levels: [pos al empezar cada fase…, pos al acabar la última] }] }
// o null si no ha habido movimiento.
export function buildSpacePhase(trace, cylinders) {
  if (!trace?.length || !cylinders.length) return null
  const ids = cylinders.map((c) => c.id)
  const byPhase = trace.some((s) => s.phase != null)

  // Instantes de corte entre fases (índices del registro). El corte va en la última muestra de la
  // fase que acaba: lo que se ha movido hasta la primera muestra de la nueva fase es ya de ella (la
  // simulación avanza a saltos y en el mismo salto cambia la etapa y empieza el movimiento).
  const cuts = [0]
  const cut = (i) => i > cuts[cuts.length - 1] && cuts.push(i)
  let lastKey = null
  for (let i = 1; i < trace.length; i++) {
    if (byPhase) {
      if (trace[i].phase === trace[i - 1].phase) continue
      // En el salto del cambio de etapa: si algún cilindro sigue el movimiento que traía, ese
      // tramo es el final de la fase que acaba (corte después); si solo empiezan movimientos, son
      // de la fase nueva (corte antes).
      const now = motionKey(trace[i - 1], trace[i], ids).split('|')
      const before = i > 1 ? motionKey(trace[i - 2], trace[i - 1], ids).split('|') : []
      // Una fase sin movimiento (una espera) no deja muestras propias: su final es esta muestra.
      const at = now.some((d, k) => d && d === before[k]) || i - 1 <= cuts[cuts.length - 1] ? i : i - 1
      cut(at)
    } else {
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
      levels: [...phases.map((p) => at(trace[p.from], c.id)), at(trace[phases[phases.length - 1].to], c.id)],
    })),
    // Para el espacio-tiempo: las muestras del tramo dibujado.
    samples: trace.slice(phases[0].from, phases[phases.length - 1].to + 1),
  }
}
