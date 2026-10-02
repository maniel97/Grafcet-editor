import { describe, expect, it } from 'vitest'
import { parseCondition } from '../../src/lib/condition'
import { isValidGrafcetConnection, transitionOutput } from '../../src/lib/grafcetRules'
import { validateGrafcet } from '../../src/lib/validation'
import { copySelection, prepareClipboard } from '../../src/lib/clipboard'
import { normalizeProject } from '../../src/lib/projectFile'
import { links, step, transition } from './helpers'

const show = (text) => parseCondition(text).map((s) => (s.negated ? `‾[${s.text}]` : s.text)).join('')

describe('negación en receptividades (raya encima)', () => {
  it.each([
    ['!a', '‾[a]'],
    ['a AND !b', 'a AND ‾[b]'],
    ['!(a OR b)', '‾[a OR b]'],
    ['!S1.2 OR c', '‾[S1.2] OR c'],
    ['ñ AND !válvula', 'ñ AND ‾[válvula]'],
    ['a != b', 'a != b'],
    ['t1 > 5s', 't1 > 5s'],
    ['!%IX0.1', '‾[%IX0.1]'],
  ])('%s', (input, expected) => expect(show(input)).toBe(expected))
})

describe('reglas de conexión (IEC 60848)', () => {
  const nodes = {
    s0: step('s0', '0', 0),
    t1: transition('t1', 'T1', 100),
    s1: step('s1', '1', 170),
    t2: transition('t2', 'x', 270),
    s2: step('s2', '2', 340),
    s3: step('s3', '3', 170, {}, 240),
    t9: transition('t9', 'y', 500, 500),
  }
  const get = (id) => nodes[id]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']])
  const yOf = (id) => nodes[id].position.y

  it('salida de cada transición', () => {
    expect(transitionOutput('t1', edges, yOf)).toBe('step')
    expect(transitionOutput('t2', edges, yOf)).toBe('loop')
    expect(transitionOutput('t9', edges, yOf)).toBe(null)
  })
  it.each([
    ['etapa -> etapa', 's1', 's2', false],
    ['transición con bucle -> etapa abajo', 't2', 's2', false],
    ['transición con etapa -> rama en Y', 't1', 's3', true],
    ['transición con etapa -> bucle', 't1', 's0', false],
    ['transición libre -> bucle', 't9', 's0', true],
    ['etapa -> transición', 's2', 't9', true],
    ['reconectar el mismo bucle', 't2', 's0', true],
  ])('%s', (_, source, target, expected) => {
    expect(isValidGrafcetConnection({ source, target }, get, edges)).toBe(expected)
  })
})

describe('verificación de conformidad', () => {
  it('el ejemplo correcto no tiene problemas', () => {
    const nodes = [step('s0', '0', 0, { initial: true }), transition('t1', 'Marcha', 100), step('s1', '1', 170), transition('t2', 'Paro', 270)]
    expect(validateGrafcet(nodes, links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0']]))).toEqual([])
  })

  it('detecta los errores y avisos de la norma', () => {
    const nodes = [
      step('s0', '0', 0),
      transition('t1', '', 100),
      step('s1', '1', 170),
      step('s1b', '1', 170),
      transition('t2', 'x', 270),
      step('s2', '2', 340),
      step('s3', '', 500, { macro: true, initial: true }),
    ]
    const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2'], ['t2', 's0'], ['t2', 's2'], ['s2', 's1b']])
    const messages = validateGrafcet(nodes, edges).map((i) => `${i.severity}: ${i.message}`)
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^error: Etapa sin número/),
        expect.stringMatching(/^error: El número de etapa 1 está repetido/),
        expect.stringMatching(/^error: .*macroetapa no puede ser inicial/),
        expect.stringMatching(/^error: Enlace directo entre dos etapas/),
        expect.stringMatching(/^error: Transición sin receptividad/),
        expect.stringMatching(/^error: .*vuelve atrás y continúa a la vez/),
        expect.stringMatching(/^warning: Etapa 0 no es alcanzable/),
      ]),
    )
  })

  it('sin etapa inicial es un error', () => {
    const issues = validateGrafcet([step('s0', '0', 0)], [])
    expect(issues.some((i) => i.severity === 'error' && /ninguna etapa inicial/.test(i.message))).toBe(true)
  })

  it('un diagrama vacío no tiene problemas', () => {
    expect(validateGrafcet([], [])).toEqual([])
  })
})

describe('copiar y pegar', () => {
  const nodes = [
    { ...step('s0', '0', 0, { initial: true }), selected: false },
    { ...transition('t1', 'T1', 100), selected: true },
    { ...step('s1', '1', 170, { actions: [{ text: 'A:=1', kind: 'stored-on' }] }), selected: true },
    { ...transition('t2', 'Paro', 270), selected: true },
    { id: 'variables-table', type: 'variables', position: { x: 500, y: 0 }, data: {}, selected: true },
  ]
  const edges = links([['s0', 't1'], ['t1', 's1'], ['s1', 't2']])

  it('copia la selección con sus enlaces internos, sin la tabla', () => {
    const clip = copySelection(nodes, edges)
    expect(clip.nodes.map((n) => n.id)).toEqual(['t1', 's1', 't2'])
    expect(clip.edges.map((e) => e.id)).toEqual(['t1-s1', 's1-t2'])
  })

  it('pega con ids nuevos, desplazado y renumerando', () => {
    const { nodes: pasted, edges: pastedEdges } = prepareClipboard(copySelection(nodes, edges), nodes)
    expect(pasted.map((n) => n.data.label ?? n.data.condition)).toEqual(['T3', '2', 'Paro'])
    expect(pasted[0].position).toEqual({ x: 40, y: 140 })
    const ids = new Set(pasted.map((n) => n.id))
    expect(['t1', 's1', 't2'].some((id) => ids.has(id))).toBe(false)
    expect(pastedEdges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true)
  })
})

describe('archivos de proyecto', () => {
  it('migra acciones antiguas guardadas como nodos sueltos', () => {
    const project = normalizeProject({
      nodes: [step('s1', '1', 0), { id: 'a1', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Motor' } }],
      edges: [{ id: 'e', source: 's1', target: 'a1' }],
    })
    expect(project.nodes).toHaveLength(1)
    expect(project.nodes[0].data.actions).toEqual(['Motor'])
    expect(project.edges).toEqual([])
  })
  it('rechaza lo que no es un proyecto', () => {
    expect(normalizeProject({ foo: 1 })).toBe(null)
  })
  it('todos los enlaces pasan a ser Grafcet y la tabla vacía por defecto', () => {
    const project = normalizeProject({ nodes: [], edges: [{ id: 'e', source: 'a', target: 'b', type: 'step' }] })
    expect(project.edges[0].type).toBe('grafcet')
    expect(project.plc.variables).toEqual({})
  })
})
