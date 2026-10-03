// Esquema de conexiones del autómata a partir de la tabla de variables (lo que se monta en el
// cuadro): fuente de 24 V (L+ arriba, M abajo), el autómata con sus bornes y, en cada entrada y
// salida con dirección, el aparato que le corresponde según la planta:
//  - entradas: pulsador / interruptor / seta (con su contacto NA o NC), final de carrera, flotador,
//    termostato o detector de proximidad de 3 hilos (PNP, alimentado desde la fuente del autómata);
//  - salidas: electroválvula (cilindros), piloto (luces, sirenas, semáforos) o contactor (motores,
//    cintas…) o relé (lo demás).
// Cada aparato queda enlazado con su señal de la planta (pulsarlo en la planta acciona su
// contacto; la bobina mueve la planta). Entradas en sumidero (1M a M), salidas por relé (1L a L+).
import { GRID, nextTag, plcTerminals, sizeOf, terminalAddress } from './catalog'

const PLC_X = 100
// Sitio de un aparato en su fila: su ancho, su rótulo (92 px) y el accionamiento del siguiente.
const LABEL = 92
const GAP = 40
const slot = (c) => Math.ceil((sizeOf(c).w + 2 + LABEL + GAP) / GRID) * GRID
// Separación entre los tramos horizontales de los cables de entrada (o de salida).
const LANE = 20

// Aparato de una entrada según el elemento de la planta que da esa señal.
function inputDevice(name, scene) {
  for (const e of scene?.elements ?? []) {
    if (e.variable !== name) continue
    if (e.type === 'emergency') return { type: 'emergency', prefix: 'S' }
    if (e.type === 'button') return { type: 'pushbutton', prefix: 'S', contact: e.contact === 'NC' ? 'NC' : 'NO' }
    if (e.type === 'switch') return { type: 'switch', prefix: 'S', contact: e.contact === 'NC' ? 'NC' : 'NO' }
    if (e.type === 'limit') return { type: 'limit', prefix: 'B', contact: e.contact === 'NC' ? 'NC' : 'NO', kind: 'limit' }
    if (e.type === 'sensor') return { type: 'sensor3', prefix: 'B', output: 'PNP', kind: ['inductive', 'capacitive'].includes(e.kind) ? e.kind : 'optical' }
  }
  for (const e of scene?.elements ?? []) {
    if (e.type === 'tank' && [e.low, e.high, e.empty].includes(name)) return { type: 'limit', prefix: 'B', contact: 'NO', kind: 'float' }
    if (e.type === 'heater' && e.thermostat === name) return { type: 'limit', prefix: 'B', contact: 'NO', kind: 'thermostat' }
  }
  const sensor = (scene?.elements ?? []).some((e) => ['retracted', 'extended', 'opened', 'closed', 'holding'].some((k) => e[k] === name))
  return sensor ? { type: 'limit', prefix: 'B', contact: 'NO', kind: 'limit' } : { type: 'pushbutton', prefix: 'S', contact: 'NO' }
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
// esquema actual (lo nuevo se coloca debajo). Devuelve { components, wires, skipped, devices }.
// Disposición (sin textos ni cables que se pisen):
//  - arriba, los embarrados L+ y M (0 V, con sus cables hacia abajo); abajo, otro M para las cargas;
//  - el autómata: L+, M y 1M bajan rectos de los embarrados; 1L, puenteado desde su L+ por fuera;
//  - una fila de aparatos de entrada encima y otra de salida debajo, cada uno con el sitio de su
//    rótulo; cada cable a su borne por un tramo horizontal a su propia altura, escalonados para que
//    no se crucen entre ellos.
export function generatePlcWiring(variables, scene, existing = { components: [], wires: [] }) {
  const all = [...(existing.components ?? [])]
  const offset = all.length ? Math.ceil((Math.max(...all.map((c) => c.y)) + 300) / GRID) * GRID : 0
  // Analógicas con dirección: el autómata lleva sus bornes AIW / AQW (con esas direcciones).
  const analogAddr = (type, area) =>
    variables
      .filter((v) => v.type === type)
      .map((v) => terminalAddress(v.address))
      .filter((a) => a.startsWith(area))
  const aiAddrs = [...new Set(analogAddr('analogIn', 'AIW'))]
  const aqAddrs = [...new Set(analogAddr('analogOut', 'AQW'))]
  const plcBase = { type: 'plc', inputs: 14, outputs: 10, ...(aiAddrs.length ? { analogIn: aiAddrs.length, aiAddrs } : {}), ...(aqAddrs.length ? { analogOut: aqAddrs.length, aqAddrs } : {}) }
  const terms = plcTerminals(plcBase)
  const at = (id) => terms.find((t) => t.id === id)
  const byX = (a, b) => at(terminalAddress(a.address)).x - at(terminalAddress(b.address)).x
  const ins = variables.filter((v) => (v.type === 'input' || v.type === 'analogIn') && at(terminalAddress(v.address))).sort(byX)
  const outs = variables.filter((v) => v.type === 'output' && at(terminalAddress(v.address))).sort(byX)
  const skipped = variables.filter((v) => (v.type === 'input' || v.type === 'output' || v.type === 'analogIn') && !at(terminalAddress(v.address))).map((v) => v.name)

  // Alturas: embarrados, fila de entradas (80 px), sus tramos, autómata (120 px), tramos de las
  // salidas, fila de salidas (80 px) y el M de abajo.
  const top = offset
  const inY = top + 80
  const plcY = inY + 80 + LANE * (ins.length + 1)
  const outY = plcY + 120 + LANE * (outs.length + 1)
  const bottomY = outY + 140

  let n = 0
  const plcId = `plc-${Date.now().toString(36)}`
  const id = (p) => `${p}-${plcId}-${n++}`
  const plc = { id: plcId, ...plcBase, x: PLC_X, y: plcY, tag: nextTag(all, 'A'), text: 'Autómata' }
  all.push(plc)
  const components = [plc]
  const wires = []
  // bend / bendX: tramo del cable, medido desde su primer borne (lib/elec/route.js).
  const wire = (a, ta, b, tb, extra = {}) => wires.push({ id: id('w'), from: { c: a, t: ta }, to: { c: b, t: tb }, ...extra })

  // Aparatos de una fila, de izquierda a derecha, cada uno con el sitio de su rótulo y nunca a la
  // izquierda de su borne (col: dónde tiene el aparato el borne que va al autómata).
  const place = (list, make) => {
    let x = PLC_X + 40
    return list.map((v, i) => {
      const t = at(terminalAddress(v.address))
      const probe = make(v, 0)
      x = Math.max(x, PLC_X + t.x - probe.col)
      const c = make(v, x)
      x += slot(c)
      return { t, c, i }
    })
  }
  const inputs = place(ins, (v, x) => {
    if (v.type === 'analogIn') {
      const volts = v.analog?.signal === '0-10V'
      return { id: id('ain'), type: 'transmitter', x, y: inY, signal: v.name, text: v.comment || v.name, output: volts ? '0-10V' : '4-20mA', col: 40 }
    }
    const d = inputDevice(v.name, scene)
    return {
      id: id('in'),
      type: d.type,
      x,
      y: inY,
      signal: v.name,
      text: v.comment || v.name,
      ...(d.contact ? { contact: d.contact } : {}),
      ...(d.kind ? { kind: d.kind } : {}),
      ...(d.output ? { output: d.output } : {}),
      prefix: d.prefix,
      col: d.type === 'sensor3' ? 40 : 20,
    }
  })
  const outputs = place(outs, (v, x) => {
    const d = outputDevice(v.name, scene)
    return { id: id('out'), type: d.type, x, y: outY, signal: v.name, text: v.comment || v.name, ...(d.kind ? { kind: d.kind } : {}), ...(d.color ? { color: d.color } : {}), prefix: d.prefix, col: 20 }
  })
  const right = Math.max(PLC_X + Math.max(...terms.map((t) => t.x)) + 40, ...[...inputs, ...outputs].map(({ c }) => c.x + slot(c)))
  const left = PLC_X - 60
  const rail = (y, potential, extra = {}) => ({ id: id('rail'), type: 'rail', x: left, y, potential, length: right - left, ...extra })
  const lp = rail(top, 'L+')
  const m0 = rail(top + 20, 'M', { wires: 'down' })
  const m1 = rail(bottomY, 'M')
  components.push(lp, m0, m1)
  const tap = (x) => `t${Math.round((x - left) / GRID)}`

  // Autómata: alimentación y comunes (1L puenteado desde L+, por la izquierda del autómata).
  wire(lp.id, tap(PLC_X + at('L+').x), plc.id, 'L+')
  wire(m0.id, tap(PLC_X + at('M').x), plc.id, 'M')
  wire(m0.id, tap(PLC_X + at('1M').x), plc.id, '1M')
  wire(plc.id, 'L+', plc.id, '1L', { bendX: -40 })
  if (aiAddrs.length) wire(m0.id, tap(PLC_X + at('AM').x), plc.id, 'AM')

  // Entradas: el tramo horizontal de cada una, más abajo cuanto más a la derecha.
  for (const { t, c, i } of inputs) {
    const { col, prefix, ...device } = c
    device.tag = nextTag(all, prefix ?? 'B')
    all.push(device)
    components.push(device)
    const bend = { bend: LANE * (i + 1) }
    if (device.type === 'transmitter') {
      wire(lp.id, tap(device.x + 20), device.id, '+')
      if (device.output === '0-10V') {
        wire(m0.id, tap(device.x + 60), device.id, '0V')
        wire(device.id, 'OUT', plc.id, t.id, bend)
      } else wire(device.id, '−', plc.id, t.id, bend)
    } else if (device.type === 'sensor3') {
      // BN al +24 V, BU al 0 V y BK (salida) a la entrada.
      wire(lp.id, tap(device.x + 20), device.id, 'BN')
      wire(m0.id, tap(device.x + 60), device.id, 'BU')
      wire(device.id, 'BK', plc.id, t.id, bend)
    } else {
      const nc = device.type === 'emergency' || device.contact === 'NC'
      wire(lp.id, tap(device.x + 20), device.id, nc ? '11' : '13')
      wire(device.id, nc ? '12' : '14', plc.id, t.id, bend)
    }
    void col
  }
  // Salidas: el tramo de cada una, más arriba cuanto más a la derecha.
  for (const { t, c, i } of outputs) {
    const { col, prefix, ...device } = c
    device.tag = nextTag(all, prefix)
    all.push(device)
    components.push(device)
    const [a, b] = device.type === 'lamp' ? ['X1', 'X2'] : ['A1', 'A2']
    wire(plc.id, t.id, device.id, a, { bend: LANE * (outputs.length - i) })
    wire(device.id, b, m1.id, tap(device.x + 20))
    void col
  }
  return { components, wires, skipped, devices: inputs.length + outputs.length }
}
