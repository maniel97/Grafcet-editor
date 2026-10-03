// Parte neumática de un esquema electroneumático, dibujada sola: la fuente y la unidad de
// mantenimiento abajo, una válvula 5/2 por cilindro y los cilindros arriba, con un regulador de
// caudal en el escape del lado B (para salir despacio). La usan los montajes y los ejemplos.
//  cylinders: [{ tag: 'A', sol14: 'Y1', sol12: 'Y2' (sin ella, monoestable), time, throttle,
//                signal / reverse (cilindro de la planta que mueve) }]
//  (x, y): esquina de arriba a la izquierda; prefix: para los ids. Devuelve { components, wires }.
import { VALVE_SIDE, VALVE_SQUARE } from './catalog'

const STEP = 320 // de un cilindro al siguiente

export function pneumaticCircuit(cylinders, x = 0, y = 0, prefix = 'pn') {
  const components = []
  const wires = []
  let n = 0
  const add = (c) => components.push(c) && c.id
  const tube = (a, ta, b, tb) => wires.push({ id: `${prefix}-t${n++}`, from: { c: a, t: ta }, to: { c: b, t: tb } })
  const valveX = (cx) => cx + 20 - (VALVE_SIDE + VALVE_SQUARE + 20) // su conexión 4 bajo la A del cilindro
  const middle = x + ((cylinders.length - 1) * STEP) / 2
  const frl = add({ id: `${prefix}-frl`, type: 'frl', x: middle + 20, y: y + 400, tag: '0Z1' })
  const source = add({ id: `${prefix}-src`, type: 'airsource', x: middle + 20, y: y + 520, tag: '0P1' })
  tube(source, '1', frl, '1')
  cylinders.forEach((cyl, i) => {
    const cx = x + i * STEP
    const k = i + 1
    const cylinder = add({ id: `${prefix}-cyl${k}`, type: 'pcylinder', x: cx, y, tag: cyl.tag, acting: 'double', time: cyl.time ?? 1, initial: 0, text: cyl.text ?? '', ...(cyl.signal ? { signal: cyl.signal } : {}), ...(cyl.reverse ? { reverse: cyl.reverse } : {}) })
    const valve = add({ id: `${prefix}-v${k}`, type: 'pvalve', x: valveX(cx), y: y + 260, tag: `${k}V1`, ways: '5/2', sol14: cyl.sol14 ?? '', sol12: cyl.sol12 ?? '', manual: 'none', text: '' })
    tube(frl, '2', valve, '1')
    tube(valve, '4', cylinder, 'A')
    if (cyl.throttle === false) tube(valve, '2', cylinder, 'B')
    else {
      const throttle = add({ id: `${prefix}-r${k}`, type: 'throttle', x: cx + 120, y: y + 120, tag: `${k}V2`, setting: cyl.throttle ?? 0.5 })
      tube(valve, '2', throttle, '1')
      tube(throttle, '2', cylinder, 'B')
    }
  })
  return { components, wires }
}
