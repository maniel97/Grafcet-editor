// Tabla de variables (asignación de direcciones de PLC) y su asignación automática.
//
// Estado guardado en el proyecto (`plc`):
// {
//   scheme: 'siemens' | 'iec',
//   showAddresses: boolean,
//   steps:     { [stepNodeId]: { address, comment } }    // por id: renumerar no lo rompe
//   variables: { [symbol]: { type, address, comment, preset? } }
// }

import { resolveStepPrefix, stepVar } from './stepNames'

export const EMPTY_PLC = { scheme: 'siemens', showAddresses: false, steps: {}, variables: {} }

export const VARIABLE_TYPES = [
  { id: 'input', label: 'Entrada', plural: 'Entradas', area: 'I' },
  { id: 'output', label: 'Salida', plural: 'Salidas', area: 'Q' },
  { id: 'memory', label: 'Marca', plural: 'Marcas', area: 'M' },
  { id: 'timer', label: 'Temporizador', plural: 'Temporizadores', area: 'T' },
  { id: 'counter', label: 'Contador', plural: 'Contadores', area: 'C' },
]
export const typeInfo = (id) => VARIABLE_TYPES.find((t) => t.id === id) ?? VARIABLE_TYPES[0]

export const SCHEMES = [
  { id: 'siemens', label: 'Siemens (I0.0, Q0.0, M0.0, T1)' },
  { id: 'iec', label: 'IEC 61131-3 (%IX0.0, %QX0.0, %MX0.0)' },
  { id: 's7200', label: 'S7-200 / Micro/WIN (I0.0, Q0.0, V0.0, VW, T37)' },
]

// S7-200: solo 32 bytes de marcas (M0.0–M31.7), así que las etapas van en memoria V (V0.0…), las
// marcas internas del ladder detrás (lib/ladder/generate.js) y las palabras en VW100…; los
// temporizadores de 100 ms empiezan en T37.
export const S7200 = { stepArea: 'V', wordArea: 'V', wordStart: 100, timerStart: 37, internalStartByte: 20 }

// Primer byte de marcas para variables de usuario: deja las primeras para las etapas.
const MEMORY_START_BYTE = 10
// Palabras (variables numéricas: contadores en marcas, comparaciones...). Zona aparte de los bits
// para que no se solapen: MW100 en adelante; IW/QW desde 64 (zona analógica habitual en S7-300).
const WORD_START_BYTE = { I: 64, Q: 64, M: 100 }

export const formatWord = (area, byte, scheme) => (scheme === 'iec' ? `%${area}W${byte}` : `${area}W${byte}`)

export function formatBit(area, index, scheme) {
  const byte = Math.floor(index / 8)
  const bit = index % 8
  return scheme === 'iec' ? `%${area}X${byte}.${bit}` : `${area}${byte}.${bit}`
}

// Interpreta una dirección: { area, index } para bits (I/Q/M), { area, word } para palabras
// (IW/QW/MW) y { area, number } para T/C.
export function parseAddress(address) {
  const a = String(address ?? '').trim().toUpperCase()
  let m = /^%?(SM|[IQMV])X?(\d+)\.([0-7])$/.exec(a)
  if (m) return { area: m[1], index: Number(m[2]) * 8 + Number(m[3]) }
  m = /^%?([IQMV])W(\d+)$/.exec(a)
  if (m) return { area: m[1], word: Number(m[2]) }
  m = /^%?([TC])(\d+)$/.exec(a)
  if (m) return { area: m[1], number: Number(m[2]) }
  return null
}

// Reparte direcciones libres. `used`: Set de direcciones ocupadas (en mayúsculas).
function makeAllocator(scheme, used) {
  const s7200 = scheme === 's7200'
  const cursors = {
    bit: { I: 0, Q: 0, M: s7200 ? 0 : MEMORY_START_BYTE * 8, V: 0 },
    word: { ...WORD_START_BYTE, V: S7200.wordStart },
    num: { T: s7200 ? S7200.timerStart : 1, C: s7200 ? 0 : 1 },
  }
  return {
    cursors,
    next(area, numeric) {
      // S7-200: las palabras de marcas van en VW (la zona M es muy pequeña).
      if (s7200 && numeric && area === 'M') area = S7200.wordArea
      const kind = ['T', 'C'].includes(area) ? 'num' : numeric ? 'word' : 'bit'
      const make = (i) => (kind === 'bit' ? formatBit(area, i, scheme) : kind === 'word' ? formatWord(area, i, scheme) : `${area}${i}`)
      let i = cursors[kind][area]
      while (used.has(make(i).toUpperCase())) i += kind === 'word' ? 2 : 1
      used.add(make(i).toUpperCase())
      cursors[kind][area] = i + (kind === 'word' ? 2 : 1)
      return make(i)
    },
  }
}

const stepOrder = (a, b) => {
  const na = parseInt(a.data.label, 10)
  const nb = parseInt(b.data.label, 10)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
  return String(a.data.label).localeCompare(String(b.data.label), 'es', { numeric: true })
}

// Asigna direcciones automáticamente.
// - overwrite=false: solo rellena las vacías, sin reutilizar direcciones ya ocupadas.
// - overwrite=true: reasigna todo de forma ordenada (etapas por número, variables por aparición).
// `symbols` es el Map de extractSymbols.
export function autoAssign(plc, stepNodes, symbols, { overwrite = false } = {}) {
  const scheme = plc.scheme
  const used = new Set()
  const keep = (entry) => !overwrite && entry?.address?.trim()
  const remember = (address) => address && used.add(String(address).trim().toUpperCase())

  const steps = { ...plc.steps }
  const variables = { ...plc.variables }
  for (const s of stepNodes) if (keep(steps[s.id])) remember(steps[s.id].address)
  for (const [name] of symbols) if (keep(variables[name])) remember(variables[name].address)

  const allocator = makeAllocator(scheme, used)

  // Etapas: marcas consecutivas desde M0.0 (en S7-200, V0.0) en orden de número de etapa.
  const stepArea = scheme === 's7200' ? S7200.stepArea : 'M'
  allocator.cursors.bit[stepArea] = 0
  for (const s of [...stepNodes].sort(stepOrder)) {
    if (keep(steps[s.id])) continue
    steps[s.id] = { ...steps[s.id], address: allocator.next(stepArea) }
  }
  // Las marcas de usuario empiezan detrás de las etapas (y nunca antes de M10.0); en S7-200 las
  // etapas no están en M y las marcas empiezan en M0.0.
  if (stepArea === 'M') allocator.cursors.bit.M = Math.max(MEMORY_START_BYTE * 8, Math.ceil(allocator.cursors.bit.M / 8) * 8)

  for (const [name, found] of symbols) {
    const current = variables[name] ?? {}
    const type = current.type ?? found.type
    const entry = { ...current, type, ...(found.preset && !current.preset ? { preset: found.preset } : {}) }
    if (!keep(current)) entry.address = allocator.next(typeInfo(type).area, found.numeric)
    variables[name] = entry
  }

  return { ...plc, steps, variables }
}

// Todas las direcciones en uso (en mayúsculas), opcionalmente sin contar la de `exceptSymbol`.
function usedAddresses(plc, stepNodes, symbols, exceptSymbol) {
  const used = new Set()
  for (const s of stepNodes) if (plc.steps[s.id]?.address?.trim()) used.add(plc.steps[s.id].address.trim().toUpperCase())
  for (const [name] of symbols) {
    const address = plc.variables[name]?.address?.trim()
    if (address && name !== exceptSymbol) used.add(address.toUpperCase())
  }
  return used
}

// Direcciones asignadas a más de una etapa o variable.
export function duplicatedAddresses(plc, stepNodes, symbols) {
  const count = new Map()
  const bump = (a) => {
    const key = a?.trim().toUpperCase()
    if (key) count.set(key, (count.get(key) ?? 0) + 1)
  }
  for (const s of stepNodes) bump(plc.steps[s.id]?.address)
  for (const [name] of symbols) bump(plc.variables[name]?.address)
  return new Set([...count].filter(([, n]) => n > 1).map(([a]) => a))
}

// Cambia el tipo de una variable. Si su dirección ya no encaja con el área del tipo nuevo
// (p. ej. I0.3 al pasar a Marca), le asigna la primera dirección libre del área correcta.
export function changeVariableType(plc, name, type, stepNodes, symbols) {
  const entry = { ...plc.variables[name], type }
  const area = typeInfo(type).area
  const numeric = !!symbols.get(name)?.numeric
  const parsed = parseAddress(entry.address)
  const fits = parsed && parsed.area === area && (['T', 'C'].includes(area) || (parsed.word !== undefined) === numeric)
  if (!fits) entry.address = makeAllocator(plc.scheme, usedAddresses(plc, stepNodes, symbols, name)).next(area, numeric)
  return { ...plc, variables: { ...plc.variables, [name]: entry } }
}

const NEW_NAME = { input: 'Entrada', output: 'Salida', memory: 'Marca', timer: 'Temporizador', counter: 'Contador' }
const DEFAULT_PRESET = { timer: '5s', counter: '10' }

// Añade a mano una variable aún no usada en el diagrama (p. ej. una seta de emergencia que se
// usará más adelante), con nombre provisional único y la primera dirección libre de su área.
// Devuelve { plc, name }.
export function addVariable(plc, type, stepNodes, symbols) {
  let n = 1
  while (symbols.has(`${NEW_NAME[type]}${n}`) || plc.variables[`${NEW_NAME[type]}${n}`]) n++
  const name = `${NEW_NAME[type]}${n}`
  const withEntry = {
    ...plc,
    variables: { ...plc.variables, [name]: { type, address: '', ...(DEFAULT_PRESET[type] ? { preset: DEFAULT_PRESET[type] } : {}) } },
  }
  return { plc: changeVariableType(withEntry, name, type, stepNodes, symbols), name }
}

// Renombra una variable de la tabla. Solo tiene sentido para las que no se usan en el diagrama
// (las usadas toman el nombre del texto de receptividades y acciones). Devuelve null si el
// nombre nuevo no es válido o ya existe.
export function renameVariable(plc, oldName, newName, symbols) {
  const name = newName.trim()
  if (!name || name === oldName) return null
  if (symbols.has(name) || plc.variables[name]) return null
  const variables = {}
  for (const [key, entry] of Object.entries(plc.variables)) variables[key === oldName ? name : key] = entry
  return { ...plc, variables }
}

export function deleteVariable(plc, name) {
  const variables = { ...plc.variables }
  delete variables[name]
  return { ...plc, variables }
}

// Comprobaciones de la tabla para el panel Verificar. Solo revisa lo que tiene dirección:
// la tabla es opcional hasta que se quiera pasar a ladder.
export function validatePlc(plc, stepNodes, symbols) {
  const issues = []
  const owners = new Map() // dirección -> [{ label, nodeIds }]
  const own = (address, label, nodeIds) => {
    const key = String(address).trim().toUpperCase()
    owners.set(key, [...(owners.get(key) ?? []), { label, nodeIds }])
  }

  for (const s of stepNodes) {
    const address = plc.steps[s.id]?.address?.trim()
    if (!address) continue
    const parsed = parseAddress(address)
    if (!parsed) issues.push({ severity: 'warning', message: `Etapa ${s.data.label}: dirección «${address}» con formato no reconocido.`, nodeIds: [s.id] })
    else if (parsed.area !== 'M')
      issues.push({ severity: 'warning', message: `Etapa ${s.data.label}: la variable de etapa debería ser una marca (M), no ${address}.`, nodeIds: [s.id] })
    own(address, `etapa ${s.data.label}`, [s.id])
  }

  for (const [name, found] of symbols) {
    const entry = plc.variables[name]
    const address = entry?.address?.trim()
    if (!address) continue
    const nodeIds = [...found.uses]
    const parsed = parseAddress(address)
    const expected = typeInfo(entry.type ?? found.type).area
    if (!parsed) issues.push({ severity: 'warning', message: `«${name}»: dirección «${address}» con formato no reconocido.`, nodeIds })
    else if (parsed.area !== expected)
      issues.push({ severity: 'warning', message: `«${name}» es de tipo ${typeInfo(entry.type ?? found.type).label.toLowerCase()} pero tiene la dirección ${address}.`, nodeIds })
    own(address, `«${name}»`, nodeIds)
  }

  // Con E1, E2... como variables de etapa, una variable llamada igual chocaría en el ladder y el ST.
  const P = resolveStepPrefix(plc)
  const stepNames = new Map(stepNodes.map((s) => [stepVar(s.data.label, P), s.id]))
  for (const [name, found] of symbols) {
    if (stepNames.has(name)) {
      issues.push({
        severity: 'error',
        message: `La variable «${name}» se llama igual que la variable de la etapa ${name.slice(P.length)}: cámbiale el nombre o usa X como prefijo de etapa.`,
        nodeIds: [...found.uses, stepNames.get(name)],
      })
    }
  }

  for (const [address, list] of owners) {
    if (list.length > 1) {
      issues.push({
        severity: 'error',
        message: `Dirección ${address} repetida: ${list.map((o) => o.label).join(', ')}.`,
        nodeIds: [...new Set(list.flatMap((o) => o.nodeIds))],
      })
    }
  }
  return issues
}

// Tabla en CSV (separador ";", habitual en Excel en español) para importarla en el PLC.
export function plcToCsv(plc, stepNodes, symbols) {
  const rows = [['Nombre', 'Tipo', 'Dirección', 'Preselección', 'Comentario']]
  for (const s of [...stepNodes].sort(stepOrder)) {
    const entry = plc.steps[s.id] ?? {}
    rows.push([stepVar(s.data.label, resolveStepPrefix(plc)), 'Etapa', entry.address ?? '', '', entry.comment ?? ''])
  }
  for (const [name, found] of symbols) {
    const entry = plc.variables[name] ?? {}
    rows.push([name, typeInfo(entry.type ?? found.type).label, entry.address ?? '', entry.preset ?? found.preset ?? '', entry.comment ?? ''])
  }
  const cell = (v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v))
  return rows.map((r) => r.map(cell).join(';')).join('\r\n')
}
