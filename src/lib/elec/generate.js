// Esquema de conexiones del autómata a partir de la tabla de variables (lo que se monta en el
// cuadro): fuente de 24 V (L+ arriba, M abajo), el autómata con sus bornes y, en cada entrada y
// salida con dirección, el aparato que le corresponde según la planta:
//  - entradas: pulsador / interruptor / seta (con su contacto NA o NC) o final de carrera;
//  - salidas: electroválvula (cilindros), piloto (luces, sirenas, semáforos) o contactor (motores,
//    cintas…) o relé (lo demás).
// Cada aparato queda enlazado con su señal de la planta (pulsarlo en la planta acciona su
// contacto; la bobina mueve la planta). Entradas en sumidero (1M a M), salidas por relé (1L a L+).
import { GRID, nextTag, plcTerminals, terminalAddress } from './catalog'

const PLC_X = 100
const PLC_Y = 300

// Aparato de una entrada según el elemento de la planta que da esa señal.
function inputDevice(name, scene) {
  for (const e of scene?.elements ?? []) {
    if (e.variable !== name) continue
    if (e.type === 'emergency') return { type: 'emergency', prefix: 'S' }
    if (e.type === 'button') return { type: 'pushbutton', prefix: 'S', contact: e.contact === 'NC' ? 'NC' : 'NO' }
    if (e.type === 'switch') return { type: 'switch', prefix: 'S', contact: e.contact === 'NC' ? 'NC' : 'NO' }
    if (e.type === 'limit' || e.type === 'sensor') return { type: 'limit', prefix: 'B', contact: e.contact === 'NC' ? 'NC' : 'NO' }
  }
  const sensor = (scene?.elements ?? []).some((e) => ['retracted', 'extended', 'low', 'high', 'empty', 'opened', 'closed', 'holding'].some((k) => e[k] === name))
  return sensor ? { type: 'limit', prefix: 'B', contact: 'NO' } : { type: 'pushbutton', prefix: 'S', contact: 'NO' }
}

// Aparato de una salida.
function outputDevice(name, scene) {
  for (const e of scene?.elements ?? []) {
    if (e.type === 'cylinder' && (e.extend === name || e.retract === name || e.vacuum === name)) return { type: 'valve', prefix: 'Y' }
    if (e.type === 'valve' && e.variable === name) return { type: 'valve', prefix: 'Y' }
    if ((e.type === 'lamp' || e.type === 'siren') && e.variable === name) return { type: 'lamp', prefix: 'H', color: e.color ?? 'green' }
    if (e.type === 'trafficlight' && [e.red, e.amber, e.green].includes(name)) return { type: 'lamp', prefix: 'H', color: e.red === name ? 'red' : e.amber === name ? 'amber' : 'green' }
    if (['motor', 'conveyor', 'diverter', 'heater'].includes(e.type) && [e.variable, e.motor, e.reverse, e.gate, e.heat].includes(name))
      return { type: 'coil', prefix: 'KM', kind: 'contactor' }
  }
  return { type: 'coil', prefix: 'KA', kind: 'relay' }
}

// variables: las del modelo ({ name, type, address, comment }); scene: plc.scene; existing: el
// esquema actual (lo nuevo se coloca debajo). Devuelve { components, wires, skipped }.
export function generatePlcWiring(variables, scene, existing = { components: [], wires: [] }) {
  const all = [...(existing.components ?? [])]
  const offset = all.length ? Math.ceil((Math.max(...all.map((c) => c.y)) + 300) / GRID) * GRID : 0
  const plc = { id: `plc-${Date.now().toString(36)}`, type: 'plc', x: PLC_X, y: PLC_Y + offset, tag: nextTag(all, 'A'), inputs: 14, outputs: 10, text: 'Autómata' }
  all.push(plc)
  const terms = plcTerminals(plc)
  const at = (id) => terms.find((t) => t.id === id)
  const components = [plc]
  const wires = []
  let n = 0
  const id = (p) => `${p}-${plc.id}-${n++}`
  const wire = (a, ta, b, tb) => wires.push({ id: id('w'), from: { c: a, t: ta }, to: { c: b, t: tb } })

  const ins = variables.filter((v) => v.type === 'input' && at(terminalAddress(v.address)))
  const outs = variables.filter((v) => v.type === 'output' && at(terminalAddress(v.address)))
  const skipped = variables.filter((v) => (v.type === 'input' || v.type === 'output') && !at(terminalAddress(v.address))).map((v) => v.name)
  const width = Math.max(...terms.map((t) => t.x)) + 40

  // Fuente de 24 V: L+ arriba, M abajo (embarrados con tomas cada 20 px desde x = PLC_X).
  const top = { id: id('rail'), type: 'rail', x: PLC_X, y: PLC_Y + offset - 200, potential: 'L+', length: width }
  const bottom = { id: id('rail'), type: 'rail', x: PLC_X, y: PLC_Y + offset + 290, potential: 'M', length: width }
  components.push(top, bottom)
  const tap = (x) => `t${Math.round((x - PLC_X) / GRID)}`
  wire(top.id, tap(PLC_X + at('L+').x), plc.id, 'L+')
  wire(plc.id, 'M', bottom.id, tap(PLC_X + at('M').x))
  wire(plc.id, '1M', bottom.id, tap(PLC_X + at('1M').x))
  wire(top.id, tap(PLC_X + at('1L').x), plc.id, '1L')

  for (const v of ins) {
    const t = at(terminalAddress(v.address))
    const d = inputDevice(v.name, scene)
    const nc = d.type === 'emergency' || d.contact === 'NC'
    const c = { id: id('in'), type: d.type, x: PLC_X + t.x - 20, y: PLC_Y + offset - 140, tag: nextTag(all, d.prefix), signal: v.name, text: v.comment || v.name, ...(d.contact ? { contact: d.contact } : {}) }
    all.push(c)
    components.push(c)
    wire(top.id, tap(PLC_X + t.x), c.id, nc ? '11' : '13')
    wire(c.id, nc ? '12' : '14', plc.id, t.id)
  }
  for (const v of outs) {
    const t = at(terminalAddress(v.address))
    const d = outputDevice(v.name, scene)
    const c = {
      id: id('out'),
      type: d.type,
      x: PLC_X + t.x - 20,
      y: PLC_Y + offset + 180,
      tag: nextTag(all, d.prefix),
      signal: v.name,
      text: v.comment || v.name,
      ...(d.kind ? { kind: d.kind } : {}),
      ...(d.color ? { color: d.color } : {}),
    }
    all.push(c)
    components.push(c)
    const [a, b] = d.type === 'lamp' ? ['X1', 'X2'] : ['A1', 'A2']
    wire(plc.id, t.id, c.id, a)
    wire(c.id, b, bottom.id, tap(PLC_X + t.x))
  }
  return { components, wires, skipped }
}
