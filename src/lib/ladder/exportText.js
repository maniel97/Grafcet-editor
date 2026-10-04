// Exportación del ladder generado a texto para el autómata:
// - Texto Estructurado (ST, IEC 61131-3): CODESYS y similares; en TIA Portal sirve de base para SCL.
// - AWL / STL (S7-300/400 de Siemens), con nemotécnica alemana (U, UN, S, R, SPBN) o inglesa
//   (A, AN, S, R, JCN).
// Ambas salen de las mismas redes que se dibujan, así que dicen exactamente lo mismo.

import { walk } from './network'
import { edgeMemoryName } from './generate'
import { realLiteral } from '../analog'

const HEADER = 'Generado por Grafcet Editor (IEC 60848 -> método SET/RESET por etapas)'

// --- Texto Estructurado -----------------------------------------------------------------------
// Dos dialectos con el mismo cuerpo:
// - 'iec': PROGRAM con VAR (CODESYS y similares).
// - 'tia': FUNCTION_BLOCK para importar en TIA Portal como fuente externa (SCL): entradas y
//   salidas como parámetros del bloque, el resto como variables estáticas; locales con «#».

const ident = (text) => {
  const clean = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(clean) ? clean : `_${clean}`
}

// Nombre declarado de un operando.
function stName(op, P = 'X') {
  switch (op.kind) {
    case 'step':
      return ident(`${P}${op.label}`)
    case 'timer':
      return ident(`TON_${op.key}`)
    case 'num':
      return String(op.value)
    default:
      return ident(op.name)
  }
}
const edgeInstance = (node, P) => ident(edgeMemoryName(node, P).replace(/^FP_/, 'RT_').replace(/^FN_/, 'FT_'))

// Traducción de redes y expresiones; en SCL de TIA Portal las variables locales llevan «#».
// Literal REAL de STEP 7 (AWL): 6.400000e+003.
const s7Real = (value) => Number(value).toExponential(6).replace(/e([+-])(\d+)$/, (m, sign, digits) => `e${sign}${digits.padStart(3, '0')}`)


function makeSt(P, tia) {
  const local = (name) => (tia ? `#${name}` : name)
  const ref = (op) => (op.kind === 'num' ? String(op.value) : local(stName(op, P)))
  const expr = (net) => {
    switch (net.type) {
      case 'true':
        return 'TRUE'
      case 'false':
        return 'FALSE'
      case 'contact': {
        if (net.kind === 'P' || net.kind === 'N') return `${local(edgeInstance(net, P))}.Q`
        const base = net.operand.kind === 'timer' ? `${ref(net.operand)}.Q` : ref(net.operand)
        return net.kind === 'NC' ? `NOT ${base}` : base
      }
      case 'not':
        return `NOT (${expr(net.item)})`
      case 'compare':
        if (net.real) return `(${realArith(net.real.a)} ${net.op} ${realArith(net.real.b)})`
        return `(${ref(net.a)} ${net.op} ${ref(net.b)})`
      case 'series':
        return net.items.map(expr).join(' AND ')
      case 'parallel':
        return `(${net.items.map(expr).join(' OR ')})`
      default:
        return 'FALSE'
    }
  }
  const arith = (ast) =>
    ast.op === 'num' ? String(ast.value) : ast.op === 'var' ? local(ident(ast.name)) : `(${arith(ast.left)} ${ast.fn} ${arith(ast.right)})`
  // Escalado de analógicas (generate.js): las palabras se pasan a REAL y se calcula en REAL.
  const realArith = (ast) =>
    ast.op === 'num'
      ? realLiteral(ast.value)
      : ast.op === 'var'
        ? `INT_TO_REAL(${local(ident(ast.name))})`
        : `(${realArith(ast.left)} ${ast.fn} ${realArith(ast.right)})`
  // Resultado redondeado a entero y recortado (al rango del módulo, si es una salida analógica).
  const realAssign = (o) => `REAL_TO_INT(LIMIT(${realLiteral(o.real.clamp[0])}, ${realArith(o.value)}, ${realLiteral(o.real.clamp[1])}))`
  return { local, ref, expr, arith, realAssign }
}

const timeLiteral = (seconds) => `T#${Math.round(seconds * 1000)}MS`

const TIA_TYPES = { BOOL: 'Bool', INT: 'Int', TON: 'TON_TIME', R_TRIG: 'R_TRIG', F_TRIG: 'F_TRIG' }
const GROUPS = ['Etapas', 'Transiciones', 'Auxiliares', 'Entradas', 'Salidas', 'Marcas', 'Contadores', 'Temporizadores', 'Flancos']
const groupOfVar = (plc, name) =>
  ({ input: 'Entradas', analogIn: 'Entradas', output: 'Salidas', analogOut: 'Salidas', counter: 'Contadores' })[plc.variables[name]?.type] ?? 'Marcas'

// dialect: 'iec' (PROGRAM, por defecto) | 'tia' (FUNCTION_BLOCK para TIA Portal)
export function toStructuredText(ladder, plc, { dialect = 'iec' } = {}) {
  const tia = dialect === 'tia'
  const { sections, resolver } = ladder
  const P = ladder.stepPrefix ?? 'X'
  const st = makeSt(P, tia)
  const lines = []
  const decl = new Map() // nombre -> { type, group, address }
  const declare = (name, type, group, address = '') => {
    if (!decl.has(name)) decl.set(name, { type, group, address })
  }
  const edges = new Map()
  const numeric = new Set()

  // Recoge variables, tipos e instancias usadas.
  for (const s of sections) {
    for (const r of s.rungs) {
      const visit = (node) => {
        if (node.type === 'contact' && (node.kind === 'P' || node.kind === 'N')) edges.set(edgeInstance(node, P), node)
        if (node.type === 'compare') [node.a, node.b].forEach((o) => o.kind === 'var' && numeric.add(o.name))
        const op = node.operand
        if (!op) return
        if (node.type === 'assign') numeric.add(op.name)
        const name = stName(op, P)
        const address = resolver.address(op)
        if (op.kind === 'step') declare(name, 'BOOL', 'Etapas', address)
        else if (op.kind === 'trans') declare(name, 'BOOL', 'Transiciones', address)
        else if (op.kind === 'aux') declare(name, 'BOOL', 'Auxiliares', address)
        else if (op.kind === 'timer') declare(name, 'TON', 'Temporizadores')
        else if (op.kind === 'var') declare(name, 'BOOL', groupOfVar(plc, op.name), address)
      }
      walk(r.network, visit)
      r.outputs.forEach(visit)
      // Variables que solo aparecen dentro de una asignación (C := A + B).
      for (const o of r.outputs) {
        if (o.type !== 'assign') continue
        const collect = (ast) => {
          if (ast.op === 'var') {
            numeric.add(ast.name)
            declare(ident(ast.name), 'INT', groupOfVar(plc, ast.name), resolver.address({ kind: 'var', name: ast.name }))
          } else if (ast.op === 'arith') {
            collect(ast.left)
            collect(ast.right)
          }
        }
        collect(o.value)
      }
    }
  }
  for (const name of numeric) if (decl.has(ident(name))) decl.get(ident(name)).type = 'INT'
  for (const [name, node] of edges) declare(name, node.kind === 'P' ? 'R_TRIG' : 'F_TRIG', 'Flancos')

  const declLines = (wanted) => {
    const out = []
    for (const group of GROUPS.filter((g) => wanted.includes(g))) {
      const items = [...decl].filter(([, d]) => d.group === group)
      if (!items.length) continue
      out.push(`    (* ${group} *)`)
      for (const [name, d] of items) {
        if (tia) {
          out.push(`    ${name} : ${TIA_TYPES[d.type]};${d.address ? `   // ${d.address}` : ''}`)
          continue
        }
        const at = d.address && plc.scheme === 'iec' ? ` AT ${d.address}` : ''
        const comment = d.address && plc.scheme !== 'iec' ? `   (* ${d.address} *)` : ''
        out.push(`    ${name}${at} : ${d.type};${comment}`)
      }
    }
    return out
  }
  const internal = GROUPS.filter((g) => !tia || (g !== 'Entradas' && g !== 'Salidas'))

  if (tia) {
    const params = (group, arrow) => [...decl].filter(([, d]) => d.group === group).map(([name]) => `${name} ${arrow} "${name}"`)
    const call = [...params('Entradas', ':='), ...params('Salidas', '=>')]
    lines.push(
      `// ${HEADER}`,
      '// TIA Portal: Fuentes externas > Agregar nuevo archivo externo > Generar bloques desde fuente.',
      `// Llamada en OB1 (con su DB de instancia): "Grafcet_DB"(${call.join(', ')});`,
      'FUNCTION_BLOCK "Grafcet"',
      "{ S7_Optimized_Access := 'TRUE' }",
      'VERSION : 0.1',
    )
    const inputs = declLines(['Entradas'])
    const outputs = declLines(['Salidas'])
    if (inputs.length) lines.push('   VAR_INPUT', ...inputs, '   END_VAR')
    if (outputs.length) lines.push('   VAR_OUTPUT', ...outputs, '   END_VAR')
    lines.push('   VAR', '    Init : Bool;           // FALSE solo en el primer ciclo', '    PrimerCiclo : Bool;', ...declLines(internal), '   END_VAR', '', 'BEGIN')
  } else {
    lines.push(`(* ${HEADER} *)`, 'PROGRAM Grafcet', 'VAR')
    lines.push('    Init : BOOL;           (* FALSE solo en el primer ciclo *)', '    PrimerCiclo : BOOL;', ...declLines(internal), 'END_VAR', '')
  }
  const L = st.local
  lines.push('(* Primer ciclo *)', `${L('PrimerCiclo')} := NOT ${L('Init')};`, `${L('Init')} := TRUE;`)

  if (edges.size) {
    lines.push('', '(* Detección de flancos (una llamada por ciclo) *)')
    for (const [name, node] of edges) {
      const op = node.operand
      const source = op.kind === 'timer' ? `${st.ref(op)}.Q` : st.ref(op)
      lines.push(`${L(name)}(CLK := ${source});`)
    }
  }

  for (const s of sections) {
    lines.push('', `(* ===== ${s.title} ===== *)`)
    for (const r of s.rungs) {
      lines.push(`(* ${r.number}. ${r.comment} *)`)
      const expr = st.expr(r.network)
      const actions = []
      for (const o of r.outputs) {
        const name = st.ref(o.operand)
        if (o.type === 'coil') lines.push(`${name} := ${expr};`)
        else if (o.type === 'ton') lines.push(`${name}(IN := ${expr}, PT := ${timeLiteral(o.seconds)});`)
        else if (o.type === 'set') actions.push(`    ${name} := TRUE;`)
        else if (o.type === 'reset') actions.push(`    ${name} := FALSE;`)
        else if (o.type === 'assign') actions.push(`    ${name} := ${o.real ? st.realAssign(o) : st.arith(o.value)};`)
      }
      if (actions.length) lines.push(`IF ${expr} THEN`, ...actions, 'END_IF;')
    }
  }
  lines.push('', tia ? 'END_FUNCTION_BLOCK' : 'END_PROGRAM', '')
  return lines.join('\r\n')
}

// --- AWL / STL ---------------------------------------------------------------------------------

const MNEMONICS = {
  de: { A: 'U', AN: 'UN', O: 'O', ON: 'ON', JCN: 'SPBN', SD: 'SE' },
  en: { A: 'A', AN: 'AN', O: 'O', ON: 'ON', JCN: 'JCN', SD: 'SD' },
}
const CMP = { '>': '>I', '<': '<I', '>=': '>=I', '<=': '<=I', '=': '==I', '<>': '<>I' }

function s5time(seconds) {
  let ms = Math.round(seconds * 1000)
  const h = Math.floor(ms / 3600000)
  ms -= h * 3600000
  const m = Math.floor(ms / 60000)
  ms -= m * 60000
  const s = Math.floor(ms / 1000)
  ms -= s * 1000
  const body = `${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s ? `${s}S` : ''}${ms ? `${ms}MS` : ''}`
  return `S5T#${body || '0MS'}`
}

// mnemonic: 'de' | 'en'; useAddresses: escribir direcciones (si las hay) en vez de símbolos.
export function toAWL(ladder, { mnemonic = 'de', useAddresses = true } = {}) {
  const { sections, resolver } = ladder
  const M = MNEMONICS[mnemonic]
  const operand = (op) => {
    if (op.kind === 'num') return String(op.value)
    const address = resolver.address(op)
    return useAddresses && address ? address : `"${resolver.name(op)}"`
  }
  let label = 0

  const item = (net, first) => {
    // first: 'A' (serie) u 'O' (paralelo)
    const neg = first === 'A' ? M.AN : M.ON
    const pos = first === 'A' ? M.A : M.O
    switch (net.type) {
      case 'contact': {
        if (net.kind === 'P' || net.kind === 'N') {
          const mem = resolver.edgeMemory(net)
          return [`${pos}(`, `${M.A} ${operand(net.operand)}`, `${net.kind === 'P' ? 'FP' : 'FN'} ${mem || `"${edgeMemoryName(net, ladder.stepPrefix)}"`}`, ')']
        }
        return [`${net.kind === 'NC' ? neg : pos} ${operand(net.operand)}`]
      }
      case 'compare':
        if (net.real) {
          // A la izquierda en ACCU2 y a la derecha en ACCU1, como en la comparación de enteros.
          realTemps.add('#RealCmp')
          return [`${pos}(`, ...realCode(net.real.a), 'T #RealCmp', ...realCode(net.real.b), 'L #RealCmp', 'TAK', CMP[net.op].replace(/I$/, 'R'), ')']
        }
        return [`${pos}(`, `L ${operand(net.a)}`, `L ${operand(net.b)}`, CMP[net.op], ')']
      case 'not':
        return [`${pos}(`, ...item(net.item, 'A'), 'NOT', ')']
      case 'series':
        return [`${pos}(`, ...net.items.flatMap((i) => item(i, 'A')), ')']
      case 'parallel':
        return [`${pos}(`, ...net.items.flatMap((i) => item(i, 'O')), ')']
      default:
        return [net.type === 'true' ? 'SET' : 'CLR']
    }
  }
  const logic = (net) => {
    if (net.type === 'series') return net.items.flatMap((i) => item(i, 'A'))
    if (net.type === 'parallel') return net.items.flatMap((i) => item(i, 'O'))
    return item(net, 'A')
  }
  // Aritmética con los dos acumuladores: «L» pasa ACCU1 a ACCU2 y la operación hace ACCU2 op ACCU1.
  // Si el operando derecho es compuesto se calcula primero y TAK devuelve el orden (importa en
  // - y /). Si lo son los dos, el izquierdo se guarda en una variable temporal #AritN.
  let temps = 0
  const leaf = (ast) => `L ${ast.op === 'num' ? ast.value : operand({ kind: 'var', name: ast.name })}`
  const arith = (ast, depth = 1) => {
    if (ast.op === 'num' || ast.op === 'var') return [leaf(ast)]
    const op = { '+': '+I', '-': '-I', '*': '*I', '/': '/I' }[ast.fn]
    const simple = (a) => a.op !== 'arith'
    if (simple(ast.right)) return [...arith(ast.left, depth), leaf(ast.right), op]
    if (simple(ast.left)) return [...arith(ast.right, depth), leaf(ast.left), 'TAK', op]
    temps = Math.max(temps, depth)
    return [...arith(ast.left, depth + 1), `T #Arit${depth}`, ...arith(ast.right, depth + 1), `L #Arit${depth}`, 'TAK', op]
  }

  // Escalado de analógicas en REAL (generate.js): la palabra se pasa a DINT y a REAL (ITD, DTR).
  const realTemps = new Set()
  const realLeaf = (ast) => (ast.op === 'num' ? [`L ${s7Real(ast.value)}`] : [`L ${operand({ kind: 'var', name: ast.name })}`, 'ITD', 'DTR'])
  const realCode = (ast, depth = 1) => {
    if (ast.op !== 'arith') return realLeaf(ast)
    const op = { '+': '+R', '-': '-R', '*': '*R', '/': '/R' }[ast.fn]
    const simple = (a) => a.op !== 'arith'
    if (simple(ast.right)) return [...realCode(ast.left, depth), ...realLeaf(ast.right), op]
    if (simple(ast.left)) return [...realCode(ast.right, depth), ...realLeaf(ast.left), 'TAK', op]
    realTemps.add(`#Real${depth}`)
    return [...realCode(ast.left, depth + 1), `T #Real${depth}`, ...realCode(ast.right, depth + 1), `L #Real${depth}`, 'TAK', op]
  }
  // Resultado recortado a [lo, hi], redondeado (RND) y escrito en la palabra de destino.
  const realAssign = (o, target) => {
    realTemps.add('#RealOut')
    const [lo, hi] = o.real.clamp
    const a = `M${String(++label).padStart(3, '0')}`
    const b = `M${String(++label).padStart(3, '0')}`
    return [
      ...realCode(o.value),
      'T #RealOut',
      'L #RealOut', `L ${s7Real(hi)}`, '>R', `${M.JCN} ${a}`, `L ${s7Real(hi)}`, 'T #RealOut',
      `${a}: L #RealOut`, `L ${s7Real(lo)}`, '<R', `${M.JCN} ${b}`, `L ${s7Real(lo)}`, 'T #RealOut',
      `${b}: L #RealOut`, 'RND', `T ${target}`,
    ]
  }

  const lines = [`// ${HEADER}`, `// AWL para S7-300/400 (nemotécnica ${mnemonic === 'de' ? 'alemana' : 'inglesa'}). Pegar en OB1/FC.`]
  lines.push('// La marca "PrimerCiclo" debe valer 1 solo en el primer ciclo (p. ej. activarla en OB100).', '')
  for (const s of sections) {
    lines.push(`// ===== ${s.title} =====`)
    for (const r of s.rungs) {
      lines.push(`// Segmento ${r.number}: ${r.comment}`)
      lines.push(...logic(r.network).map((l) => `      ${l}`))
      for (const o of r.outputs) {
        const target = operand(o.operand)
        if (o.type === 'coil') lines.push(`      = ${target}`)
        else if (o.type === 'set') lines.push(`      S ${target}`)
        else if (o.type === 'reset') lines.push(`      R ${target}`)
        else if (o.type === 'ton') lines.push(`      L ${s5time(o.seconds)}`, `      ${M.SD} ${target}`)
        else if (o.type === 'assign') {
          lines.push(`      // ${o.operand.name} := ${o.text}`)
          const l = `M${String(++label).padStart(3, '0')}`
          const code = o.real ? realAssign(o, target) : [...arith(o.value), `T ${target}`]
          lines.push(`      ${M.JCN} ${l}`, ...code.map((c) => (/^M\d{3}: /.test(c) ? c : `      ${c}`)), `${l}: NOP 0`)
        }
      }
      lines.push('')
    }
  }
  if (temps) {
    const list = Array.from({ length: temps }, (_, i) => `#Arit${i + 1}`).join(', ')
    lines.splice(3, 0, `// Variables temporales (TEMP) del bloque, de tipo INT: ${list}.`)
  }
  if (realTemps.size) lines.splice(3, 0, `// Variables temporales (TEMP) del bloque, de tipo REAL: ${[...realTemps].sort().join(', ')}.`)
  return lines.join('\r\n')
}
