// Traducción grafcet -> ladder (LD) por el método de una marca por etapa con SET/RESET.
//
// Secciones, en el orden en que el autómata las ejecuta en cada ciclo:
//  1. Inicialización: en el primer ciclo, SET de las etapas iniciales y RESET del resto.
//  2. Auxiliares: marcas para flancos de expresiones compuestas (↑(a·b)).
//  3. Condiciones de franqueo: Tr_n = etapas anteriores · receptividad. Se calculan TODAS antes
//     de evolucionar: las transiciones franqueables a la vez se franquean simultáneamente y no
//     hay franqueos en cascada dentro del mismo ciclo (la evolución fugaz sigue en el siguiente).
//  4. Desactivación (RESET de las etapas anteriores) y 5. Activación (SET de las siguientes):
//     por ir la activación después, una etapa desactivada y activada a la vez queda activa.
//     Forzados (F/G2{3}): tras la activación, SET de las etapas indicadas y RESET del resto del
//     grafcet forzado; además, las transiciones de ese grafcet llevan en serie el contacto
//     cerrado de la etapa que fuerza, para que no evolucione mientras dura la orden.
//  6. Temporizaciones: TON por cada "5s/Xn".
//  7. Acciones memorizadas: en la activación / desactivación (con Tr_n) y al evento.
//  8. Salidas: acciones continuas y condicionadas, todas las etapas de una salida en paralelo,
//     y la marca de cada macroetapa (activa con cualquier etapa de su expansión).

import { buildPlcModel } from '../plcModel'
import { compile } from '../sim/engine'
import { parseAddress, formatBit } from '../addressing'
import { contact, parallel, series, toNetwork, walk } from './network'
import { resolveStepPrefix, stepVar } from '../stepNames'
import { analogConfig, describeRange, isAnalog, rawRange, toRaw } from '../analog'

const FIRST_CYCLE = 'PrimerCiclo'
const AUX_START_BYTE = 20

const stepOp = (label) => ({ kind: 'step', label })
const transOp = (name) => ({ kind: 'trans', name })
const varOp = (name) => ({ kind: 'var', name })
const firstOp = { kind: 'first', name: FIRST_CYCLE }

// Salidas de un segmento a partir de la asignación de una acción memorizada.
function assignmentOutputs(action) {
  const a = action.assignment
  if (!a) return action.symbol ? [{ type: 'set', operand: varOp(action.symbol) }] : []
  if (a.value.op === 'num' && a.value.value === 1) return [{ type: 'set', operand: varOp(a.target) }]
  if (a.value.op === 'num' && a.value.value === 0) return [{ type: 'reset', operand: varOp(a.target) }]
  const text = action.text.split(':=')[1].trim()
  return [{ type: 'assign', operand: varOp(a.target), value: a.value, text }]
}

export function generateLadder(nodes, edges, plc) {
  const model = buildPlcModel(nodes, edges, plc)
  const compiled = compile(model)
  // Nombre de las variables de etapa: X1 (norma) o E1, según la tabla de variables.
  const P = resolveStepPrefix(plc)
  const position = new Map(nodes.map((n) => [n.id, n.position]))
  const stepById = new Map(compiled.steps.map((s) => [s.id, s]))
  const label = (id) => stepById.get(id)?.label
  const sections = []
  const warnings = compiled.errors.map((e) => ({ ...e }))

  // Transiciones numeradas de arriba abajo para que el programa se lea como el diagrama.
  const transitions = [...compiled.transitions].sort((a, b) => {
    const pa = position.get(a.id) ?? { x: 0, y: 0 }
    const pb = position.get(b.id) ?? { x: 0, y: 0 }
    return pa.y - pb.y || pa.x - pb.x
  })
  const trName = new Map(transitions.map((t, i) => [t.id, `Tr${i + 1}`]))

  // Marcas auxiliares para flancos de expresiones compuestas.
  const auxRungs = []
  const ctx = {
    auxFor: (ast) => {
      const name = `Aux${auxRungs.length + 1}`
      auxRungs.push({ comment: `${name}: expresión auxiliar para detectar su flanco`, network: toNetwork(ast, ctx), outputs: [{ type: 'coil', operand: { kind: 'aux', name } }] })
      return name
    },
  }
  const safeNetwork = (ast, where) => {
    if (!ast) return { type: 'false' }
    try {
      return toNetwork(ast, ctx)
    } catch (err) {
      warnings.push({ nodeId: where, message: err.message })
      return { type: 'false' }
    }
  }

  // 1. Inicialización
  const initial = compiled.steps.filter((s) => s.initial)
  sections.push({
    id: 'init',
    title: 'Inicialización',
    rungs: [
      {
        comment: `Primer ciclo: activa ${initial.map((s) => stepVar(s.label, P)).join(', ') || '— (no hay etapa inicial)'} y desactiva las demás`,
        network: contact(firstOp),
        outputs: [
          ...initial.map((s) => ({ type: 'set', operand: stepOp(s.label) })),
          ...compiled.steps.filter((s) => !s.initial).map((s) => ({ type: 'reset', operand: stepOp(s.label) })),
        ],
        nodeIds: initial.map((s) => s.id),
      },
    ],
  })
  if (!initial.length) warnings.push({ nodeId: null, message: 'No hay etapa inicial: el programa no arrancará.' })

  // Etapas que ordenan un forzado del grafcet de la transición.
  const forcersOf = (t) => {
    const grafcets = new Set(t.from.map((id) => compiled.grafcetOf.get(id)).filter(Boolean))
    return [...new Set(compiled.forcings.filter((f) => grafcets.has(f.grafcet)).map((f) => f.stepId))]
  }

  // 3. Condiciones de franqueo
  const transitionRungs = transitions.map((t) => ({
    comment: `${trName.get(t.id)}: ${t.from.map((id) => stepVar(label(id), P)).join(' · ') || '(sin etapa anterior)'} · «${t.condition || '—'}»  →  ${
      t.to.map((id) => stepVar(label(id), P)).join(', ') || '—'
    }`,
    network: series(
      ...t.from.map((id) => contact(stepOp(label(id)))),
      safeNetwork(t.ast, t.id),
      // Bloqueo por forzado del grafcet al que pertenece.
      ...forcersOf(t).map((id) => contact(stepOp(label(id)), 'NC')),
    ),
    outputs: [{ type: 'coil', operand: transOp(trName.get(t.id)) }],
    nodeIds: [t.id],
    error: !t.ast,
  }))
  sections.push({ id: 'transitions', title: 'Condiciones de franqueo', rungs: transitionRungs })

  // 4. Desactivación y 5. Activación
  sections.push({
    id: 'deactivation',
    title: 'Desactivación de etapas',
    rungs: transitions
      .filter((t) => t.from.length)
      .map((t) => ({
        comment: `${trName.get(t.id)} franqueada: desactiva ${t.from.map((id) => stepVar(label(id), P)).join(', ')}`,
        network: contact(transOp(trName.get(t.id))),
        outputs: t.from.map((id) => ({ type: 'reset', operand: stepOp(label(id)) })),
        nodeIds: [t.id],
      })),
  })
  sections.push({
    id: 'activation',
    title: 'Activación de etapas',
    rungs: transitions
      .filter((t) => t.to.length)
      .map((t) => ({
        comment: `${trName.get(t.id)} franqueada: activa ${t.to.map((id) => stepVar(label(id), P)).join(', ')}`,
        network: contact(transOp(trName.get(t.id))),
        outputs: t.to.map((id) => ({ type: 'set', operand: stepOp(label(id)) })),
        nodeIds: [t.id],
      })),
  })

  // Forzados: después de la activación, para que tengan prioridad sobre la evolución.
  sections.push({
    id: 'forcing',
    title: 'Forzados',
    rungs: compiled.forcings
      .filter((f) => f.mode !== 'freeze')
      .map((f) => {
        const members = [...compiled.grafcets.get(f.grafcet)]
        return {
          comment: `${stepVar(label(f.stepId), P)} ordena ${f.text}: ${
            f.targets.size ? `activa ${[...f.targets].map((id) => stepVar(label(id), P)).join(', ')}` : 'ninguna etapa activa'
          }`,
          network: contact(stepOp(label(f.stepId))),
          outputs: [
            ...members.filter((id) => !f.targets.has(id)).map((id) => ({ type: 'reset', operand: stepOp(label(id)) })),
            ...[...f.targets].map((id) => ({ type: 'set', operand: stepOp(label(id)) })),
          ],
          nodeIds: [f.stepId],
        }
      }),
  })

  // 7 y 8 se construyen antes que 6 para recoger todas las temporizaciones usadas.
  const storedRungs = []
  const outputBranches = new Map() // símbolo -> [red]
  for (const step of compiled.steps) {
    const entering = transitions.filter((t) => t.to.includes(step.id)).map((t) => contact(transOp(trName.get(t.id))))
    const leaving = transitions.filter((t) => t.from.includes(step.id)).map((t) => contact(transOp(trName.get(t.id))))
    if (step.initial) entering.push(contact(firstOp))
    for (const action of step.actions) {
      if (action.kind === 'stored-on' && entering.length) {
        storedRungs.push({ comment: `Al activarse ${stepVar(step.label, P)}: ${action.text}`, network: parallel(...entering), outputs: assignmentOutputs(action), nodeIds: [step.id] })
      } else if (action.kind === 'stored-off' && leaving.length) {
        storedRungs.push({ comment: `Al desactivarse ${stepVar(step.label, P)}: ${action.text}`, network: parallel(...leaving), outputs: assignmentOutputs(action), nodeIds: [step.id] })
      } else if (action.kind === 'event') {
        storedRungs.push({
          comment: `Evento «${action.condition}» con ${stepVar(step.label, P)}: ${action.text}`,
          network: series(contact(stepOp(step.label)), safeNetwork(action.conditionAst, step.id)),
          outputs: assignmentOutputs(action),
          nodeIds: [step.id],
        })
      } else if ((action.kind === 'continuous' || action.kind === 'conditional') && action.symbol && !action.assignment) {
        const branch =
          action.kind === 'conditional'
            ? series(contact(stepOp(step.label)), safeNetwork(action.conditionAst, step.id))
            : contact(stepOp(step.label))
        outputBranches.set(action.symbol, [...(outputBranches.get(action.symbol) ?? []), { branch, stepId: step.id }])
      }
    }
  }
  const macroRungs = [...compiled.macroMembers].map(([id, members]) => ({
    comment: `Macroetapa ${stepVar(label(id), P)}: activa con cualquier etapa de su expansión`,
    network: parallel(...members.map((m) => contact(stepOp(label(m))))),
    outputs: [{ type: 'coil', operand: stepOp(label(id)) }],
    nodeIds: [id],
  }))
  const outputRungs = [...outputBranches].map(([symbol, list]) => ({
    comment: `Salida ${symbol}: ${list.map((l) => stepVar(label(l.stepId), P)).join(' + ')}`,
    network: parallel(...list.map((l) => l.branch)),
    outputs: [{ type: 'coil', operand: varOp(symbol) }],
    nodeIds: list.map((l) => l.stepId),
  }))

  // 6. Temporizaciones usadas en cualquier red
  const timers = new Map()
  const collect = (rung) =>
    walk(rung.network, (n) => {
      if (n.type === 'contact' && n.operand.kind === 'timer') timers.set(n.operand.key, n.operand)
    })
  ;[...auxRungs, ...transitionRungs, ...storedRungs, ...outputRungs].forEach(collect)
  sections.push({
    id: 'timers',
    title: 'Temporizaciones',
    rungs: [...timers.values()].map((t) => ({
      comment: `${t.key}: ${t.seconds} s desde la activación de ${stepVar(t.step, P)}`,
      network: contact(stepOp(t.step)),
      outputs: [{ type: 'ton', operand: { kind: 'timer', key: t.key }, seconds: t.seconds }],
      nodeIds: [],
    })),
  })
  sections.push({ id: 'stored', title: 'Acciones memorizadas', rungs: storedRungs })
  sections.push({ id: 'outputs', title: 'Salidas', rungs: [...macroRungs, ...outputRungs] })
  // Los auxiliares pueden surgir en cualquier red (receptividades o acciones): van tras la
  // inicialización, antes de que se usen.
  if (auxRungs.length) sections.splice(1, 0, { id: 'aux', title: 'Auxiliares', rungs: auxRungs })

  const typeOf = new Map(compiled.variables.map((v) => [v.name, v.type]))
  numericSetReset(sections, plc, typeOf)
  scaleAnalog(sections, plc, typeOf)

  const visible = sections.filter((s) => s.rungs.length)
  let n = 0
  for (const s of visible) for (const r of s.rungs) r.number = ++n

  return { sections: visible, resolver: makeResolver(plc, compiled, visible, P), warnings, stepPrefix: P }
}

// «C:=0» y «C:=1» se traducen como R y S, que en una palabra (un contador, una salida analógica)
// no valen: en las variables numéricas (las que reciben un cálculo, se comparan o son analógicas)
// pasan a ser asignaciones de 0 y 1. También el reset del primer ciclo de las acciones memorizadas.
function numericSetReset(sections, plc, typeOf) {
  const numeric = new Set()
  const visit = (node) => {
    if (node.type === 'compare') for (const op of [node.a, node.b]) if (op.kind === 'var') numeric.add(op.name)
    node.items?.forEach(visit)
    if (node.item) visit(node.item)
  }
  for (const s of sections) {
    for (const r of s.rungs) {
      visit(r.network)
      for (const o of r.outputs) if (o.type === 'assign') numeric.add(o.operand.name)
    }
  }
  const isNumeric = (op) => op.kind === 'var' && (numeric.has(op.name) || isAnalog(typeOf.get(op.name) ?? plc.variables[op.name]?.type))
  for (const s of sections) {
    for (const r of s.rungs) {
      r.outputs = r.outputs.map((o) =>
        (o.type === 'set' || o.type === 'reset') && isNumeric(o.operand)
          ? { type: 'assign', operand: o.operand, value: { op: 'num', value: o.type === 'set' ? 1 : 0 }, text: o.type === 'set' ? '1' : '0' }
          : o,
      )
    }
  }
}

// Analógicas (lib/analog.js). Lo sencillo, sin cálculos en el autómata: las comparaciones con
// constantes y las asignaciones constantes a salidas analógicas se pasan a valor bruto
// («Temperatura > 60» -> «AIW0 > 22016»). Lo demás se escala en el autómata, en REAL:
// - comparar una analógica con otra variable (otra analógica de distinta escala, una consigna…):
//   node.real = { a, b }, árboles aritméticos en unidades físicas;
// - asignar un cálculo con analógicas, o un cálculo a una salida analógica: o.real = { clamp },
//   o.value en unidades físicas y, si el destino es analógico, pasado de vuelta a valor bruto y
//   recortado al rango del módulo.
// En los árboles REAL, una hoja «var» es una palabra entera que se convierte a REAL, y el
// resultado de una asignación se redondea a entero.
function scaleAnalog(sections, plc, typeOf) {
  const analog = (op) => op?.kind === 'var' && isAnalogName(op.name)
  const isAnalogName = (name) => isAnalog(typeOf.get(name) ?? plc.variables[name]?.type)
  const entry = (name) => plc.variables[name] ?? {}
  const num = (value) => ({ op: 'num', value })
  const calc = (fn, left, right) => ({ op: 'arith', fn, left, right })
  // Valor bruto -> unidades físicas: min + (x − r0)·(max − min)/(r1 − r0).
  const toPhysical = (name) => {
    const { min, max, signal } = analogConfig(entry(name))
    const [r0, r1] = rawRange(signal, plc.scheme)
    let node = { op: 'var', name }
    if (r0) node = calc('-', node, num(r0))
    node = calc('*', node, num((max - min) / (r1 - r0)))
    return min ? calc('+', node, num(min)) : node
  }
  // Unidades físicas -> valor bruto: r0 + (v − min)·(r1 − r0)/(max − min), recortado al módulo.
  const toRawTree = (value, name) => {
    const { min, max, signal } = analogConfig(entry(name))
    const [r0, r1] = rawRange(signal, plc.scheme)
    let node = min ? calc('-', value, num(min)) : value
    node = calc('*', node, num(max === min ? 0 : (r1 - r0) / (max - min)))
    return { tree: r0 ? calc('+', node, num(r0)) : node, clamp: [Math.min(r0, r1), Math.max(r0, r1)] }
  }
  const physical = (ast) =>
    ast.op === 'var' && isAnalogName(ast.name) ? toPhysical(ast.name) : ast.op === 'arith' ? { ...ast, left: physical(ast.left), right: physical(ast.right) } : ast
  const hasAnalog = (ast) => (ast.op === 'var' ? isAnalogName(ast.name) : ast.op === 'arith' && (hasAnalog(ast.left) || hasAnalog(ast.right)))
  const leaf = (op) => (op.kind === 'num' ? num(op.value) : { op: 'var', name: op.name })

  const visit = (node) => {
    if (node.type === 'compare') {
      const sameScale = analog(node.a) && analog(node.b) && describeRange(entry(node.a.name)) === describeRange(entry(node.b.name))
      if ((analog(node.a) || analog(node.b)) && node.a.kind === 'var' && node.b.kind === 'var' && !sameScale) {
        node.real = { a: physical(leaf(node.a)), b: physical(leaf(node.b)) }
      } else {
        for (const [v, c, side] of [
          [node.a, node.b, 'b'],
          [node.b, node.a, 'a'],
        ]) {
          if (analog(v) && c.kind === 'num') node[side] = { kind: 'num', value: toRaw(c.value, entry(v.name), plc.scheme), physical: c.value }
        }
      }
    }
    node.items?.forEach(visit)
    if (node.item) visit(node.item)
  }
  for (const s of sections) {
    for (const r of s.rungs) {
      visit(r.network)
      for (const o of r.outputs) {
        if (o.type !== 'assign') continue
        const target = analog(o.operand)
        if (target && o.value.op === 'num') {
          o.value = num(toRaw(o.value.value, entry(o.operand.name), plc.scheme))
          continue
        }
        if (!target && !hasAnalog(o.value)) continue
        const value = physical(o.value)
        if (target) {
          const { tree, clamp } = toRawTree(value, o.operand.name)
          o.value = tree
          o.real = { clamp }
        } else {
          o.value = value
          o.real = { clamp: [-32768, 32767] }
        }
      }
    }
  }
}

// Nombres y direcciones de los operandos. Las marcas internas (Tr, Aux, flancos) reciben
// direcciones libres a partir de M20.0 (o tras la última marca usada).
function makeResolver(plc, compiled, sections, P) {
  const stepIdByLabel = new Map(compiled.steps.map((s) => [String(s.label), s.id]))
  // Zona de las marcas internas: M (V en S7-200, cuya zona M es muy pequeña).
  const area = plc.scheme === 's7200' ? 'V' : 'M'
  let maxM = AUX_START_BYTE * 8 - 1
  const remember = (address) => {
    const p = parseAddress(address)
    // Solo cuentan los bits: las palabras (MW100...) están en otra zona.
    if (p?.area === area && p.index !== undefined) maxM = Math.max(maxM, p.index)
  }
  Object.values(plc.steps).forEach((e) => remember(e.address))
  Object.values(plc.variables).forEach((e) => remember(e.address))

  const internal = new Map()
  let next = Math.ceil((maxM + 1) / 8) * 8
  const allocate = (name) => {
    if (!internal.has(name)) internal.set(name, formatBit(area, next++, plc.scheme))
    return internal.get(name)
  }
  // Orden estable: Tr, Aux y marcas de flanco en el orden en que aparecen.
  for (const s of sections) {
    for (const r of s.rungs) {
      const visit = (node) => {
        if (node.type === 'contact' && (node.kind === 'P' || node.kind === 'N')) allocate(edgeMemoryName(node, P))
        const op = node.operand
        if (op?.kind === 'trans' || op?.kind === 'aux') allocate(op.name)
      }
      walk(r.network, visit)
      r.outputs.forEach(visit)
    }
  }

  const timerAddress = (key) => plc.variables[key]?.address ?? ''
  return {
    name(op) {
      if (op.kind === 'step') return stepVar(op.label, P)
      if (op.kind === 'timer') return timerAddress(op.key) || op.key
      if (op.kind === 'num') return String(op.value)
      return op.name
    },
    address(op) {
      if (op.kind === 'step') return plc.steps[stepIdByLabel.get(String(op.label))]?.address ?? ''
      if (op.kind === 'timer') return timerAddress(op.key)
      if (op.kind === 'trans' || op.kind === 'aux') return internal.get(op.name) ?? ''
      // S7-200: la marca de sistema SM0.1 vale 1 solo en el primer ciclo.
      if (op.kind === 'first') return plc.variables[FIRST_CYCLE]?.address || (plc.scheme === 's7200' ? 'SM0.1' : '')
      if (op.kind === 'var') return plc.variables[op.name]?.address ?? ''
      return ''
    },
    edgeMemory: (node) => internal.get(edgeMemoryName(node, P)) ?? '',
    internal,
    scheme: plc.scheme,
  }
}

export const edgeMemoryName = (node, P = 'X') =>
  `${node.kind === 'P' ? 'FP' : 'FN'}_${node.operand.kind === 'step' ? stepVar(node.operand.label, P) : node.operand.name ?? node.operand.key}`
