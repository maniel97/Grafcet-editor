// Importar un panel o una planta de PC_SIMU (.sim) como planta virtual del editor (vista de frente), con su
// tabla de variables. Es lo contrario de exportPcSimu (lib/pcsimu.js): el formato y lo que hace cada campo,
// en docs/formato-pcsimu.md. Lo que no tiene equivalente se cuenta en los avisos.
import { parsePcSimu, PCSIMU_SETA } from './pcsimu'
import { MOTOR_LOOKS, SCENE_VARS, TOOL_LOOKS, rotate } from './sim/scene'

const f = (o, k) => o.fields[k - 4] ?? 0
const COLOR_OF = { 0: 'green', 1: 'black', 2: 'blue', 3: 'blue', 4: 'red', 5: 'red', 6: 'yellow', 7: 'white' }
// Orientación de PC_SIMU (0 derecha, 1 izquierda, 2 arriba, 3 abajo) -> giro del editor.
const ROT = { 0: 0, 1: 180, 2: 270, 3: 90 }
// Lado por el que se acciona un final de carrera -> giro del editor.
const LIMIT_ROT = { 2: 0, 0: 90, 3: 180, 1: 270 }
const DESK = new Set(['button', 'switch', 'emergency', 'selector', 'keypad', 'potentiometer', 'lamp', 'bargraph', 'digit', 'digitSwitch'])

// Color de Windows (COLORREF: 0x00BBGGRR) -> #rrggbb.
const colorOf = (c) => `#${[c & 255, (c >> 8) & 255, (c >> 16) & 255].map((v) => v.toString(16).padStart(2, '0')).join('')}`
const center = (r) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]
// Ancla del elemento (x, y) para que su rectángulo local (lx, ly, w, h), girado `rot`, quede centrado en el
// del archivo: lo contrario de worldRect.
function anchor(rect, rot, lx, ly, w, h) {
  const [cx, cy] = center(rect)
  const [dx, dy] = rotate(lx + w / 2, ly + h / 2, rot)
  return { x: Math.round(cx - dx), y: Math.round(cy - dy) }
}
// Nombre de variable a partir de un rótulo: letras, cifras y _ (como el resto del editor).
const cleanName = (text) => {
  const s = String(text ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}_]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return !s ? '' : /^\p{N}/u.test(s) ? `_${s}` : s
}

// images: { [nombre del archivo, en minúsculas]: data URL } — las imágenes elegidas junto al .sim.
export function importPcSimu(text, images = {}) {
  const objects = parsePcSimu(text)
  if (!objects.length && !/^PC_SIMU\*/.test(text)) throw new Error('No es un archivo de PC_SIMU.')
  const warnings = []
  const variables = {}
  const elements = []
  const from = new Map() // elemento -> el objeto del .sim de que sale (para los montajes por grupo)
  const byAddress = new Map()
  const skipped = new Map()
  const skip = (what) => skipped.set(what, (skipped.get(what) ?? 0) + 1)

  // Rótulos sueltos: dan nombre a la variable del objeto que tienen al lado (a menos de 40 px de su borde); los
  // demás, rótulos de la planta.
  const captions = objects.filter((o) => o.type === 1008 && o.text?.trim()).map((o) => ({ o, used: false, c: center(o.rect) }))
  const captionFor = (o) => {
    const [x1, y1, x2, y2] = o.rect
    let best = null
    for (const c of captions) {
      if (c.used) continue
      const [x, y] = c.c
      const d = Math.hypot(Math.max(x1 - x, 0, x - x2), Math.max(y1 - y, 0, y - y2))
      if (d < 40 && (!best || d < best.d)) best = { c, d }
    }
    return best?.c
  }
  // La variable de un bit (o de una palabra analógica): una por dirección, con el nombre de su rótulo.
  const variable = (o, area, address, type) => {
    if (byAddress.has(address)) return byAddress.get(address)
    const c = captionFor(o)
    let name = cleanName(c?.o.text) || cleanName(address)
    if (c) c.used = true
    for (let k = 2; variables[name]; k++) name = `${cleanName(c?.o.text) || cleanName(address)}_${k}`
    variables[name] = { type, address, comment: '' }
    byAddress.set(address, name)
    return name
  }
  // Un bit fuera de rango (un campo que en ese objeto quiere decir otra cosa): sin variable.
  const bitOk = (byte, bit) => Number.isInteger(byte) && Number.isInteger(bit) && byte >= 0 && byte < 128 && bit >= 0 && bit <= 7
  const input = (o, byte, bit) => (bitOk(byte, bit) ? variable(o, 'I', `I${byte}.${bit}`, 'input') : '')
  const output = (o, byte, bit) => (bitOk(byte, bit) ? variable(o, 'Q', `Q${byte}.${bit}`, 'output') : '')
  let n = 0
  const add = (o, type, props) => {
    const e = { id: `pc${++n}`, type, rot: 0, text: '', ...props }
    from.set(e, o)
    if (DESK.has(type)) {
      e.place = 'desk'
      e.order = o.rect[1] * 10000 + o.rect[0]
    }
    elements.push(e)
    return e
  }
  const at = (o) => ({ x: Math.round(center(o.rect)[0]), y: Math.round(center(o.rect)[1]) })

  // Actuadores (tipo 19) por su nombre, para colgarles las ventosas y pinzas de su grupo.
  const carriers = []
  const tools = []
  const paints = []
  let inclined = 0
  // Las imágenes del .sim van aparte, con su nombre (a veces con la ruta del ordenador en que se hizo).
  const missing = new Set()
  const bitmap = (path) => {
    const name = String(path ?? '').trim().split(/[\\/]/).pop().toLowerCase()
    if (!name) return ''
    if (images[name]) return images[name]
    missing.add(name)
    return ''
  }
  for (const o of objects) {
    const W = o.rect[2] - o.rect[0]
    const H = o.rect[3] - o.rect[1]
    switch (o.type) {
      case 2: {
        const seta = f(o, 15) === PCSIMU_SETA
        add(o, seta ? 'emergency' : 'button', { variable: input(o, f(o, 5), f(o, 7)), contact: f(o, 9) ? 'NC' : 'NO', ...(seta ? {} : { color: COLOR_OF[f(o, 15)] ?? 'green' }) })
        break
      }
      case 1:
        add(o, 'switch', { variable: input(o, f(o, 5), f(o, 7)), contact: f(o, 9) ? 'NC' : 'NO' })
        break
      case 11:
        add(o, 'lamp', { variable: output(o, f(o, 5), f(o, 7)), color: COLOR_OF[f(o, 15)] ?? 'green' })
        break
      case 15:
        add(o, 'siren', { ...at(o), variable: output(o, f(o, 5), f(o, 7)) })
        break
      case 18:
        add(o, 'motor', { ...at(o), variable: output(o, f(o, 5), f(o, 7)), reverse: f(o, 16) === 11 ? output(o, f(o, 6), f(o, 8)) : '' })
        break
      case 29:
        add(o, 'trafficlight', { ...at(o), red: output(o, f(o, 5), f(o, 7)), amber: output(o, f(o, 6), f(o, 8)), green: output(o, f(o, 14), f(o, 15)) })
        break
      case 3: {
        const positions = Math.min(4, Math.max(2, f(o, 9)))
        if (f(o, 9) > 4) warnings.push(`Selector de ${f(o, 9)} posiciones: en el editor, de 4 como mucho.`)
        const base = f(o, 5) * 8 + f(o, 7)
        const pos = Object.fromEntries(Array.from({ length: positions }, (_, i) => [`pos${i + 1}`, input(o, Math.floor((base + i) / 8), (base + i) % 8)]))
        add(o, 'selector', { positions, ...pos, initial: 0 })
        break
      }
      case 4: {
        if (f(o, 16) === 1) {
          skip('teclado en matriz')
          break
        }
        const columns = Math.max(1, f(o, 11))
        const count = Math.min(12, Math.max(1, f(o, 10) * columns))
        const base = f(o, 5) * 8 + f(o, 7)
        const keys = Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i + 1}`, input(o, Math.floor((base + i) / 8), (base + i) % 8)]))
        add(o, 'keypad', { count, columns, labels: Array.from({ length: count }, (_, i) => i + 1).join(','), ...keys })
        break
      }
      case 17: {
        const name = variable(o, 'AI', `AIW${f(o, 5)}`, 'analogIn')
        add(o, 'potentiometer', { variable: name, initial: 0.5 })
        break
      }
      case 16: {
        const name = variable(o, 'AQ', `AQW${f(o, 5)}`, 'analogOut')
        add(o, 'bargraph', { variable: name, min: f(o, 13), max: f(o, 12) || 100, vertical: f(o, 9) === 0 })
        break
      }
      case 6: {
        const rot = LIMIT_ROT[f(o, 14)] ?? 0
        add(o, 'limit', { ...anchor(o.rect, rot, -6, -8, 12, 23), rot, variable: input(o, f(o, 5), f(o, 7)), contact: f(o, 9) ? 'NC' : 'NO' })
        break
      }
      case 7:
      case 8:
      case 9: {
        const rot = ROT[f(o, 14)] ?? 0
        const kind = { 0: 'inductive', 1: 'capacitive' }[f(o, 12)] ?? 'optical'
        add(o, 'sensor', { ...anchor(o.rect, rot, -10, -5, 20, 10), rot, variable: input(o, f(o, 5), f(o, 7)), contact: f(o, 9) ? 'NC' : 'NO', kind, range: f(o, 13) || 20 })
        break
      }
      case 20: {
        add(o, 'conveyor', {
          ...anchor(o.rect, 0, 0, -15, W, 30),
          length: W,
          motor: f(o, 16) === 1 ? output(o, f(o, 5), f(o, 7)) : '',
          reverse: f(o, 15) === 1 ? output(o, f(o, 6), f(o, 8)) : '',
          time: 4,
        })
        break
      }
      case 25: {
        const trigger = f(o, 10) === 1 ? (f(o, 4) === 1 ? output(o, f(o, 5), f(o, 7)) : input(o, f(o, 5), f(o, 7))) : ''
        add(o, 'feeder', { ...at(o), trigger, auto: f(o, 9) === 1, sizes: W >= 40 ? 'large' : 'small', material: f(o, 16) === 5 ? 'metal' : 'plastic' })
        break
      }
      case 21:
        add(o, 'barrier', {
          ...anchor(o.rect, 0, 0, -22, W, 22),
          length: W,
          open: output(o, f(o, 5), f(o, 7)),
          close: output(o, f(o, 6), f(o, 8)),
          closed: f(o, 10) ? input(o, f(o, 14), f(o, 15)) : '',
          opened: f(o, 11) ? input(o, f(o, 16), f(o, 9)) : '',
        })
        break
      case 26:
        if (f(o, 14) === 3 || f(o, 14) === 4) {
          const rot = f(o, 14) === 4 ? 180 : 0
          add(o, 'ramp', { ...anchor(o.rect, rot, 0, -20, W, 40), rot, length: W })
        } else if (f(o, 14) === 0) add(o, 'platform', { ...anchor(o.rect, 0, 0, 0, W, 14), length: W })
        else if (f(o, 14) === 1 || f(o, 14) === 2) {
          // Inclinado (1: «/», 2: «\»): en el editor, una rampa por la que las piezas bajan hacia su lado de abajo.
          const rot = f(o, 14) === 1 ? 180 : 0
          add(o, 'ramp', { ...anchor(o.rect, rot, 0, -20, W, 40), rot, length: W })
          inclined++
        } else skip('tope')
        break
      case 22: {
        const tank = add(o, 'tank', {
          x: o.rect[0],
          y: o.rect[1],
          high: f(o, 15) ? input(o, f(o, 5), f(o, 7)) : '',
          mid: f(o, 17) ? input(o, f(o, 6), f(o, 8)) : '',
          low: f(o, 9) ? input(o, f(o, 10), f(o, 11)) : '',
          level: f(o, 4) ? variable(o, 'AI', `AIW${f(o, 12)}`, 'analogIn') : '',
          initial: 0,
        })
        tank.rect = o.rect
        break
      }
      case 23:
        tools.push(o) // las válvulas, con su depósito (abajo)
        break
      case 27: {
        const nib = (v, i) => (v >>> (4 * i)) & 15
        const f10 = f(o, 10)
        const f11 = f(o, 11)
        const cabin = nib(f10, 4) === 0 // un solo detector, en la cabina (f10: byte y bit en sus 4 bits 5 y 6)
        add(o, 'elevator', {
          ...at(o),
          floors: 4,
          up: output(o, f(o, 5), f(o, 7)),
          down: output(o, f(o, 6), f(o, 8)),
          open: output(o, f(o, 4), f(o, 14)),
          close: output(o, f(o, 12), f(o, 16)),
          doorOpen: input(o, nib(f10, 0), nib(f10, 1)),
          doorClosed: input(o, nib(f10, 2), nib(f10, 3)),
          ...(cabin
            ? { cabin: input(o, nib(f10, 5), nib(f10, 6)), f1: '', f2: '', f3: '', f4: '' }
            : { f1: input(o, nib(f10, 7), nib(f11, 0)), f2: input(o, nib(f11, 1), nib(f11, 2)), f3: input(o, nib(f11, 3), nib(f11, 4)), f4: input(o, nib(f11, 5), nib(f11, 6)) }),
          floorTime: 4,
          doorTime: 1,
          initial: 0,
        })
        break
      }
      case 19: {
        const g = f(o, 15)
        if (g >= 50 && g <= 61) {
          if (f(o, 14) === 1) add(o, 'sink', anchor(o.rect, 0, -30, 24, 60, 6))
          else if (g === 50 || f(o, 13) === 1) add(o, 'platform', { ...anchor(o.rect, 0, 0, 0, W, 14), length: W })
          else add(o, 'platform', { ...anchor(o.rect, 90, 0, 0, H, 14), rot: 90, length: H })
          break
        }
        if (g === 100 || g === 300) {
          tools.push(o)
          break
        }
        const rot = ROT[f(o, 14)] ?? 0
        const L = rot === 90 || rot === 270 ? H : W
        // El mismo actuador repetido (en el mismo sitio, con lo mismo) solo para llevar otro grupo: uno, con los dos.
        const twin = carriers.find((c) => c.o.rect.join() === o.rect.join() && c.o.fields.join() === o.fields.join() && c.o.type === o.type)
        if (twin) {
          if (o.group?.trim()) twin.groups.add(o.group.trim())
          break
        }
        const main = output(o, f(o, 5), f(o, 7)) // la primera: se queda el rótulo
        // Salida de recoger y captadores (solo en los cilindros y en el actuador de giro: en las herramientas, esos
        // campos son otra cosa).
        const legsOf = () => ({
          retract: f(o, 4) === 1 && f(o, 16) === 11 ? output(o, f(o, 6), f(o, 8)) : '',
          retracted: f(o, 9) ? input(o, f(o, 11), f(o, 13)) : '',
          extended: f(o, 10) ? input(o, f(o, 12), o.a) : '',
        })
        if (g >= 200 && g < 300) {
          const legs = legsOf()
          if (f(o, 14) !== 0) warnings.push('Actuador de giro: solo en su orientación normal; se importa sin girar.')
          const long = g >= 230
          const r = (W / 2) * (parseFloat(o.text2) || 1)
          const e = add(o, 'rotary', { ...at(o), turn: main, back: legs.retract, start: legs.retracted, end: legs.extended, long, arm: Math.round(r), initial: g % 20 === 0 ? 1 : 0, vacuum: '', holding: '', tool: 'vacuum' })
          carriers.push({ o, e, groups: new Set([o.group?.trim()].filter(Boolean)) })
          break
        }
        const odd = g % 10
        const initial = g >= 21 ? 1 : 0
        let stroke
        let lx
        let rodless = false
        if ([1, 3, 5].includes(odd) && g < 30) {
          // Neumático: gráfico 1 sale 11/19 del largo; el 2, b·⌊L/20⌋/45, y el 3, b·⌊⌊0,26·L⌋/5⌋/45 (b hasta 350).
          stroke = odd === 1 ? (L * 11) / 19 : odd === 3 ? (350 * Math.floor(L / 20)) / 45 : (350 * Math.floor(Math.floor((L * 260) / 1000) / 5)) / 45
          lx = odd === 1 ? 88 - L : 88 - L * 0.745
        } else if ([2, 4, 6, 7, 8].includes(odd) && g < 30) {
          // Sin vástago: el carro (de 60 a 88 en el editor) donde el de PC_SIMU.
          rodless = true
          if (odd >= 7) {
            const cw = Math.floor(L / 5)
            stroke = (350 * Math.floor(cw / 10)) / 9
            lx = 74 - 0.045 * L - cw / 2
          } else if (odd >= 4) {
            const cw = Math.floor(L * 0.4)
            stroke = (350 * Math.floor(cw / 18)) / 17
            lx = 74 - 0.09 * L - cw / 2
          } else {
            stroke = L * 0.6
            lx = 74 - 0.2 * L
          }
        } else if (g >= 30 && g <= 35) {
          // Lineal eléctrico: un eje con carro, como el sin vástago (las mismas salidas y captadores; sin su
          // posicionado). El carro empieza a 0,205 del largo y corre b·⌊L/50⌋/10, b hasta 350.
          rodless = true
          stroke = 35 * Math.floor(L / 50)
          lx = 74 - 0.205 * L - 0.05 * L
        } else if (g === 400 || g === 500) {
          // Herramienta (400) o «Salidas» (500): un motor con su dibujo (f14), que arranca con f5.f7 y, biestable
          // (f4 = 1), para con f6.f8.
          add(o, 'motor', {
            ...at(o),
            variable: main,
            stop: f(o, 4) === 1 ? output(o, f(o, 6), f(o, 8)) : '',
            reverse: '',
            pulses: '',
            look: MOTOR_LOOKS[g === 400 ? f(o, 14) + 1 : TOOL_LOOKS + f(o, 14) - 20]?.[0] ?? 'motor',
            size: Math.round(Math.min(W, H)),
            mountedOn: '',
          })
          break
        } else {
          skip(`actuador (gráfico ${g})`)
          break
        }
        const e = add(o, 'cylinder', {
          ...anchor(o.rect, rot, lx, -14, L, 28),
          rot,
          extend: main,
          ...legsOf(),
          position: '',
          vacuum: '',
          holding: '',
          mountedOn: '',
          rodless,
          tool: 'vacuum',
          stroke: Math.max(20, Math.round(stroke)),
          time: 1,
          initial,
        })
        carriers.push({ o, e, groups: new Set([o.group?.trim()].filter(Boolean)) })
        break
      }
      case 24: {
        // Tubería: decorado (por donde pasa el líquido de las válvulas).
        const vertical = H > W
        const length = Math.max(W, H)
        add(o, 'pipe', { ...anchor(o.rect, vertical ? 90 : 0, 0, -6, length, 12), rot: vertical ? 90 : 0, length, variable: '' })
        break
      }
      case 13:
        if (o.text?.trim()) add(o, 'label', { x: o.rect[0], y: o.rect[1] + 12, text: o.text.trim(), size: 14 })
        else skip('texto variable')
        break
      case 1008:
        break
      case 1001: {
        // Línea: f4 1 o 3, de la esquina de arriba a la izquierda a la de abajo a la derecha; 2 o 4, la otra
        // diagonal.
        const flip = f(o, 4) === 2 || f(o, 4) === 4
        add(o, 'shape', { x: o.rect[0], y: flip ? o.rect[3] : o.rect[1], kind: 'line', width: W, height: flip ? -H : H, color: colorOf(f(o, 15)), fill: '' })
        break
      }
      case 1002:
      case 1003:
      case 1004:
      case 1005:
        if (W < 1 && H < 1) break // un punto suelto: nada que dibujar
        add(o, 'shape', {
          x: o.rect[0],
          y: o.rect[1],
          kind: o.type === 1003 || o.type === 1005 ? 'ellipse' : 'rect',
          width: W,
          height: H,
          color: colorOf(f(o, 15)),
          fill: o.type >= 1004 ? colorOf(f(o, 15)) : '',
        })
        break
      case 1006:
        paints.push(o) // el bote de pintura: rellena la figura en la que cae (abajo)
        break
      case 30:
        skip('motor paso a paso')
        break
      case 12:
      case 5: {
        // Display (12) o preselector (5) de f11 cifras: cada una, 4 bits seguidos desde f5.f7 (la primera, la de la
        // izquierda); en el editor, una cifra BCD (salidas) o una rueda BCD (entradas) por cifra.
        const digits = Math.max(1, f(o, 11))
        const base = f(o, 5) * 8 + f(o, 7)
        for (let i = 0; i < digits; i++) {
          const bit = (k) => [Math.floor((base + 4 * i + k) / 8), (base + 4 * i + k) % 8]
          const io = o.type === 12 ? output : input
          const bits = { b1: io(o, ...bit(0)), b2: io(o, ...bit(1)), b4: io(o, ...bit(2)), b8: io(o, ...bit(3)) }
          const e = add(o, o.type === 12 ? 'digit' : 'digitSwitch', { ...bits, ...(o.type === 5 ? { initial: 0 } : {}) })
          e.order += i
        }
        break
      }
      case 14: {
        // Imagen: fija (f15 = 1) o con dos dibujos, apagado (texto2) y encendido (grupo), que cambia con una
        // salida (f4 = 1) o al pulsarla (entrada; NC f13, se queda pulsada f14), desplazada f11, f12 al
        // activarse. f9: 1 o 2, transparente (el color de su esquina).
        const still = f(o, 15) === 1
        const src = bitmap(o.text2)
        const srcOn = still ? '' : bitmap(o.group)
        const io = !still && o.text2?.trim() ? (f(o, 4) === 1 ? { show: output(o, f(o, 5), f(o, 7)) } : { press: input(o, f(o, 5), f(o, 7)), contact: f(o, 13) ? 'NC' : 'NO', latch: f(o, 14) === 1 }) : {}
        add(o, 'image', { x: o.rect[0], y: o.rect[1], width: W, height: H, src, srcOn, dx: still ? 0 : f(o, 11), dy: still ? 0 : f(o, 12), ...io, ...(f(o, 9) ? { transparentKey: true } : {}) })
        break
      }
      default:
        skip(`objeto de tipo ${o.type}`)
    }
  }

  // Montajes: lo que se llama como el grupo de un actuador va con él. Un objeto puede ir en varios grupos (una
  // grúa: la herramienta va con el eje X y con el Y, que a su vez va con el X); en el editor, montado en el más
  // profundo de la cadena (el que va a su vez en otro de ellos).
  const carriersOf = (name, self, types = ['cylinder']) =>
    name ? carriers.filter((c) => c.e !== self && types.includes(c.e.type) && c.groups.has(name)) : []
  const deepest = (list) => {
    let best = null
    for (const c of list) {
      const depth = list.filter((d) => d !== c && d.groups.has(c.o.name?.trim())).length
      if (!best || depth > best.depth) best = { c, depth }
    }
    return best?.c
  }
  // Sin ciclos: no se monta en algo que (en cadena) va montado en él.
  const chainHas = (start, id) => {
    for (let e = start, k = 0; e && k < 10; k++) {
      if (e.id === id) return true
      e = elements.find((x) => x.id === e.mountedOn)
    }
    return false
  }
  for (const e of elements) {
    const o = from.get(e)
    if (!['cylinder', 'motor', 'image'].includes(e.type) || !o?.name?.trim()) continue
    const by = deepest(carriersOf(o.name.trim(), e))
    if (by && !chainHas(by.e, e.id)) e.mountedOn = by.e.id
  }
  for (const o of tools.filter((t) => t.type === 19)) {
    const gripper = f(o, 15) === 300
    // La ventosa o la pinza, en la punta del más profundo de los que la llevan (también un actuador de giro).
    const carrier = deepest(carriersOf(o.name?.trim(), null, ['cylinder', 'rotary']))
    if (!carrier) {
      skip(gripper ? 'pinza suelta' : 'ventosa suelta')
      continue
    }
    carrier.e.vacuum = output(o, f(o, 5), f(o, 7))
    carrier.e.tool = gripper ? 'gripper' : 'vacuum'
    if (gripper && f(o, 10)) carrier.e.holding = input(o, f(o, 12), o.a)
    if (!gripper && f(o, 9)) carrier.e.holding = input(o, f(o, 11), f(o, 13))
  }
  // Válvulas: cada una, con el depósito más cercano que tenga debajo (lo llena) o encima (lo vacía), en su
  // misma franja (a veces con un trozo de tubería entre medias).
  for (const o of tools.filter((t) => t.type === 23)) {
    const [, cy] = center(o.rect)
    let best = null
    for (const e of elements.filter((e) => e.type === 'tank')) {
      if (o.rect[2] < e.rect[0] - 20 || o.rect[0] > e.rect[2] + 20) continue
      const below = cy < e.rect[1] + 10
      const d = below ? e.rect[1] - o.rect[3] : o.rect[1] - e.rect[3]
      if (d > -12 && d < 200 && (!best || d < best.d)) best = { e, d, drain: !below }
    }
    if (!best) {
      skip('válvula sin depósito')
      continue
    }
    const v = output(o, f(o, 5), f(o, 7))
    if (best.drain) best.e.drain = v
    else if (!best.e.fill) best.e.fill = v
    else best.e.fillFine = v
  }
  // Bote de pintura (1006): rellena del color la figura más pequeña que contiene su punto.
  for (const o of paints) {
    const [x, y] = [o.rect[0], o.rect[1]]
    const inside = elements.filter((e) => e.type === 'shape' && e.kind !== 'line' && x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height)
    const target = inside.sort((a, b) => a.width * a.height - b.width * b.height)[0]
    if (target) target.fill = colorOf(f(o, 15))
  }
  for (const e of elements) delete e.rect

  // Los rótulos que no han dado nombre a nada, como rótulos de la planta.
  for (const c of captions.filter((c) => !c.used)) add(c.o, 'label', { x: c.o.rect[0], y: c.o.rect[1] + 12, text: c.o.text.trim(), size: 14 })
  // El pupitre, en el orden del panel (de arriba abajo y de izquierda a derecha).
  const desk = elements.filter((e) => e.place === 'desk').sort((a, b) => a.order - b.order)
  for (const e of desk) {
    delete e.order
    Object.assign(e, { x: 0, y: 0 })
  }
  if (inclined) warnings.push(`${inclined > 1 ? `${inclined} topes inclinados` : 'Un tope inclinado'}: como rampa por la que bajan las piezas (el editor no tiene superficies a 45°).`)
  if (missing.size) warnings.push(`Faltan ${missing.size} imágenes (elígelas junto al .sim, en la misma ventana): ${[...missing].join(', ')}.`)
  const plant = [...elements.filter((e) => e.place !== 'desk'), ...desk]
  return {
    project: { nodes: [], edges: [], plc: { variables, scene: { gravity: true, elements: plant } } },
    warnings,
    // Lo que no tiene equivalente en el editor: [{ what, count }].
    skipped: [...skipped].map(([what, count]) => ({ what, count })),
    count: plant.length,
  }
}

export const isPcSimu = (bytes) => new TextDecoder('latin1').decode(bytes.slice(0, 8)) === 'PC_SIMU*'

// La planta de un .sim en el proyecto abierto (Simular > Autómata S7-200 > Cargar planta .sim): sustituye la
// planta y añade sus variables, sin tocar el grafcet ni el programa cargado. Si una dirección ya tiene variable,
// se queda su nombre (y la planta la usa con él); un nombre ya usado en otra dirección lleva _2, _3…
export function withPcSimuPlant(plc, imported) {
  const variables = { ...(plc.variables ?? {}) }
  const byAddress = new Map(Object.entries(variables).filter(([, v]) => v.address).map(([n, v]) => [String(v.address).toUpperCase(), n]))
  const rename = new Map()
  for (const [name, v] of Object.entries(imported.plc.variables)) {
    const existing = byAddress.get(v.address.toUpperCase())
    if (existing) {
      rename.set(name, existing)
      continue
    }
    let free = name
    for (let k = 2; variables[free]; k++) free = `${name}_${k}`
    variables[free] = v
    rename.set(name, free)
  }
  const elements = imported.plc.scene.elements.map((e) => {
    const keys = (SCENE_VARS[e.type] ?? []).map(([key]) => key)
    return Object.fromEntries(Object.entries(e).map(([k, val]) => [k, keys.includes(k) && rename.has(val) ? rename.get(val) : val]))
  })
  return { ...plc, variables, scene: { ...(plc.scene ?? {}), ...imported.plc.scene, elements } }
}
