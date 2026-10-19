// Planta virtual -> PC_SIMU (.sim). PC_SIMU es un simulador de S7-200 muy usado en FP: carga el
// programa y lo prueba con un panel de pulsadores, pilotos y máquinas dibujadas.
//
// Formato (sacado de PC_SIMU.exe y comprobado con sus .sim de ejemplo; detalle en docs/formato-pcsimu.md):
//   PC_SIMU*  1* 50*<objeto>**<objeto>** … **<objeto>*$$$   (texto en Windows-1252)
//   objeto = n*tipo#nombre*x1*y1*x2*y2*f4*…*f17#texto#texto2#grupo*a*b
// n: orden desde 0; (x1, y1)-(x2, y2): rectángulo en la pantalla; f4…f17: 14 enteros cuyo sentido
// depende del tipo (en los de un bit, f5 y f7 son el byte y el bit de la dirección: I f5.f7 o Q f5.f7).
// 1008 es un texto suelto: rectángulo de 8 px por letra y 17 de alto; el texto va en «texto».
// Lo que no se exporta todavía (cilindros, cintas, depósitos…) sale en los avisos, con su tipo (en
// español, como los de la exportación a S7-200).
import { parseAddress } from './addressing'
import { encodeAnsi } from './ladder/exportS7200'
import { SCENE_TYPES } from './sim/scene'
import { t as tr } from './i18n'

export const PCSIMU_HEADER = 'PC_SIMU*  1* 50*'
export const PCSIMU_COLORS = { green: 0, black: 1, blue: 2, cyan: 3, red: 4, magenta: 5, yellow: 6, white: 7 }
export const PCSIMU_TYPES = { switch: 1, button: 2, limit: 6, detector: 7, led: 11, sound: 15, motor: 18, beacon: 29, text: 1008 }

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

// Lo que PC_SIMU recibe: cada tipo de la planta, con el objeto de PC_SIMU. Los campos de cada objeto
// están en docs/formato-pcsimu.md (sacados de PC_SIMU.exe: lo que hace con ellos su cuadro de
// propiedades). row: fila del panel (arriba las salidas, luego los mandos y abajo los detectores).
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
export const PCSIMU_SETA = 12 // Pulsador: f15 = 12 es la seta de emergencia (redonda, f16 = 0)
// Detector: f12 = 0 inductivo, 1 capacitivo, 2 ultrasonido. El óptico y el de color del editor, como
// capacitivo (detecta cualquier pieza).
const DETECTION = { inductive: 0, capacitive: 1 }
// El semáforo, como baliza (rojo f5.f7, ámbar f6.f8, verde f14.f15) si tiene las tres luces; si no,
// un led por luz.
const LIGHTS = [['red', 'red'], ['amber', 'yellow'], ['green', 'green']]
// f4: 1 en las salidas (led, motor, sonido) y 0 en las entradas; en finales de carrera y detectores es
// además si está pulsado mientras se simula, así que en el archivo va a 0. La baliza lo deja a 0.
const OBJECTS = {
  led: { type: 11, name: 'Led', size: [25, 25], fields: ({ byte, bit, color }) => [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, color, 0, 0] },
  button: { type: 2, name: 'Pulsador', size: [25, 25], fields: ({ byte, bit, nc, color }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, color, 0, 0] },
  switch: { type: 1, name: 'Interruptor', size: [25, 25], fields: ({ byte, bit, nc }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, 0, 0, 0] },
  // f14 = 2: accionado desde arriba (vertical); f15 = 0: el dibujo «Final de carrera 1».
  limit: { type: 6, name: 'Final de carrera', size: [20, 40], fields: ({ byte, bit, nc }) => [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 2, 0, 0, 0] },
  // f13 = 10: distancia de detección (la de PC_SIMU por defecto); f14 = 0: mira a la derecha; f15 = 1: «Detector 2».
  detector: { type: 7, name: 'Detector', size: [30, 20], fields: ({ byte, bit, nc, kind }) => [0, byte, 0, bit, 0, nc, 0, 0, kind, 10, 0, 1, 0, 0] },
  // Giro a la derecha en f5.f7 y a la izquierda en f6.f8; f16: 1 solo derecha, 11 las dos. f13: frecuencia
  // máxima del variador (100, la de PC_SIMU); f17 = 0: 3000 rpm.
  motor: { type: 18, name: 'Motor', size: [35, 35], fields: ({ byte, bit, left }) => [1, byte, left?.byte ?? 0, bit, left?.bit ?? 0, 0, 0, 0, 0, 100, 0, 0, left ? 11 : 1, 0] },
  sound: { type: 15, name: 'Sonido', size: [35, 35], fields: ({ byte, bit }) => [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  beacon: { type: 29, name: 'Baliza', size: [50, 125], fields: ({ red, amber, green }) => [0, red.byte, amber.byte, red.bit, amber.bit, 0, 0, 0, 0, 0, green.byte, green.bit, 0, 0] },
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
  const missing = (e, name, area) => warnings.push(`${name || typeName(e)}: sin una dirección ${area} de bit; no se exporta.`)
  const add = (e, object, area, row, name, extra = {}) => {
    const at = bitOf(name, area)
    if (!at) return missing(e, name, area)
    rows[row].push({ object, name, ...at, ...extra })
  }
  for (const e of elements) {
    if (e.type === 'trafficlight') {
      const lights = LIGHTS.filter(([key]) => e[key]?.trim())
      const at = Object.fromEntries(lights.map(([key]) => [key, bitOf(e[key].trim(), 'Q')]))
      if (lights.length === 3 && Object.values(at).every(Boolean)) {
        const name = e.text?.trim() || e.red.trim()
        rows[0].push({ object: 'beacon', name, ...at.red, ...at })
        continue
      }
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
    const color = e.type === 'emergency' ? PCSIMU_SETA : (PCSIMU_COLORS[e.color] ?? (kind.pcsimu === 'led' ? PCSIMU_COLORS.green : PCSIMU_COLORS.black))
    const nc = e.type === 'emergency' || e.contact === 'NC' ? 1 : 0
    const extra = { color, nc, kind: DETECTION[e.kind] ?? DETECTION.capacitive }
    if (e.type === 'motor') {
      const reverse = e.reverse?.trim()
      if (reverse) {
        extra.left = bitOf(reverse, 'Q')
        if (!extra.left) missing(e, reverse, 'Q')
        else warnings.push(`${name || typeName(e)}: en PC_SIMU, ${reverse} es la salida de giro a la izquierda (en el editor invierte el giro de la marcha).`)
      }
      if (e.pulses?.trim()) warnings.push(`${name || typeName(e)}: el encoder (${e.pulses.trim()}) no pasa a PC_SIMU.`)
    }
    add(e, kind.pcsimu, kind.area, kind.row, name, extra)
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
