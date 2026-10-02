// Exportación del ladder generado a texto para el autómata:
// - Texto Estructurado (ST, IEC 61131-3): CODESYS y similares; en TIA Portal sirve de base para SCL.
// - AWL / STL (S7-300/400 de Siemens), con nemotécnica alemana (U, UN, S, R, SPBN) o inglesa
//   (A, AN, S, R, JCN).
// Ambas salen de las mismas redes que se dibujan, así que dicen exactamente lo mismo.

import { walk } from './network'
import { edgeMemoryName } from './generate'

const HEADER = 'Generado por Grafcet Editor (IEC 60848 -> método SET/RESET por etapas)'

// --- Texto Estructurado -----------------------------------------------------------------------

const ident = (text) => {
  const clean = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(clean) ? clean : `_${clean}`
}

function stName(op) {
  switch (op.kind) {
    case 'step':
      return ident(`X${op.label}`)
    case 'timer':
      return ident(`TON_${op.key}`)
    case 'num':
      return String(op.value)
    default:
      return ident(op.name)
  }
}
const edgeInstance = (node) => ident(edgeMemoryName(node).replace(/^FP_/, 'RT_').replace(/^FN_/, 'FT_'))

function stExpr(net) {
  switch (net.type) {
    case 'true':
      return 'TRUE'
    case 'false':
      return 'FALSE'
    case 'contact': {
      if (net.kind === 'P' || net.kind === 'N') return `${edgeInstance(net)}.Q`
      const base = net.operand.kind === 'timer' ? `${stName(net.operand)}.Q` : stName(net.operand)
      return net.kind === 'NC' ? `NOT ${base}` : base
    }
    case 'not':
      return `NOT (${stExpr(net.item)})`
    case 'compare':
      return `(${stName(net.a)} ${net.op} ${stName(net.b)})`
    case 'series':
      return net.items.map((i) => (i.type === 'parallel' ? stExpr(i) : stExpr(i))).join(' AND ')
    case 'parallel':
      return `(${net.items.map(stExpr).join(' OR ')})`
    default:
      return 'FALSE'
  }
}

const stArith = (ast) =>
  ast.op === 'num' ? String(ast.value) : ast.op === 'var' ? ident(ast.name) : `(${stArith(ast.left)} ${ast.fn} ${stArith(ast.right)})`

const timeLiteral = (seconds) => `T#${Math.round(seconds * 1000)}MS`

export function toStructuredText(ladder, plc) {
  const { sections, resolver } = ladder
  const lines = []
  const decl = new Map() // nombre -> { type, comment, group }
  const declare = (name, type, group, address = '') => {
    if (!decl.has(name)) decl.set(name, { type, group, address })
  }
  const edges = new Map()
  const numeric = new Set()

  // Recoge variables, tipos e instancias usadas.
  for (const s of sections) {
    for (const r of s.rungs) {
      const visit = (node) => {
        if (node.type === 'contact' && (node.kind === 'P' || node.kind === 'N')) edges.set(edgeInstance(node), node)
        if (node.type === 'compare') [node.a, node.b].forEach((o) => o.kind === 'var' && numeric.add(o.name))
        const op = node.operand
        if (!op) return
        if (node.type === 'assign') numeric.add(op.name)
        const name = stName(op)
        const address = resolver.address(op)
        if (op.kind === 'step') declare(name, 'BOOL', 'Etapas', address)
        else if (op.kind === 'trans') declare(name, 'BOOL', 'Transiciones', address)
        else if (op.kind === 'aux') declare(name, 'BOOL', 'Auxiliares', address)
        else if (op.kind === 'timer') declare(name, 'TON', 'Temporizadores')
        else if (op.kind === 'var') {
          const type = plc.variables[op.name]?.type
          const group = { input: 'Entradas', output: 'Salidas', counter: 'Contadores' }[type] ?? 'Marcas'
          declare(name, 'BOOL', group, address)
        }
      }
      walk(r.network, visit)
      r.outputs.forEach(visit)
    }
  }
  for (const name of numeric) if (decl.has(ident(name))) decl.get(ident(name)).type = 'INT'
  for (const [name, node] of edges) declare(name, node.kind === 'P' ? 'R_TRIG' : 'F_TRIG', 'Flancos')

  lines.push(`(* ${HEADER} *)`, 'PROGRAM Grafcet', 'VAR')
  lines.push('    Init : BOOL;           (* FALSE solo en el primer ciclo *)', '    PrimerCiclo : BOOL;')
  const groups = ['Etapas', 'Transiciones', 'Auxiliares', 'Entradas', 'Salidas', 'Marcas', 'Contadores', 'Temporizadores', 'Flancos']
  for (const group of groups) {
    const items = [...decl].filter(([, d]) => d.group === group)
    if (!items.length) continue
    lines.push(`    (* ${group} *)`)
    for (const [name, d] of items) {
      const at = d.address && plc.scheme === 'iec' ? ` AT ${d.address}` : ''
      const comment = d.address && plc.scheme !== 'iec' ? `   (* ${d.address} *)` : ''
      lines.push(`    ${name}${at} : ${d.type};${comment}`)
    }
  }
  lines.push('END_VAR', '', '(* Primer ciclo *)', 'PrimerCiclo := NOT Init;', 'Init := TRUE;')

  if (edges.size) {
    lines.push('', '(* Detección de flancos (una llamada por ciclo) *)')
    for (const [name, node] of edges) {
      const op = node.operand
      const source = op.kind === 'timer' ? `${stName(op)}.Q` : stName(op)
      lines.push(`${name}(CLK := ${source});`)
    }
  }

  for (const s of sections) {
    lines.push('', `(* ===== ${s.title} ===== *)`)
    for (const r of s.rungs) {
      lines.push(`(* ${r.number}. ${r.comment} *)`)
      const expr = stExpr(r.network)
      const actions = []
      for (const o of r.outputs) {
        const name = stName(o.operand)
        if (o.type === 'coil') lines.push(`${name} := ${expr};`)
        else if (o.type === 'ton') lines.push(`${name}(IN := ${expr}, PT := ${timeLiteral(o.seconds)});`)
        else if (o.type === 'set') actions.push(`    ${name} := TRUE;`)
        else if (o.type === 'reset') actions.push(`    ${name} := FALSE;`)
        else if (o.type === 'assign') actions.push(`    ${name} := ${stArith(o.value)};`)
      }
      if (actions.length) lines.push(`IF ${expr} THEN`, ...actions, 'END_IF;')
    }
  }
  lines.push('', 'END_PROGRAM', '')
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
          return [`${pos}(`, `${M.A} ${operand(net.operand)}`, `${net.kind === 'P' ? 'FP' : 'FN'} ${mem || `"${edgeMemoryName(net)}"`}`, ')']
        }
        return [`${net.kind === 'NC' ? neg : pos} ${operand(net.operand)}`]
      }
      case 'compare':
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
  const arith = (ast) => {
    if (ast.op === 'num' || ast.op === 'var') return [`L ${ast.op === 'num' ? ast.value : operand({ kind: 'var', name: ast.name })}`]
    // Con dos acumuladores solo caben operaciones de dos operandos simples.
    if (ast.left.op === 'arith' || ast.right.op === 'arith') return null
    return [...arith(ast.left), ...arith(ast.right), { '+': '+I', '-': '-I', '*': '*I', '/': '/I' }[ast.fn]]
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
          const code = arith(o.value)
          if (!code) {
            lines.push(`      // REVISAR: ${o.operand.name} := ${o.text} (demasiado compleja para AWL directo)`)
            continue
          }
          const l = `M${String(++label).padStart(3, '0')}`
          lines.push(`      ${M.JCN} ${l}`, ...code.map((c) => `      ${c}`), `      T ${target}`, `${l}: NOP 0`)
        }
      }
      lines.push('')
    }
  }
  return lines.join('\r\n')
}
