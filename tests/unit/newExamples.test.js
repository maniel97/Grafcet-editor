import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../../src/lib/examples'
import { normalizeProject } from '../../src/lib/projectFile'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile, evolve, initialState } from '../../src/lib/sim/engine'
import { sceneAction } from '../../src/lib/sim/scene'
import { advanceWorld, makeWorld } from '../../src/lib/sim/world'

// Hace funcionar un ejemplo con su planta y su esquema (conectado), como la simulación del editor.
function open(id) {
  const project = normalizeProject(EXAMPLES.find((e) => e.id === id).build())
  const model = buildPlcModel(project.nodes, project.edges, project.plc)
  const compiled = compile(model)
  const scene = project.plc.scene
  const elec = project.plc.electrical
  const range = (name) => {
    const v = compiled.variables.find((x) => x.name === name)
    return v?.analog ? { min: v.analog.min, max: v.analog.max } : null
  }
  const world = makeWorld(scene, range, elec, model.variables)
  let w = world.init()
  let inputs = world.inputs(w)
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  const sim = {
    elec,
    get state() {
      return state
    },
    get world() {
      return w
    },
    do(element, action) {
      w = sceneAction(scene, w, element, action)
      return sim
    },
    run(seconds) {
      const end = state.time + seconds
      for (let t = state.time; t < end - 1e-9; ) {
        t = Math.min(end, t + 0.1)
        ;({ state, inputs, world: w } = advanceWorld(compiled, { state, inputs, world: w }, t, { world }))
      }
      return sim
    },
    press(element) {
      return sim.do(element, 'press').run(0.3).do(element, 'release').run(0.2)
    },
    active: () => [...state.active].sort(),
    motor: () => Object.values(w.elec.view.motors)[0],
    byType: (type) => elec.components.find((c) => c.type === type),
  }
  return sim
}

describe('ejemplos nuevos: funcionan con su planta y su esquema', () => {
  it('luz con un solo pulsador: una pulsación enciende, otra apaga; mantener pulsado no cambia nada', () => {
    const s = open('luz-pulsador')
    s.press('p')
    expect(s.state.values.Luz).toBe(1)
    s.do('p', 'press').run(2) // mantenido
    expect(s.state.values.Luz).toBe(0)
    s.run(2)
    expect(s.state.values.Luz).toBe(0) // sigue apagada mientras se mantiene
    s.do('p', 'release').run(0.3)
    s.press('p')
    expect(s.state.values.Luz).toBe(1)
  })

  it('estrella-triángulo: arranca en estrella y a los 5 s (con la pausa) pasa a triángulo; Paro lo para', () => {
    const s = open('estrella-triangulo-plc')
    s.press('marcha').run(1)
    expect(s.motor()).toMatchObject({ running: true, mode: 'estrella' })
    s.run(5)
    expect(s.motor()).toMatchObject({ running: true, mode: 'triángulo' })
    expect(s.world.elec.view.short).toBeFalsy()
    expect(s.world.angle.motor).toBeGreaterThan(0)
    s.press('paro').run(0.5)
    expect(s.motor().running).toBe(false)
    expect(s.active()).toEqual(['s0'])
  })

  it('cinta reversible: lleva la pieza a la derecha y la trae a la izquierda (motor al revés)', () => {
    const s = open('cinta-reversible')
    s.press('poner').press('derecha')
    expect(s.motor()).toMatchObject({ running: true, dir: 1 })
    s.run(8)
    expect(s.state.values.Fin_dcha ?? s.world.elec.view.plcIn).toBeTruthy()
    expect(s.active()).toEqual(['s0'])
    s.press('izquierda')
    expect(s.motor()).toMatchObject({ running: true, dir: -1 })
    s.run(8)
    expect(s.active()).toEqual(['s0'])
    expect(s.world.elec.view.short).toBeFalsy()
  })

  it('Dahlander: lenta, rápida (doble estrella) y la seta lo para todo hasta el rearme', () => {
    const s = open('dahlander-plc')
    s.press('marcha').run(1)
    expect(s.motor()).toMatchObject({ running: true, speed: 0.5 })
    s.run(4)
    expect(s.motor()).toMatchObject({ running: true, speed: 1, mode: expect.stringMatching(/doble estrella/) })
    expect(s.world.elec.view.short).toBeFalsy()
    s.do('seta', 'toggle').run(0.5)
    expect(s.motor().running).toBe(false)
    expect(s.state.values.Alarma).toBe(1)
    s.do('seta', 'toggle').run(0.3).press('rearme').run(0.5)
    expect(s.active()).toEqual(['s0', 's10'])
  })

  it('cinta con variador: 50 Hz en vacío y 15 Hz con pieza en la zona de carga', () => {
    const s = open('cinta-variador')
    const vfd = s.byType('vfd')
    s.do('marcha', 'toggle').run(0.5)
    expect(s.world.elec.view.vfd[vfd.id].hz).toBe(50)
    let slow = false
    for (let i = 0; i < 100 && !slow; i++) {
      s.run(0.1)
      slow = s.world.elec.view.vfd[vfd.id].hz === 15
    }
    expect(slow).toBe(true)
    expect(s.motor().speed).toBeCloseTo(0.3)
  })
})

describe('ejemplos nuevos (2): funcionan con su planta y su esquema', () => {
  it('semáforo con peatones: sin petición sigue en verde; con ella, ámbar, rojo y verde para peatones', () => {
    const s = open('semaforo-peatones')
    s.run(15)
    expect(s.active()).toEqual(['s0', 's10'])
    s.press('pulsador')
    expect(s.state.values.Espere).toBe(1)
    s.run(1)
    expect(s.state.values.AmbarC).toBe(1) // ya llevaba más de 10 s en verde
    s.run(4.5)
    expect(s.state.values.VerdeP).toBe(1)
    expect(s.state.values.Espere).toBe(0) // la petición se borra al dar paso
    s.run(9)
    expect(s.state.values.VerdeC).toBe(1)
  })

  it('aparcamiento: cuenta entradas y salidas, no pasa de 5 y enciende Completo', () => {
    const s = open('aparcamiento')
    for (let i = 0; i < 6; i++) s.press('entra')
    expect(s.state.values.C).toBe(5)
    expect(s.state.values.Completo).toBe(1)
    expect(s.state.values.Libre).toBe(0)
    s.press('sale')
    expect(s.state.values.C).toBe(4)
    expect(s.state.values.Libre).toBe(1)
  })

  it('silo: aviso solo los 2 primeros segundos, vibrador desde el cuarto; luego se rellena', () => {
    const s = open('silo-vibrador')
    s.press('marcha').run(0.5)
    expect(s.state.values.Aviso).toBe(1)
    expect(s.state.values.Vibrador).toBe(0)
    s.run(2)
    expect(s.state.values.Aviso).toBe(0)
    s.run(2)
    expect(s.state.values.Vibrador).toBe(1)
    s.run(6)
    expect(s.active()).toEqual(['s2']) // vacío: rellenando
    s.run(8)
    expect(s.active()).toEqual(['s0'])
  })

  it('dos carros: si piden a la vez entra A; B espera al tramo libre y nunca están los dos dentro', () => {
    const s = open('dos-carros')
    s.do('pide_a', 'press').do('pide_b', 'press').run(0.3).do('pide_a', 'release').run(0.1)
    expect(s.active()).toContain('s11')
    expect(s.active()).toContain('s30')
    let both = false
    for (let i = 0; i < 80; i++) {
      s.run(0.1)
      const a = s.active()
      if ((a.includes('s11') || a.includes('s12')) && (a.includes('s31') || a.includes('s32'))) both = true
    }
    s.do('pide_b', 'release').run(4)
    expect(both).toBe(false)
    expect(s.active()).toEqual(['s10', 's30'])
  })

  it('verificación: en producción hace el ciclo solo; en verificación, un paso por pulsación', () => {
    const s = open('taladradora-verificacion')
    s.do('pieza', 'toggle').press('marcha').run(6)
    expect(s.active()).toEqual(['s0', 's20']) // ciclo completo
    s.do('verif', 'toggle').run(0.3)
    expect(s.active()).toEqual(['s0', 's21'])
    s.press('marcha').run(1)
    expect(s.active()).toEqual(['s0', 's21']) // sin Paso no arranca
    s.do('marcha', 'press').run(0.2).press('paso').do('marcha', 'release').run(2)
    expect(s.active()).toEqual(['s1', 's21']) // abajo, esperando otro Paso
    s.press('paso').run(0.2)
    expect(s.active()).toEqual(['s2', 's21'])
  })

  it('dosificación: tara, grueso, fino y para en la consigna sin pasarse más de 1 kg', () => {
    const s = open('dosificacion-peso')
    s.press('marcha')
    expect(s.active()).toEqual(['s1'])
    const tara = s.state.values.Tara
    expect(tara).toBeGreaterThan(9)
    let fine = false
    for (let i = 0; i < 400 && !s.active().includes('s3'); i++) {
      s.run(0.1)
      if (s.active().includes('s2')) fine = true
    }
    expect(fine).toBe(true)
    const consigna = s.state.values.Consigna
    expect(s.state.values.Peso - tara).toBeGreaterThanOrEqual(consigna - 0.5)
    expect(s.state.values.Peso - tara).toBeLessThanOrEqual(consigna + 1)
    s.run(8)
    expect(s.active()).toEqual(['s0'])
  })
})
