// Catálogo S7-200 (CPU y módulos de ampliación), sugerencia de configuración y mapa de
// direcciones de entradas y salidas según la configuración elegida.
// Datos de los manuales de Siemens del S7-200; revisados con el usuario el 2026-10-03.
//
// Reglas de direccionamiento:
// - Digitales: cada módulo empieza en el byte siguiente al anterior y ocupa bytes enteros (los
//   bits sobrantes de un byte no se reutilizan). Tras la CPU 224, el primer módulo de entradas
//   empieza en I2.0.
// - Analógicas: se asignan de dos en dos canales (AIW0, AIW2...): un módulo de 4 entradas ocupa
//   AIW0–AIW6; una salida analógica reserva dos palabras (EM235: AQW0 y AQW2 reservada). En la
//   224XP las integradas son AIW0, AIW2 y AQW0, y las ampliaciones empiezan en AIW4 y AQW4.

export const CPUS = [
  { id: '221', label: 'CPU 221', di: 6, do: 4, ai: 0, ao: 0, maxModules: 0, vBytes: 2048 },
  { id: '222', label: 'CPU 222', di: 8, do: 6, ai: 0, ao: 0, maxModules: 2, vBytes: 2048 },
  { id: '224', label: 'CPU 224', di: 14, do: 10, ai: 0, ao: 0, maxModules: 7, vBytes: 8192 },
  { id: '224XP', label: 'CPU 224XP', di: 14, do: 10, ai: 2, ao: 1, maxModules: 7, vBytes: 10240, note: 'Analógicas integradas solo de tensión' },
  { id: '226', label: 'CPU 226', di: 24, do: 16, ai: 0, ao: 0, maxModules: 7, vBytes: 10240 },
]

export const MODULES = [
  { id: 'EM221-8', label: 'EM221 8 E', di: 8, do: 0, ai: 0, ao: 0 },
  { id: 'EM221-16', label: 'EM221 16 E', di: 16, do: 0, ai: 0, ao: 0 },
  { id: 'EM222-4', label: 'EM222 4 S relé', di: 0, do: 4, ai: 0, ao: 0 },
  { id: 'EM222-8', label: 'EM222 8 S', di: 0, do: 8, ai: 0, ao: 0 },
  { id: 'EM223-4', label: 'EM223 4 E / 4 S', di: 4, do: 4, ai: 0, ao: 0 },
  { id: 'EM223-8', label: 'EM223 8 E / 8 S', di: 8, do: 8, ai: 0, ao: 0 },
  { id: 'EM223-16', label: 'EM223 16 E / 16 S', di: 16, do: 16, ai: 0, ao: 0 },
  { id: 'EM223-32', label: 'EM223 32 E / 32 S', di: 32, do: 32, ai: 0, ao: 0 },
  { id: 'EM231-4', label: 'EM231 4 EA', di: 0, do: 0, ai: 4, ao: 0 },
  { id: 'EM231-8', label: 'EM231 8 EA', di: 0, do: 0, ai: 8, ao: 0 },
  { id: 'EM232-2', label: 'EM232 2 SA', di: 0, do: 0, ai: 0, ao: 2 },
  { id: 'EM232-4', label: 'EM232 4 SA', di: 0, do: 0, ai: 0, ao: 4 },
  { id: 'EM235', label: 'EM235 4 EA / 1 SA', di: 0, do: 0, ai: 4, ao: 1 },
]
// Límites de la imagen de proceso (CPU + ampliaciones).
export const LIMITS = { di: 128, do: 128, ai: 32, ao: 32 }
export const DEFAULT_MARGIN = 0.2

export const cpuById = (id) => CPUS.find((c) => c.id === id)
export const moduleById = (id) => MODULES.find((m) => m.id === id)

const totals = (cpu, modules) =>
  modules.map(moduleById).reduce((t, m) => ({ di: t.di + m.di, do: t.do + m.do, ai: t.ai + m.ai, ao: t.ao + m.ao }), {
    di: cpu.di,
    do: cpu.do,
    ai: cpu.ai,
    ao: cpu.ao,
  })

// Módulos para cubrir lo que falta: analógicas (EM235 si faltan entradas y salidas a la vez), luego
// digitales combinadas (EM223) y después sueltas (EM221 / EM222), siempre el menor que basta.
function modulesFor(missing) {
  let { di, do: dout, ai, ao } = missing
  const out = []
  while (ai > 0 && ao > 0) {
    out.push('EM235')
    ai -= 4
    ao -= 1
  }
  while (ai > 0) {
    out.push(ai > 4 ? 'EM231-8' : 'EM231-4')
    ai -= ai > 4 ? 8 : 4
  }
  while (ao > 0) {
    out.push(ao > 2 ? 'EM232-4' : 'EM232-2')
    ao -= ao > 2 ? 4 : 2
  }
  while (di > 0 && dout > 0) {
    const n = [4, 8, 16, 32].find((k) => k >= Math.min(di, dout)) ?? 32
    out.push(`EM223-${n}`)
    di -= n
    dout -= n
  }
  while (di > 0) {
    out.push(di > 8 ? 'EM221-16' : 'EM221-8')
    di -= di > 8 ? 16 : 8
  }
  while (dout > 0) {
    out.push(dout > 4 ? 'EM222-8' : 'EM222-4')
    dout -= dout > 4 ? 8 : 4
  }
  return out
}

// needs: { di, do, ai, ao } usados. Con el margen de reserva, la CPU más pequeña que basta; si no
// cabe en ninguna sola, la que necesita menos módulos. Devuelve { cpu, modules, required } o null.
export function suggestConfiguration(needs, margin = DEFAULT_MARGIN) {
  const required = Object.fromEntries(['di', 'do', 'ai', 'ao'].map((k) => [k, Math.ceil((needs[k] ?? 0) * (1 + margin))]))
  let best = null
  for (const [order, cpu] of CPUS.entries()) {
    const missing = Object.fromEntries(Object.keys(required).map((k) => [k, Math.max(0, required[k] - cpu[k])]))
    const modules = modulesFor(missing)
    if (modules.length > cpu.maxModules) continue
    const t = totals(cpu, modules)
    if (Object.keys(LIMITS).some((k) => t[k] > LIMITS[k])) continue
    const score = modules.length * 10 + order
    if (!best || score < best.score) best = { cpu: cpu.id, modules, required, score }
  }
  if (!best) return null
  const { score, ...rest } = best
  void score
  return rest
}

const bitName = (area, byte, bit) => `${area}${byte}.${bit}`

// Direcciones de E/S que existen con la configuración, y a qué pertenece cada tramo.
// Devuelve { inputs: [...], outputs: [...], analogIn: [...], analogOut: [...], parts: [{ label, ranges }] }.
export function ioMap({ cpu: cpuId, modules = [] }) {
  const cpu = cpuById(cpuId)
  if (!cpu) return null
  const map = { inputs: [], outputs: [], analogIn: [], analogOut: [], parts: [] }
  let inByte = 0
  let outByte = 0
  let aiWord = 0
  let aoWord = 0
  const digital = (count, area, startByte, list) => {
    const added = []
    for (let i = 0; i < count; i++) added.push(bitName(area, startByte + Math.floor(i / 8), i % 8))
    list.push(...added)
    return { added, bytes: Math.ceil(count / 8) }
  }
  const analog = (count, area, startWord, list) => {
    const added = []
    for (let i = 0; i < count; i++) added.push(`${area}${startWord + i * 2}`)
    list.push(...added)
    // De dos en dos canales: 1 canal reserva 2 palabras.
    return { added, words: Math.ceil(count / 2) * 2 * 2 }
  }
  const range = (added) => (added.length ? (added.length === 1 ? added[0] : `${added[0]}–${added.at(-1)}`) : null)
  const place = (label, unit) => {
    const ranges = []
    if (unit.di) {
      const r = digital(unit.di, 'I', inByte, map.inputs)
      inByte += r.bytes
      ranges.push(range(r.added))
    }
    if (unit.do) {
      const r = digital(unit.do, 'Q', outByte, map.outputs)
      outByte += r.bytes
      ranges.push(range(r.added))
    }
    if (unit.ai) {
      const r = analog(unit.ai, 'AIW', aiWord, map.analogIn)
      aiWord += r.words
      ranges.push(range(r.added))
    }
    if (unit.ao) {
      const r = analog(unit.ao, 'AQW', aoWord, map.analogOut)
      aoWord += r.words
      ranges.push(range(r.added))
    }
    map.parts.push({ label, ranges })
  }
  place(cpu.label, cpu)
  for (const id of modules) place(moduleById(id)?.label ?? id, moduleById(id) ?? {})
  return map
}

// Lo que usa el proyecto: entradas y salidas digitales (las analógicas, en el paso de analógicas).
// `types`: tipo efectivo de cada variable [{ type, numeric }].
export function countNeeds(variables) {
  const needs = { di: 0, do: 0, ai: 0, ao: 0 }
  for (const v of variables) {
    if (v.type === 'input' && !v.numeric) needs.di++
    else if (v.type === 'output' && !v.numeric) needs.do++
    else if (v.type === 'analogIn') needs.ai++
    else if (v.type === 'analogOut') needs.ao++
  }
  return needs
}
