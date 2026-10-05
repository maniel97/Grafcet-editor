// Exportación para STEP 7-Micro/WIN (S7-200): programa en STL (AWL) para importar con
// Archivo > Importar, y tabla de símbolos para pegar en Micro/WIN.
// Sale de las mismas redes que el ladder dibujado (lib/ladder/generate.js), así que dice lo mismo.
//
// STL de S7-200 (pila lógica): LD/LDN abren un bloque, A/AN y O/ON combinan contactos sueltos,
// ALD/OLD combinan bloques; EU/ED detectan flancos sin marca auxiliar; S/R llevan número de bits
// («S V0.0, 1»); TON Tn, PT con la base de tiempo del temporizador; comparaciones LDW>=/AW>=/OW>=;
// aritmética de palabras MOVW, +I, -I, *I, /I (OUT := OUT op IN).

import { parseAddress, S7200 } from '../addressing'
import { realLiteral } from '../analog'

const HEADER = 'Generado por Grafcet Editor (IEC 60848 -> método SET/RESET por etapas)'
// Palabras temporales para los cálculos (VW900, VW902...): lejos de las de usuario (VW100...).
const TEMP_WORD = 900
// Escalado de analógicas en REAL: cálculos en VD940… y operandos de las comparaciones en VD960….
const TEMP_REAL = 940
const CMP_REAL = 960

// Base de tiempo de los temporizadores TON/TOF del S7-200 según su número (s).
export function timerBase(number) {
  if (number === 32 || number === 96) return 0.001
  if ((number >= 33 && number <= 36) || (number >= 97 && number <= 100)) return 0.01
  return 0.1
}

const constant = (n) => (n < 0 ? String(n) : `+${n}`)
const pad = (op, args = '') => (args ? `${op.padEnd(6)} ${args}` : op)

// Texto ANSI: Micro/WIN es un programa de Windows de la época (Windows-1252). Lo que no existe en
// ese juego de caracteres se sustituye.
const REPLACE = { '→': '->', '←': '<-', '↑': '^', '↓': 'v', '≥': '>=', '≤': '<=', '≠': '<>', '·': '·' }
export function ansiText(text) {
  return [...String(text)]
    .map((ch) => {
      if (REPLACE[ch]) return REPLACE[ch]
      const code = ch.charCodeAt(0)
      return code < 256 || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(ch) ? ch : '?'
    })
    .join('')
}
const CP1252_HIGH = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f }
export function encodeAnsi(text) {
  const safe = ansiText(text)
  const bytes = new Uint8Array(safe.length)
  for (let i = 0; i < safe.length; i++) bytes[i] = CP1252_HIGH[safe[i]] ?? safe.charCodeAt(i)
  return bytes
}

// Nombre de símbolo válido en Micro/WIN: letras sin acentos, cifras y _, sin empezar por cifra,
// como mucho 23 caracteres.
export function symbolName(name) {
  let s = String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_')
  if (/^\d/.test(s)) s = `T_${s}`
  return s.slice(0, 23)
}

// ¿Existe esta dirección en un S7-200 (hasta la CPU 226)? I/Q 0.0–15.7, M 0.0–31.7, V hasta
// VB10239, AIW/AQW 0–62 (pares), IW/QW 0–14, MW 0–30, T/C 0–255, SM. Las de otros esquemas (IW64
// o MW102 de S7-300, %IX0.0 de IEC) no: Micro/WIN da «ERROR 37: rango de direccionamiento».
export function validS7200(address) {
  const text = String(address ?? '').trim().toUpperCase()
  if (text.startsWith('%')) return false
  const a = parseAddress(text)
  if (!a) return false
  if (a.index !== undefined) return { I: 128, Q: 128, M: 256, V: 10240 * 8, SM: 550 * 8 }[a.area] > a.index
  if (a.word !== undefined) return a.word % 2 === 0 && { AI: 62, AQ: 62, I: 14, Q: 14, M: 30, V: 10238 }[a.area] >= a.word
  return a.number <= 255
}

// Direcciones de todo lo que usa el programa. Lo que no tiene dirección en la tabla de variables
// se asigna al exportar (sin guardarlo) con el reparto de S7-200, y se apunta en `assigned`. Lo
// que tiene una dirección que no existe en un S7-200 (otro esquema de direcciones) se cambia por
// una válida, y se apunta en `remapped` (para el aviso y para la CPU simulada).
function makeAddresses(ladder, plc) {
  const { resolver } = ladder
  const used = new Set()
  const assigned = []
  const remapped = {} // nombre -> dirección S7-200 que la sustituye
  const changes = [] // «Peso IW64 -> AIW0»
  const extra = [] // símbolos que añade la exportación (marcas de flanco)
  const cursors = { V: 0, I: 0, Q: 0, M: 0, VW: S7200.wordStart, T: S7200.timerStart, AIW: 0, AQW: 0 }
  for (const e of [...Object.values(plc.steps), ...Object.values(plc.variables)]) {
    if (e?.address?.trim()) used.add(e.address.trim().toUpperCase())
  }
  for (const a of resolver.internal.values()) used.add(a.toUpperCase())
  const next = (kind) => {
    for (;;) {
      const i = cursors[kind]
      const address =
        kind.endsWith('W') ? `${kind}${i}` : kind === 'T' ? `T${i}` : `${kind}${Math.floor(i / 8)}.${i % 8}`
      cursors[kind] += kind.endsWith('W') ? 2 : 1
      if (!used.has(address)) {
        used.add(address)
        return address
      }
    }
  }
  const cache = new Map()
  const numeric = new Set()
  // Dirección S7-200 para una variable según su tipo.
  const fresh = (op) => {
    if (op.kind === 'step' || op.kind === 'trans' || op.kind === 'aux' || op.kind === 'edge') return next('V')
    if (op.kind === 'timer') return next('T')
    const type = plc.variables[op.name]?.type ?? (numeric.has(op.name) ? 'memory' : 'input')
    if (type === 'analogIn') return next('AIW')
    if (type === 'analogOut') return next('AQW')
    if (numeric.has(op.name)) return next('VW')
    return next({ input: 'I', output: 'Q', memory: 'V', counter: 'VW' }[type] ?? 'V')
  }
  return {
    assigned,
    remapped,
    changes,
    extra,
    markNumeric: (name) => numeric.add(name),
    of(op) {
      if (op.kind === 'num') return constant(op.value)
      if (op.kind === 'bit') return op.address
      // Primer ciclo: la marca de sistema SM0.1 (salvo que se haya indicado otra).
      if (op.kind === 'first') return (plc.variables.PrimerCiclo?.address || 'SM0.1').toUpperCase()
      const key = `${op.kind}:${op.label ?? op.name ?? op.key}`
      if (cache.has(key)) return cache.get(key)
      // Marca de un flanco (segmento propio, ver toS7200): una por entrada y sentido.
      if (op.kind === 'edge') {
        const address = fresh(op)
        cache.set(key, address)
        extra.push({ name: op.name, address, comment: op.comment })
        return address
      }
      const known = resolver.address(op)
      if (known && validS7200(known)) return known.toUpperCase()
      if (known) {
        const address = fresh(op)
        cache.set(key, address)
        remapped[resolver.name(op)] = address
        changes.push(`${resolver.name(op)} ${known.toUpperCase()} -> ${address}`)
        return address
      }
      const address = fresh(op)
      cache.set(key, address)
      assigned.push(`${resolver.name(op)} = ${address}`)
      return address
    },
  }
}

// Programa STL completo (texto). Devuelve { text, assigned, warnings }.
export function toS7200(ladder, plc, { title = '' } = {}) {
  const addresses = makeAddresses(ladder, plc)
  const warnings = []
  // Variables numéricas: las que se comparan o se calculan (van en palabras VW).
  for (const s of ladder.sections) {
    for (const r of s.rungs) {
      const visit = (n) => {
        if (n.type === 'compare') for (const o of [n.a, n.b]) if (o.kind === 'var') addresses.markNumeric(o.name)
        if (n.type === 'assign') {
          addresses.markNumeric(n.operand.name)
          const walk = (ast) => (ast.op === 'var' ? addresses.markNumeric(ast.name) : ast.op === 'arith' && (walk(ast.left), walk(ast.right)))
          walk(n.value)
        }
        n.items?.forEach(visit)
        if (n.item) visit(n.item)
      }
      visit(r.network)
      r.outputs.forEach(visit)
    }
  }
  const at = (op) => addresses.of(op)
  const CMP = { '>': '>', '<': '<', '>=': '>=', '<=': '<=', '=': '=', '<>': '<>' }

  const simple = (n) => n.type === 'contact' && (n.kind === 'NO' || n.kind === 'NC')
  // Bloque nuevo en la pila lógica.
  const block = (n) => {
    switch (n.type) {
      case 'true':
        return [pad('LD', 'SM0.0')]
      case 'false':
        return [pad('LDN', 'SM0.0')]
      case 'contact':
        if (n.kind === 'P' || n.kind === 'N') return [pad('LD', at(n.operand)), n.kind === 'P' ? 'EU' : 'ED']
        return [pad(n.kind === 'NC' ? 'LDN' : 'LD', at(n.operand))]
      case 'compare':
        if (n.real) return [pad(`LDR${CMP[n.op]}`, n.real.slots.join(', '))]
        return [pad(`LDW${CMP[n.op]}`, `${at(n.a)}, ${at(n.b)}`)]
      case 'not':
        return [...block(n.item), 'NOT']
      case 'series':
        return [...block(n.items[0]), ...n.items.slice(1).flatMap(andItem)]
      case 'parallel':
        return [...block(n.items[0]), ...n.items.slice(1).flatMap(orItem)]
      default:
        throw new Error(`Red no soportada: ${n.type}`)
    }
  }
  const compareItem = (n, op) =>
    n.real ? [pad(`${op}R${CMP[n.op]}`, n.real.slots.join(', '))] : [pad(`${op}W${CMP[n.op]}`, `${at(n.a)}, ${at(n.b)}`)]
  const andItem = (n) =>
    simple(n) ? [pad(n.kind === 'NC' ? 'AN' : 'A', at(n.operand))] : n.type === 'compare' ? compareItem(n, 'A') : [...block(n), 'ALD']
  const orItem = (n) =>
    simple(n) ? [pad(n.kind === 'NC' ? 'ON' : 'O', at(n.operand))] : n.type === 'compare' ? compareItem(n, 'O') : [...block(n), 'OLD']

  // Aritmética de palabras: el resultado se calcula en VW900... y se copia al destino.
  const OPS = { '+': '+I', '-': '-I', '*': '*I', '/': '/I' }
  const word = (ast) => (ast.op === 'num' ? constant(ast.value) : at({ kind: 'var', name: ast.name }))
  const compute = (ast, depth = 0) => {
    const target = `VW${TEMP_WORD + depth * 2}`
    if (ast.op !== 'arith') return { lines: [pad('MOVW', `${word(ast)}, ${target}`)], target }
    const left = compute(ast.left, depth)
    if (ast.right.op !== 'arith') return { lines: [...left.lines, pad(OPS[ast.fn], `${word(ast.right)}, ${target}`)], target }
    const right = compute(ast.right, depth + 1)
    return { lines: [...left.lines, ...right.lines, pad(OPS[ast.fn], `${right.target}, ${target}`)], target }
  }

  // Escalado de analógicas en REAL (generate.js): la palabra se pasa a doble entero y a REAL
  // (ITD, DTR) y se opera con +R −R *R /R (OUT := OUT op IN, como con los enteros).
  const ROPS = { '+': '+R', '-': '-R', '*': '*R', '/': '/R' }
  const realCompute = (ast, depth = 0) => {
    const target = `VD${TEMP_REAL + depth * 4}`
    if (ast.op === 'num') return { lines: [pad('MOVR', `${realLiteral(ast.value)}, ${target}`)], target }
    if (ast.op === 'var') return { lines: [pad('ITD', `${at({ kind: 'var', name: ast.name })}, ${target}`), pad('DTR', `${target}, ${target}`)], target }
    const left = realCompute(ast.left, depth)
    if (ast.right.op === 'num') return { lines: [...left.lines, pad(ROPS[ast.fn], `${realLiteral(ast.right.value)}, ${target}`)], target }
    const right = realCompute(ast.right, depth + 1)
    return { lines: [...left.lines, ...right.lines, pad(ROPS[ast.fn], `${right.target}, ${target}`)], target }
  }
  // Asignación REAL: recortada a [lo, hi] (LPS/LRD/LPP: la condición de la red sigue arriba),
  // redondeada (ROUND) y pasada a palabra (DTI).
  const realAssign = (o) => {
    const { lines, target } = realCompute(o.value)
    const [lo, hi] = o.real.clamp.map(realLiteral)
    return [
      ...lines,
      'LPS',
      pad('AR>', `${target}, ${hi}`),
      pad('MOVR', `${hi}, ${target}`),
      'LRD',
      pad('AR<', `${target}, ${lo}`),
      pad('MOVR', `${lo}, ${target}`),
      'LPP',
      pad('ROUND', `${target}, ${target}`),
      pad('DTI', `${target}, ${at(o.operand)}`),
    ]
  }
  // Comparaciones REAL de una red: sus dos operandos se calculan antes, en una red propia, y se
  // dejan en VD960… (n.real.slots).
  const realCompares = (net) => {
    const found = []
    const walk = (n) => {
      if (n.type === 'compare' && n.real) found.push(n)
      n.items?.forEach(walk)
      if (n.item) walk(n.item)
    }
    walk(net)
    const lines = []
    found.forEach((n, i) => {
      n.real.slots = [`VD${CMP_REAL + i * 8}`, `VD${CMP_REAL + i * 8 + 4}`]
      for (const [k, ast] of [n.real.a, n.real.b].entries()) {
        const { lines: code, target } = realCompute(ast)
        lines.push(...code, pad('MOVR', `${target}, ${n.real.slots[k]}`))
      }
    })
    return lines
  }

  const timerLine = (o) => {
    const address = at(o.operand)
    const number = parseAddress(address)?.number ?? S7200.timerStart
    const base = timerBase(number)
    const pt = Math.round(o.seconds / base)
    if (pt > 32767) warnings.push(`${address}: ${o.seconds} s no cabe en un temporizador de ${base * 1000} ms (máx. 32767).`)
    if (Math.abs(pt * base - o.seconds) > 1e-9) warnings.push(`${address}: ${o.seconds} s se redondea a ${pt * base} s (base ${base * 1000} ms).`)
    return pad('TON', `${address}, ${constant(pt)}`)
  }

  // Flancos: cada ↑x / ↓x se calcula en un segmento propio (LD x, EU, = marca) y en la red se usa
  // esa marca como contacto normal. Un flanco dentro de un bloque (LD … EU … ALD) es AWL válido,
  // pero Micro/WIN no lo puede dibujar en KOP y marca el segmento «No válido».
  const edgesDone = new Set()
  const edgeNetworks = []
  const withEdgeBits = (n) => {
    if (n.type === 'contact' && (n.kind === 'P' || n.kind === 'N')) {
      const source = at(n.operand)
      const name = `Flanco${n.kind === 'P' ? 'Sube' : 'Baja'}_${symbolName(ladder.resolver.name(n.operand))}`.slice(0, 23)
      const bit = at({ kind: 'edge', name, comment: `${n.kind === 'P' ? 'Flanco de subida' : 'Flanco de bajada'} de ${ladder.resolver.name(n.operand)}` })
      if (!edgesDone.has(bit)) {
        edgesDone.add(bit)
        edgeNetworks.push({ comment: `${n.kind === 'P' ? '^' : 'v'}${ansiText(ladder.resolver.name(n.operand))}: flanco en ${bit}`, lines: [pad('LD', source), n.kind === 'P' ? 'EU' : 'ED', pad('=', bit)] })
      }
      return { type: 'contact', kind: 'NO', operand: { kind: 'bit', address: bit } }
    }
    if (n.items) return { ...n, items: n.items.map(withEdgeBits) }
    if (n.item) return { ...n, item: withEdgeBits(n.item) }
    return n
  }

  const body = []
  let number = 0
  for (const s of ladder.sections) {
    for (const r of s.rungs) {
      const network = withEdgeBits(r.network)
      for (const e of edgeNetworks.splice(0)) body.push(`Network ${++number} // ${e.comment}`, ...e.lines)
      const scaling = realCompares(network)
      if (scaling.length) body.push(`Network ${++number} // Escalado (REAL) para las comparaciones de la red siguiente`, pad('LD', 'SM0.0'), ...scaling)
      body.push(`Network ${++number} // ${ansiText(r.comment).slice(0, 120)}`)
      if (number === 1 || s.rungs[0] === r) body.push(`// ${ansiText(s.title)}`)
      body.push(...block(network))
      for (const o of r.outputs) {
        if (o.type === 'coil') body.push(pad('=', at(o.operand)))
        else if (o.type === 'set') body.push(pad('S', `${at(o.operand)}, 1`))
        else if (o.type === 'reset') body.push(pad('R', `${at(o.operand)}, 1`))
        else if (o.type === 'ton') body.push(timerLine(o))
        else if (o.type === 'assign' && o.real) body.push(`// ${ansiText(o.operand.name)} := ${ansiText(o.text)}`, ...realAssign(o))
        else if (o.type === 'assign') {
          const { lines, target } = compute(o.value)
          body.push(`// ${ansiText(o.operand.name)} := ${ansiText(o.text)}`, ...lines, pad('MOVW', `${target}, ${at(o.operand)}`))
        }
      }
    }
  }

  const head = [
    'ORGANIZATION_BLOCK MAIN:OB1',
    `TITLE=${ansiText([title, HEADER].filter(Boolean).join(' · '))}`,
    'BEGIN',
  ]
  if (addresses.assigned.length) {
    warnings.push(`Direcciones asignadas al exportar (no estaban en la tabla de variables): ${addresses.assigned.join(', ')}.`)
  }
  if (addresses.changes.length) {
    warnings.push(
      `Direcciones que no existen en un S7-200, cambiadas por otras válidas: ${addresses.changes.join(', ')}. Para evitarlo, elige el formato de direcciones S7-200 en la tabla de variables.`,
    )
  }
  if (body.some((line) => /\b(AIW|AQW)\d+/.test(line))) {
    warnings.push('Usa entradas o salidas analógicas: en Micro/WIN elige una CPU 222 o superior (la 221 no admite módulos de ampliación) y añade el módulo analógico (EM 231 / EM 232 / EM 235).')
  }
  const text = [
    ...head,
    ...body,
    'END_ORGANIZATION_BLOCK',
    'SUBROUTINE_BLOCK SBR_0:SBR0',
    'TITLE=',
    'BEGIN',
    'Network 1 // ',
    'END_SUBROUTINE_BLOCK',
    'INTERRUPT_BLOCK INT_0:INT0',
    'TITLE=',
    'BEGIN',
    'Network 1 // ',
    'END_INTERRUPT_BLOCK',
    '',
  ].join('\r\n')
  return { text, assigned: addresses.assigned, remapped: addresses.remapped, extraSymbols: addresses.extra, warnings, addressOf: at }
}

// Tabla de símbolos para pegar en Micro/WIN (Símbolo, Dirección, Comentario separados por
// tabuladores; una fila por línea). Usa las mismas direcciones que el programa.
export function s7200Symbols(ladder, plc, stepNodes, symbols, addressOf, extraSymbols = []) {
  const rows = []
  const seen = new Set()
  const add = (name, address, comment = '') => {
    const symbol = symbolName(name)
    if (!address || seen.has(symbol)) return
    seen.add(symbol)
    rows.push([symbol, address, ansiText(comment)].join('\t'))
  }
  for (const s of stepNodes) add(ladder.resolver.name({ kind: 'step', label: s.data.label }), addressOf({ kind: 'step', label: s.data.label }), plc.steps[s.id]?.comment ?? `Etapa ${s.data.label}`)
  for (const [name, found] of symbols) {
    const op = found.type === 'timer' ? { kind: 'timer', key: name } : { kind: 'var', name }
    add(name, addressOf(op), plc.variables[name]?.comment ?? '')
  }
  for (const [name] of ladder.resolver.internal) {
    if (/^(Tr|Aux)\d+$/.test(name)) add(name, addressOf({ kind: name.startsWith('Tr') ? 'trans' : 'aux', name }), name.startsWith('Tr') ? 'Transición franqueable' : 'Auxiliar de flanco')
  }
  for (const e of extraSymbols) add(e.name, e.address, e.comment)
  return rows.join('\r\n')
}
