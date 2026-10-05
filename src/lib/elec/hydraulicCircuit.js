// Parte hidráulica de un esquema electrohidráulico, dibujada sola (como pneumaticCircuit.js): el
// grupo hidráulico abajo con su limitadora, su manómetro y el retorno al depósito, un distribuidor
// 4/3 por cilindro y los cilindros arriba. La usan los ejemplos.
//  cylinders: [{ tag: 'A', sol14: 'Y1', sol12: 'Y2', center ('tandem' por defecto), time,
//                signal / reverse (cilindro de la planta que mueve), text }]
//  options: { relief (bar, 100), motor (identificador del motor de la bomba; sin él, siempre en marcha) }
//  (x, y): esquina de arriba a la izquierda; prefix: para los ids. Devuelve { components, wires }.
import { VALVE_SIDE, VALVE_SQUARE } from './catalog'

const STEP = 360 // de un cilindro al siguiente

export function hydraulicCircuit(cylinders, x = 0, y = 0, prefix = 'hy', { relief = 100, motor = '' } = {}) {
  const components = []
  const wires = []
  let n = 0
  const add = (c) => components.push(c) && c.id
  const tube = (a, ta, b, tb) => wires.push({ id: `${prefix}-t${n++}`, from: { c: a, t: ta }, to: { c: b, t: tb } })
  // Conexión A del distribuidor (en su casilla central) bajo la A del cilindro.
  const valveX = (cx) => cx + 20 - (VALVE_SIDE + VALVE_SQUARE + 20)
  const middle = x + ((cylinders.length - 1) * STEP) / 2
  const pump = add({ id: `${prefix}-pump`, type: 'hpump', x: middle, y: y + 420, tag: '0P1', motor })
  const gauge = add({ id: `${prefix}-gauge`, type: 'hgauge', x: middle - 120, y: y + 420, tag: '0Z1' })
  const valveRelief = add({ id: `${prefix}-relief`, type: 'hrelief', x: middle + 180, y: y + 400, tag: '0V1', setting: relief })
  const tank = add({ id: `${prefix}-tank`, type: 'htank', x: middle + 180, y: y + 340, tag: '0Z2' })
  tube(pump, 'P', gauge, '1')
  tube(pump, 'P', valveRelief, 'P')
  tube(valveRelief, 'T', tank, 'T')
  cylinders.forEach((cyl, i) => {
    const cx = x + i * STEP
    const k = i + 1
    const cylinder = add({ id: `${prefix}-cyl${k}`, type: 'hcylinder', x: cx, y, tag: cyl.tag, time: cyl.time ?? 2, initial: 0, text: cyl.text ?? '', ...(cyl.signal ? { signal: cyl.signal } : {}), ...(cyl.reverse ? { reverse: cyl.reverse } : {}) })
    const valve = add({ id: `${prefix}-v${k}`, type: 'hvalve', x: valveX(cx), y: y + 220, tag: `${k}V1`, ways: '4/3', center: cyl.center ?? 'tandem', sol14: cyl.sol14 ?? '', sol12: cyl.sol12 ?? '', manual: 'none', text: '' })
    tube(pump, 'P', valve, 'P')
    tube(valve, 'T', pump, 'T')
    tube(valve, 'A', cylinder, 'A')
    tube(valve, 'B', cylinder, 'B')
  })
  return { components, wires }
}
