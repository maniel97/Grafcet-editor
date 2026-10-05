// Generador de secuencias neumáticas: «A+ B+ B− A−» -> grafcet, tabla de variables y planta.
//
// - Cilindros de doble efecto, una letra cada uno (A–Z): salidas A+ / A−, finales de carrera a0
//   (dentro) y a1 (fuera).
// - Movimientos simultáneos entre paréntesis: «A+ (B+ C+) B− …» -> una etapa con las dos acciones
//   y una transición que espera a los dos finales de carrera.
// - La posición inicial de cada cilindro es la contraria a su primer movimiento; el ciclo empieza
//   con Marcha y todos en su posición inicial, y vuelve a la etapa 0 al terminar.
// Puro: se prueba sin navegador.

const MINUS = /[−–—]/g

// Texto -> { groups: [[{ cyl, dir }]], errors: [texto], warnings: [texto] }.
export function parseSequence(text) {
  const errors = []
  const warnings = []
  const groups = []
  const src = text.replace(MINUS, '-').replace(/,/g, ' ')
  let open = null
  const re = /\(|\)|([A-Za-z])\s*([+-])|(\S+)/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[0] === '(') {
      if (open) errors.push('Paréntesis dentro de paréntesis: los movimientos simultáneos van en un solo grupo.')
      open = []
    } else if (m[0] === ')') {
      if (!open) errors.push('Sobra un «)».')
      else if (!open.length) errors.push('Paréntesis vacíos.')
      else groups.push(open)
      open = null
    } else if (m[1]) {
      const move = { cyl: m[1].toUpperCase(), dir: m[2] }
      if (open) open.push(move)
      else groups.push([move])
    } else {
      errors.push(`«${m[3]}» no es un movimiento: se escribe la letra del cilindro y + o − (A+, B−…).`)
    }
  }
  if (open) errors.push('Falta cerrar un paréntesis.')
  if (!groups.length && !errors.length) errors.push('Escribe una secuencia, p. ej. A+ B+ B− A−.')

  // Comprobaciones: un cilindro una vez por grupo, sin repetir el mismo sentido seguido, y que
  // termine donde empezó (si no, el ciclo no se puede repetir).
  const last = new Map()
  const first = new Map()
  for (const [i, group] of groups.entries()) {
    const seen = new Set()
    for (const { cyl, dir } of group) {
      if (seen.has(cyl)) errors.push(`El cilindro ${cyl} aparece dos veces en el mismo grupo simultáneo (paso ${i + 1}).`)
      seen.add(cyl)
      if (last.get(cyl) === dir) errors.push(`${cyl}${dir} dos veces seguidas (paso ${i + 1}): el cilindro ya está ${dir === '+' ? 'fuera' : 'dentro'}.`)
      if (!first.has(cyl)) first.set(cyl, dir)
      last.set(cyl, dir)
    }
  }
  for (const [cyl, dir] of first) {
    if (last.get(cyl) === dir) warnings.push(`El cilindro ${cyl} termina ${dir === '+' ? 'fuera' : 'dentro'} y empezó ${dir === '+' ? 'dentro' : 'fuera'}: el ciclo no se puede repetir.`)
  }
  return { groups, errors, warnings }
}

const sensor = (cyl, dir) => `${cyl.toLowerCase()}${dir === '+' ? '1' : '0'}`
const show = (groups) => groups.map((g) => (g.length > 1 ? `(${g.map((m) => m.cyl + m.dir).join(' ')})` : g[0].cyl + g[0].dir)).join(' ')

// Grupos -> texto normalizado: «A+ (B+ C−) B− A−».
export const sequenceText = (groups) =>
  groups.map((g) => (g.length > 1 ? `(${g.map((m) => m.cyl + (m.dir === '+' ? '+' : '−')).join(' ')})` : g[0].cyl + (g[0].dir === '+' ? '+' : '−'))).join(' ')

// Grupos -> proyecto { name, nodes, edges, plc } (con planta si withScene). plc.sequence: la secuencia,
// que el diagrama espacio-fase de la simulación usa como «secuencia esperada».
export function buildPneumatic(groups, { withScene = true } = {}) {
  const cylinders = [...new Set(groups.flat().map((m) => m.cyl))]
  const first = new Map()
  for (const m of groups.flat()) if (!first.has(m.cyl)) first.set(m.cyl, m.dir)
  // Posición inicial: la contraria al primer movimiento.
  const initialSensors = cylinders.map((c) => sensor(c, first.get(c) === '+' ? '-' : '+'))

  const X = 200
  const nodes = [{ id: 's0', type: 'step', position: { x: X, y: 0 }, data: { label: '0', initial: true, actions: [] } }]
  const edges = []
  const link = (source, target) => edges.push({ id: `${source}-${target}`, source, target, type: 'grafcet' })
  let y = 100
  let prev = 's0'
  let condition = ['Marcha', ...initialSensors].join(' · ')
  for (const [i, group] of groups.entries()) {
    const t = `t${i + 1}`
    const s = `s${i + 1}`
    nodes.push({ id: t, type: 'transition', position: { x: X, y }, data: { condition } })
    nodes.push({ id: s, type: 'step', position: { x: X, y: y + 70 }, data: { label: String(i + 1), actions: group.map((m) => `${m.cyl}${m.dir}`) } })
    link(prev, t)
    link(t, s)
    condition = group.map((m) => sensor(m.cyl, m.dir)).join(' · ')
    prev = s
    y += 170
  }
  const tEnd = `t${groups.length + 1}`
  nodes.push({ id: tEnd, type: 'transition', position: { x: X, y }, data: { condition } })
  link(prev, tEnd)
  link(tEnd, 's0')

  const name = `Secuencia ${show(groups).replace(/-/g, '−')}`
  const io = `- Entradas: \`Marcha\`, ${cylinders.map((c) => `\`${c.toLowerCase()}0\`, \`${c.toLowerCase()}1\``).join(', ')}\n- Salidas: ${cylinders.map((c) => `\`${c}+\`, \`${c}-\``).join(', ')}`
  const lines = Math.ceil(io.length / 40) + 8
  nodes.push({
    id: 'nota',
    type: 'note',
    position: { x: 560, y: 0 },
    width: 320,
    height: Math.max(220, lines * 18),
    data: {
      color: 'yellow',
      text: `# ${name}\nGenerado con el generador de secuencias neumáticas: una etapa por movimiento (o grupo simultáneo) y, en cada transición, el final de carrera del movimiento anterior.\n\n${io}\n\nPruébalo: **Simular** y pulsa Marcha en la planta.`,
    },
  })

  const variables = { Marcha: { type: 'input' } }
  for (const c of cylinders) {
    variables[`${c}+`] = { type: 'output' }
    variables[`${c}-`] = { type: 'output' }
    variables[`${c.toLowerCase()}0`] = { type: 'input' }
    variables[`${c.toLowerCase()}1`] = { type: 'input' }
  }
  const plc = { variables, sequence: sequenceText(groups) }
  if (withScene) {
    plc.scene = {
      elements: [
        { id: 'marcha', type: 'button', x: 0, y: 0, rot: 0, variable: 'Marcha', contact: 'NO', color: 'green', text: 'Marcha', place: 'desk' },
        ...cylinders.map((c, i) => ({
          id: `cil${c}`,
          type: 'cylinder',
          x: 120,
          y: 100 + i * 110,
          rot: 0,
          extend: `${c}+`,
          retract: `${c}-`,
          retracted: `${c.toLowerCase()}0`,
          extended: `${c.toLowerCase()}1`,
          stroke: 120,
          time: 1,
          // Empieza fuera si su primer movimiento es «−».
          initial: first.get(c) === '-' ? 1 : 0,
          text: c,
        })),
      ],
    }
  }
  return { name, nodes, edges, plc }
}
