import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { validateGrafcet } from '../../src/lib/validation'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { EMPTY_PLC } from '../../src/lib/addressing'
import { generateLadder } from '../../src/lib/ladder/generate'
import { listRecent, MAX_RECENT, pushRecent, removeRecent } from '../../src/lib/recent'

// Simula: devuelve una función que aplica entradas en un instante y da las etapas activas.
function simulator(example) {
  const { nodes, edges } = example.build()
  const c = compile(buildPlcModel(nodes, edges, EMPTY_PLC))
  let state = initialState(c)
  const labels = () => [...state.active].map((id) => c.steps.find((s) => s.id === id).label).sort().join(',')
  return {
    errors: c.errors,
    at: (time, inputs = {}) => {
      state = evolve(c, state, inputs, time).state
      return labels()
    },
    value: (name) => state.values[name],
  }
}

describe('ejemplos', () => {
  it.each(EXAMPLES.map((e) => [e.title, e]))('«%s» es conforme a la norma (sin errores ni avisos)', (_, example) => {
    const { nodes, edges } = example.build()
    expect(validateGrafcet(nodes, edges)).toEqual([])
  })

  it.each(EXAMPLES.map((e) => [e.title, e]))('«%s» se compila sin errores y se traduce a ladder', (_, example) => {
    const { nodes, edges } = example.build()
    expect(simulator(example).errors).toEqual([])
    expect(generateLadder(nodes, edges, EMPTY_PLC).warnings).toEqual([])
  })

  it('taladradora: ciclo completo con el repaso de 2 s', () => {
    const sim = simulator(EXAMPLES.find((e) => e.id === 'taladradora'))
    expect(sim.at(0)).toBe('0')
    expect(sim.at(0.1, { Marcha: 1, Pieza: 1 })).toBe('1')
    expect(sim.value('Bajar')).toBe(1)
    expect(sim.at(1, { Fc_abajo: 1 })).toBe('2')
    expect(sim.at(2.5, { Fc_abajo: 1 })).toBe('2') // aún no han pasado 2 s
    expect(sim.at(3.1, { Fc_abajo: 1 })).toBe('3')
    // Las entradas se mantienen (como interruptores): hay que soltarlas o, al volver a 0, el
    // grafcet arrancaría de nuevo en evolución fugaz (correcto según la norma).
    expect(sim.at(4, { Marcha: 0, Pieza: 0, Fc_abajo: 0, Fc_arriba: 1 })).toBe('0')
    expect(sim.at(5, { Marcha: 1, Pieza: 1, Fc_abajo: 1 })).toBe('2') // nuevo ciclo: fugaz hasta el repaso
  })

  it('semáforo: rojo -> verde -> ámbar -> rojo solo con el tiempo', () => {
    const sim = simulator(EXAMPLES.find((e) => e.id === 'semaforo'))
    expect(sim.at(0)).toBe('0')
    expect(sim.at(10)).toBe('1')
    expect(sim.at(18)).toBe('2')
    expect(sim.at(21)).toBe('0')
  })

  it('mezcladora: Y (llenado simultáneo y espera) y O (limpieza)', () => {
    const sim = simulator(EXAMPLES.find((e) => e.id === 'mezcladora'))
    expect(sim.at(0)).toBe('0')
    expect(sim.at(1, { Marcha: 1 })).toBe('1,2')
    expect(sim.at(2, { Nivel_A: 1 })).toBe('2,3') // A lleno espera a B
    expect(sim.at(3, { Nivel_A: 1, Nivel_B: 1 })).toBe('5') // convergencia en Y
    expect(sim.at(33)).toBe('6')
    expect(sim.at(34, { Marcha: 0, Nivel_A: 0, Nivel_B: 0, Vacio: 1 })).toBe('0')
    expect(sim.at(35, { Vacio: 0, Limpieza: 1 })).toBe('7')
    expect(sim.at(36, { Limpieza: 0, Fin_lavado: 1 })).toBe('0')
  })
})

describe('trabajos anteriores', () => {
  const memory = () => {
    const data = {}
    return { getItem: (k) => data[k] ?? null, setItem: (k, v) => (data[k] = v) }
  }
  const project = (n) => ({ nodes: [{ id: 's', type: 'step', position: { x: 0, y: n }, data: { label: String(n) } }], edges: [], plc: EMPTY_PLC })

  it('guarda, no repite el último idéntico, ignora vacíos y conserva los más recientes', () => {
    const storage = memory()
    pushRecent(project(1), 'a', storage)
    pushRecent(project(1), 'b', storage) // idéntico al último: no se repite
    pushRecent({ nodes: [], edges: [], plc: EMPTY_PLC }, 'vacío', storage)
    expect(listRecent(storage).map((e) => e.reason)).toEqual(['a'])
    for (let i = 2; i < 20; i++) pushRecent(project(i), `p${i}`, storage)
    const list = listRecent(storage)
    expect(list).toHaveLength(MAX_RECENT)
    expect(list[0].reason).toBe('p19')
    expect(list[0].summary).toBe('1 etapa · 0 transiciones')
    expect(removeRecent(list[0].id, storage)).toHaveLength(MAX_RECENT - 1)
  })

  it('si no cabe en el navegador, descarta los más antiguos', () => {
    const data = {}
    const storage = {
      getItem: (k) => data[k] ?? null,
      setItem: (k, v) => {
        if (v.length > 2000) throw new Error('QuotaExceeded')
        data[k] = v
      },
    }
    for (let i = 0; i < 8; i++) pushRecent(project(i), `p${i}`, storage)
    const list = listRecent(storage)
    expect(list.length).toBeGreaterThan(0)
    expect(list.length).toBeLessThan(8)
    expect(list[0].reason).toBe('p7') // el más reciente siempre se conserva
  })
})

describe('ejemplos de la norma: forzado y macroetapa', () => {
  it('paro de emergencia: F/G2{} detiene la producción y F/G2{INIT} la reinicia', () => {
    const sim = simulator(EXAMPLES.find((e) => e.id === 'emergencia'))
    expect(sim.at(0)).toBe('0,10')
    expect(sim.at(1, { Marcha: 1 })).toBe('1,10')
    expect(sim.value('Avanzar')).toBe(1)
    expect(sim.at(2, { Marcha: 0, Emergencia: 1 })).toBe('11') // G2 vacío
    expect(sim.value('Avanzar')).toBe(0)
    expect(sim.at(3, { Emergencia: 1, Fc_delante: 1 })).toBe('11') // G2 forzado: no evoluciona
    expect(sim.at(4, { Emergencia: 0, Fc_delante: 0, Rearme: 1 })).toBe('0,10') // reinicio por 12 (fugaz)
  })
  it('macroetapa: M1 -> E1 ... S1 -> 2', () => {
    const sim = simulator(EXAMPLES.find((e) => e.id === 'macroetapa'))
    expect(sim.at(0)).toBe('0')
    expect(sim.at(1, { Marcha: 1 })).toBe('E1')
    expect(sim.at(2, { Marcha: 0, Retirar: 1 })).toBe('E1') // falta la salida S1
    expect(sim.at(3, { Retirar: 0, Nivel: 1 })).toBe('11')
    expect(sim.at(24, { Nivel: 0 })).toBe('S1')
    expect(sim.value('Listo')).toBe(1)
    expect(sim.at(25, { Retirar: 1 })).toBe('2')
  })
})
