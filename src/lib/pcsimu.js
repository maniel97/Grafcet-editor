// Planta virtual -> PC_SIMU (.sim). PC_SIMU es un simulador de S7-200 muy usado en FP: carga el
// programa y lo prueba con un panel de pulsadores, pilotos y máquinas dibujadas.
//
// Formato (deducido de los .sim de ejemplo de PC_SIMU, texto en Windows-1252):
//   PC_SIMU*  1* 50*<objeto>**<objeto>** … **<objeto>*$$$
//   objeto = n*tipo#nombre*x1*y1*x2*y2*f4*…*f17#texto#texto2#grupo*a*b
// n: orden desde 0; (x1, y1)-(x2, y2): rectángulo en la pantalla; f4…f17: 14 enteros cuyo
// sentido depende del tipo. Lo que se sabe de los del panel (paso 1: solo el panel de mando):
//   2 Pulsador, 1 Interruptor: f5 byte y f7 bit de la entrada (I f5.f7), f9 1 = contacto NC,
//     f15 color, f16 modelo (0 = redondo).
//   11 Led: f4 = 1, f5 byte y f7 bit de la salida (Q f5.f7), f15 color, f16 forma (0 = redondo).
//   1008 texto suelto: rectángulo de 8 px por letra y 17 de alto; el texto va en «texto».
// Colores (f15), comprobados en PC_SIMU, iguales en leds y pulsadores (redondos y cuadrados): 0 verde,
// 1 negro, 2 azul, 3 cian, 4 rojo, 5 magenta, 6 amarillo, 7 blanco. Con f16 = 1 los pulsadores son
// cuadrados y admiten además 8 verde oscuro, 9 marcha «I», 11 paro «O» y 13 amarillo; valores fuera
// de estos pueden cerrar PC_SIMU.
// Lo que pase por algo que no se exporta todavía (cilindros, cintas, detectores…) sale en los
// avisos, con su tipo (en español, como los de la exportación a S7-200).
import { parseAddress } from './addressing'
import { encodeAnsi } from './ladder/exportS7200'
import { SCENE_TYPES } from './sim/scene'
import { t as tr } from './i18n'

export const PCSIMU_HEADER = 'PC_SIMU*  1* 50*'
export const PCSIMU_COLORS = { green: 0, black: 1, blue: 2, cyan: 3, red: 4, magenta: 5, yellow: 6, white: 7 }
export const PCSIMU_TYPES = { switch: 1, button: 2, led: 11, text: 1008 }

// Lo que no puede ir en un campo: los separadores del formato.
const clean = (text) => String(text ?? '').replace(/[#*$]/g, ' ').trim()

export function pcsimuRecord(n, { type, name = '', rect, fields = [], text = '', text2 = '', group = '', a = 0, b = 0 }) {
  const f = Array.from({ length: 14 }, (_, i) => fields[i] ?? 0)
  return `${n}*${type}#${clean(name)}*${[...rect, ...f].map((v) => Math.round(v)).join('*')}#${clean(text)}#${clean(text2)}#${clean(group)}*${a}*${b}`
}

export const pcsimuText = (objects) => `${PCSIMU_HEADER}${objects.map((o, n) => pcsimuRecord(n, o)).join('**')}*$$$`

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

// Mandos y señalización del panel que PC_SIMU recibe en este paso.
const KINDS = {
  button: { pcsimu: 'button', area: 'I' },
  emergency: { pcsimu: 'button', area: 'I' },
  switch: { pcsimu: 'switch', area: 'I' },
  lamp: { pcsimu: 'led', area: 'Q' },
}
const SIZE = 25 // pulsadores, interruptores y leds: 25 x 25, como en los ejemplos
const STEP = 80 // de un mando al siguiente
const PER_ROW = 8
const label = (text, cx, y) => ({ type: PCSIMU_TYPES.text, rect: [cx - 4 * text.length, y, cx + 4 * text.length, y + 17], text })

// project -> { text, bytes (Windows-1252), warnings, count }. Arriba los pilotos y abajo los mandos,
// como en los paneles de PC_SIMU, cada uno con el nombre de su variable debajo.
export function exportPcSimu(project) {
  const plc = project.plc ?? {}
  const elements = plc.scene?.elements ?? []
  const warnings = []
  const skipped = new Map()
  const rows = { Q: [], I: [] }
  for (const e of elements) {
    const kind = KINDS[e.type]
    if (!kind) {
      if (SCENE_TYPES[e.type]?.group !== 'Decoración') skipped.set(e.type, (skipped.get(e.type) ?? 0) + 1)
      continue
    }
    const name = e.variable?.trim()
    const address = name ? plc.variables?.[name]?.address : ''
    const a = parseAddress(address)
    if (!name || !a || a.area !== kind.area || a.index === undefined) {
      warnings.push(`${name || tr(SCENE_TYPES[e.type].label)}: sin una dirección ${kind.area} de bit; no se exporta.`)
      continue
    }
    rows[kind.area].push({ e, kind, name, byte: Math.floor(a.index / 8), bit: a.index % 8 })
  }
  for (const r of Object.values(rows)) r.sort((p, q) => p.byte - q.byte || p.bit - q.bit)
  const objects = []
  let y = 40
  for (const area of ['Q', 'I']) {
    rows[area].forEach((item, i) => {
      if (i && i % PER_ROW === 0) y += STEP
      const x = 40 + (i % PER_ROW) * STEP
      const rect = [x, y, x + SIZE, y + SIZE]
      const { e, kind, name, byte, bit } = item
      const color = PCSIMU_COLORS[e.type === 'emergency' ? 'red' : e.color] ?? (kind.pcsimu === 'led' ? PCSIMU_COLORS.green : PCSIMU_COLORS.black)
      const nc = e.type === 'emergency' || e.contact === 'NC' ? 1 : 0
      if (kind.pcsimu === 'led') objects.push({ type: PCSIMU_TYPES.led, name: 'Led', rect, fields: [1, byte, 0, bit, 0, 0, 0, 0, 0, 0, 0, color, 0, 0] })
      else objects.push({ type: PCSIMU_TYPES[kind.pcsimu], name: kind.pcsimu === 'switch' ? 'Interruptor' : 'Pulsador', rect, fields: [0, byte, 0, bit, 0, nc, 0, 0, 0, 0, 0, color, 0, 0] })
      if (e.type === 'emergency') warnings.push(`${name}: la seta sale como un pulsador rojo normalmente cerrado.`)
      objects.push(label(name, x + SIZE / 2, y + SIZE + 12))
    })
    if (rows[area].length) y += STEP + 20
  }
  if (skipped.size) {
    const list = [...skipped].map(([type, n]) => `${tr(SCENE_TYPES[type]?.label ?? type)} (${n})`).join(', ')
    warnings.push(`PC_SIMU recibe por ahora solo el panel de mando; no se exportan: ${list}.`)
  }
  const text = pcsimuText(objects)
  return { text, bytes: encodeAnsi(text), warnings, count: objects.filter((o) => o.type !== PCSIMU_TYPES.text).length }
}
