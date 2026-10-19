// Planta virtual -> PC_SIMU (.sim). PC_SIMU es un simulador de S7-200 muy usado en FP: carga el
// programa y lo prueba con un panel de pulsadores, pilotos y máquinas dibujadas.
//
// Formato (deducido de los .sim de ejemplo de PC_SIMU, texto en Windows-1252):
//   PC_SIMU*  1* 50*<objeto>**<objeto>** … **<objeto>*$$$
//   objeto = n*tipo#nombre*x1*y1*x2*y2*f4*…*f17#texto#texto2#grupo*a*b
// n: orden desde 0; (x1, y1)-(x2, y2): rectángulo en la pantalla; f4…f17: 14 enteros cuyo
// sentido depende del tipo. En todos los que se exportan, f4 dice si es entrada (0) o salida (1) y
// f5 y f7 son el byte y el bit de la dirección (I f5.f7 o Q f5.f7). Además:
//   2 Pulsador, 1 Interruptor, 6 Final de carrera, 7 Detector: f9 1 = contacto NC.
//   2 Pulsador, 1 Interruptor, 11 Led: f15 color, f16 modelo o forma (0 = redondo).
//   18 Motor, 15 Sonido: salidas, con los demás campos copiados de los ejemplos.
//   1008 texto suelto: rectángulo de 8 px por letra y 17 de alto; el texto va en «texto».
// Colores (f15), comprobados en PC_SIMU, iguales en leds y pulsadores (redondos y cuadrados): 0 verde,
// 1 negro, 2 azul, 3 cian, 4 rojo, 5 magenta, 6 amarillo, 7 blanco. Con f16 = 1 los pulsadores son
// cuadrados y admiten además 8 verde oscuro, 9 marcha «I», 11 paro «O» y 13 amarillo; valores fuera
// de estos pueden cerrar PC_SIMU.
// Lo que no se exporta todavía (cilindros, cintas, depósitos…) sale en los avisos, con su tipo (en español, como los de la exportación a S7-200).
import { parseAddress } from './addressing'
import { encodeAnsi } from './ladder/exportS7200'
import { SCENE_TYPES } from './sim/scene'
import { t as tr } from './i18n'

export const PCSIMU_HEADER = 'PC_SIMU*  1* 50*'
export const PCSIMU_COLORS = { green: 0, black: 1, blue: 2, cyan: 3, red: 4, magenta: 5, yellow: 6, white: 7 }
export const PCSIMU_TYPES = { switch: 1, button: 2, limit: 6, detector: 7, led: 11, sound: 15, motor: 18, text: 1008 }

// Lo que no puede ir en un campo: los separadores del formato.
const clean = (text) => String(text ?? '').replace(/[#*$]/g, ' ').trim()

export function pcsimuRecord(n, { type, name = '', rect, fields = [], text = '', text2 = '', group = '', a = 0, b = 0 }) {
  const f = Array.from({ length: 14 }, (_, i) => fields[i] ?? 0)
  return `${n}*${type}#${clean(name)}*${[...rect, ...f].map((v) => Math.round(v)).join('*')}#${clean(text)}#${clean(text2)}#${clean(group)}*${a}*${b}`
}

// (sin objetos, solo la cabecera y el cierre)
export const pcsimuText = (objects) => `${PCSIMU_HEADER}${objects.map((o, n) => `${pcsimuRecord(n, o)}*`).join('*')}$$$`

// Lectura (la usan las pruebas y, más adelante, la importación). Lo que hay tras «$$$» es basura
// que PC_SIMU deja al guardar: se ignora.
const RECORD = /(\d+)\*(\d+)#([^*#]*)\*((?:-?\d+\*){17}-?\d+)#(.*?)#([^#]*)#([^*#]*)\*(-?\d+)\*(-?\d+)\*?/y
export function parsePcSimu(content) {
  const body = String(content).split('$$$')[0]
  if (!body.startsWith('PC_SIMU*')) throw new Error('No es un archivo de PC_SIMU')
  const objects = []
  RECORD.lastIndex = PCSIMU_HEADER.length
  while (RECORD.lastIndex < body.length) {
    const m = RECORD.exec(body)
    if (!m) throw new Error(`Objeto ${objects.length + 1} de PC_SIMU ilegible`)
    const numbers = m[4].split('*').map(Number)
    objects.push({ type: Number(m[2]), name: m[3], rect: numbers.slice(0, 4), fields: numbers.slice(4), text: m[5], text2: m[6], group: m[7], a: Number(m[8]), b: Number(m[9]) })
    if (body[RECORD.lastIndex] === '*') RECORD.lastIndex++
  }
  return objects
}

// Lo que PC_SIMU recibe: cada tipo de la planta, con el objeto de PC_SIMU y sus campos. Los campos
// copian un objeto de los .sim de ejemplo (así PC_SIMU no se encuentra valores que no conoce) y solo
// cambian la dirección (f5 byte, f7 bit), el contacto (f9: 1 = NC) y el color (f15).
//   row: fila del panel (arriba las salidas, luego los mandos y abajo los detectores).
const KINDS = {
  button: { pcsimu: 'button', area: 'I', row: 1 },
  emergency: { pcsimu: 'button', area: 'I', row: 1 },
  switch: { pcsimu: 'switch', area: 'I', row: 1 },
  lamp: { pcsimu: 'led', area: 'Q', row: 0 },
  limit: { pcsimu: 'limit', area: 'I', row: 2 },
  sensor: { pcsimu: 'detector', area: 'I', row: 2 },
  motor: { pcsimu: 'motor', area: 'Q', row: 0 },
  siren: { pcsimu: 'sound', area: 'Q', row: 0 },
}
// Las patas que no pasan (con su aviso): el giro inverso y el encoder del motor.
const EXTRA = { motor: ['reverse', 'pulses'] }
// El semáforo: un led por luz (rojo, ámbar y verde), seguidos en la fila de las salidas.
const LIGHTS = [['red', 'red'], ['amber', 'yellow'], ['green', 'green']]
const OBJECTS = {
  led: { type: 11, name: 'Led', size: [25, 25], fields: ({ byte, bit, color }) => [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, color, 0, 0] },
  button: { type: 2, name: 'Pulsador', size: [25, 25], fields: ({ byte, bit, nc, color }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, color, 0, 0] },
  switch: { type: 1, name: 'Interruptor', size: [25, 25], fields: ({ byte, bit, nc, color }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, color, 0, 0] },
  limit: { type: 6, name: 'Final de carrera', size: [20, 40], fields: ({ byte, bit, nc }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 10, 2, 0, 0, 0] },
  detector: { type: 7, name: 'Detector', size: [30, 20], fields: ({ byte, bit, nc }) => [0, byte, 0, bit, 0, nc, 0, 0, 1, 0, 0, 1, 0, 0] },
  motor: { type: 18, name: 'Motor', size: [35, 35], fields: ({ byte, bit }) => [1, byte, 0, bit, 1, 0, 1, 0, 1, 100, 0, 0, 1, 0] },
  sound: { type: 15, name: 'Sonido', size: [35, 35], fields: ({ byte, bit }) => [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
}
const CELL = 80 // ancho mínimo de cada columna; más si el nombre debajo es más largo
const PER_ROW = 8
const label = (text, cx, y) => ({ type: PCSIMU_TYPES.text, rect: [cx - 4 * text.length, y, cx + 4 * text.length, y + 17], text })

// project -> { text, bytes (Windows-1252), warnings, count }. Arriba las salidas, en medio los mandos y
// abajo los detectores, cada uno con el nombre de su variable debajo.
export function exportPcSimu(project) {
  const plc = project.plc ?? {}
  const elements = plc.scene?.elements ?? []
  const warnings = []
  const skipped = new Map()
  const rows = [[], [], []]
  const typeName = (e) => tr(SCENE_TYPES[e.type]?.label ?? e.type)
  // Una pata (variable) del elemento -> { byte, bit } si tiene una dirección de bit del área pedida.
  const bitOf = (name, area) => {
    const a = parseAddress(name ? plc.variables?.[name]?.address : '')
    return a && a.area === area && a.index !== undefined ? { byte: Math.floor(a.index / 8), bit: a.index % 8 } : null
  }
  const add = (e, object, area, row, name, extra = {}) => {
    const at = bitOf(name, area)
    if (!at) {
      warnings.push(`${name || typeName(e)}: sin una dirección ${area} de bit; no se exporta.`)
      return
    }
    rows[row].push({ object, name, ...at, ...extra })
  }
  for (const e of elements) {
    if (e.type === 'trafficlight') {
      const lights = LIGHTS.filter(([key]) => e[key]?.trim())
      if (!lights.length) warnings.push(`${typeName(e)}: sin salidas; no se exporta.`)
      for (const [key, color] of lights) add(e, 'led', 'Q', 0, e[key].trim(), { color: PCSIMU_COLORS[color] })
      continue
    }
    const kind = KINDS[e.type]
    if (!kind) {
      if (SCENE_TYPES[e.type]?.group !== 'Decoración') skipped.set(e.type, (skipped.get(e.type) ?? 0) + 1)
      continue
    }
    const name = e.variable?.trim()
    const color = PCSIMU_COLORS[e.type === 'emergency' ? 'red' : e.color] ?? (kind.pcsimu === 'led' ? PCSIMU_COLORS.green : PCSIMU_COLORS.black)
    const nc = e.type === 'emergency' || e.contact === 'NC' ? 1 : 0
    add(e, kind.pcsimu, kind.area, kind.row, name, { color, nc })
    if (name && e.type === 'emergency') warnings.push(`${name}: la seta sale como un pulsador rojo normalmente cerrado.`)
    for (const leg of EXTRA[e.type] ?? []) {
      if (e[leg]?.trim()) warnings.push(`${name || typeName(e)}: ${leg === 'reverse' ? 'el giro inverso' : 'el encoder'} (${e[leg].trim()}) no pasa a PC_SIMU.`)
    }
  }
  const objects = []
  let y = 40
  for (const row of rows) {
    if (!row.length) continue
    row.sort((p, q) => p.byte - q.byte || p.bit - q.bit)
    for (let start = 0; start < row.length; start += PER_ROW) {
      const line = row.slice(start, start + PER_ROW)
      const height = Math.max(...line.map((item) => OBJECTS[item.object].size[1]))
      let x = 40
      for (const item of line) {
        const { type, name, size, fields } = OBJECTS[item.object]
        const width = Math.max(CELL, 8 * item.name.length + 16)
        const cx = x + width / 2
        // Todos con la base a la misma altura, y el nombre debajo.
        const rect = [cx - size[0] / 2, y + height - size[1], cx + size[0] / 2, y + height]
        objects.push({ type, name, rect, fields: fields(item) })
        objects.push(label(item.name, cx, y + height + 12))
        x += width
      }
      y += height + 60
    }
    y += 20
  }
  if (skipped.size) {
    const list = [...skipped].map(([type, n]) => `${tr(SCENE_TYPES[type]?.label ?? type)} (${n})`).join(', ')
    warnings.push(`Todavía no pasan a PC_SIMU: ${list}.`)
  }
  const text = pcsimuText(objects)
  return { text, bytes: encodeAnsi(text), warnings, count: objects.filter((o) => o.type !== PCSIMU_TYPES.text).length }
}
