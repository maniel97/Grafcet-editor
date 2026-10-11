// CPU S7-200 simulada: ejecuta un programa STL (AWL) de STEP 7-Micro/WIN ciclo a ciclo, para mover
// la planta virtual con el programa del alumno en lugar de con el grafcet del editor.
//
// Comportamiento según el «S7-200 Programmable Controller System Manual» (Siemens, 08/2008); la
// auditoría instrucción por instrucción y lo que no se puede imitar está en docs/s7200-auditoria.md.
//
//   Bits:       LD LDN A AN O ON NOT EU ED ALD OLD LPS LRD LPP LDS AENO, = S R (también T y C),
//               variantes inmediatas (LDI, =I, SI…) iguales que las normales
//   Comparar:   LDB AB OB (sin signo), LDW AW OW, LDD AD OD, LDR AR OR  con = <> < > <= >=
//   Tiempos:    TON TONR TOF; la resolución la da el número (1, 10 o 100 ms, tabla 6-72)
//   Contadores: CTU CTD CTUD
//   Mover:      MOVB MOVW MOVD MOVR BMB BMW BMD SWAP FILL
//   Cálculo:    +I −I *I /I +D −D *D /D +R −R *R /R MUL DIV INCB/W/D DECB/W/D SQRT LN EXP SIN COS TAN
//   Lógica:     INVB/W/D ANDB/W/D ORB/W/D XORB/W/D, SLB SRB SLW SRW SLD SRD RLB RRB RLW RRW RLD RRD SHRB
//   Convertir:  BTI ITB ITD DTI DTR ROUND TRUNC BCDI IBCD SEG
//   Programa:   CALL (sin parámetros) RET CRET END MEND STOP WDR NOP JMP LBL FOR NEXT
//               LSCR SCRT SCRE CSCRE; bloques OB1, SBR e INT (las interrupciones no se ejecutan)
//   Memoria:    I Q M V SM S por bytes (VB100 y VW100 comparten bytes, el byte alto primero), AIW AQW,
//               AC0–AC3 (32 bits), T y C (bit con instrucciones de bit, valor actual con las de palabra)
//   Marcas:     SM0.0–SM0.7, SM1.0–SM1.3 y SM1.6 (cero, desbordamiento, negativo, /0, BCD), SMW22–26
// Operandos: direcciones o símbolos de la tabla de variables (con o sin comillas); constantes
// decimales, reales, 16#FF y 2#1010. Lo que no entiende se dice con su línea.

export class PlcError extends Error {
  constructor(message, line) {
    super(line ? `Línea ${line}: ${message}` : message)
    this.line = line
  }
}

// Resolución de cada temporizador (s), por su número (tabla 6-72): T0–T31 y T64–T95 son TONR;
// T32–T63 y T96–T255, TON/TOF.
export function timerBase(number) {
  if (number === 0 || number === 64 || number === 32 || number === 96) return 0.001
  if ((number >= 1 && number <= 4) || (number >= 65 && number <= 68) || (number >= 33 && number <= 36) || (number >= 97 && number <= 100)) return 0.01
  return 0.1
}
export const isRetentiveTimer = (number) => number < 32 || (number >= 64 && number < 96)

const BIT = /^(SM|I|Q|M|V|S)(\d+)\.([0-7])$/
const MEM = /^(SM|I|Q|M|V|S)(B|W|D)(\d+)$/
const ANALOG = /^(AI|AQ)W(\d+)$/
const AC = /^AC([0-3])$/
const TC = /^(T|C)(\d+)$/
const INT = /^[+-]?\d+$/
const HEX = /^16#([0-9A-F]+)$/i
const BIN = /^2#([01]+)$/
const REAL = /^[+-]?(\d+\.\d*|\.\d+|\d+)(E[+-]?\d+)?$/i
const SBR = /^SBR_?(\d+)$/i

// Tamaño de cada zona en bytes (CPU 226: la mayor).
const SIZES = { I: 16, Q: 16, M: 32, V: 10240, SM: 550, S: 32, AI: 64, AQ: 64 }
const SIZE = { B: 1, W: 2, D: 4 }
const isOperand = (up, raw) => BIT.test(up) || MEM.test(up) || ANALOG.test(up) || AC.test(up) || TC.test(up) || INT.test(raw) || HEX.test(up) || BIN.test(up) || REAL.test(raw) || SBR.test(up)

// Instrucciones que entiende (para avisar al leer el programa, con su línea).
const ALIASES = { LDI: 'LD', LDNI: 'LDN', AI: 'A', ANI: 'AN', OI: 'O', ONI: 'ON', '=I': '=', SI: 'S', RI: 'R', CEND: 'END' }
const KNOWN = new Set(
  `NETWORK LD LDN A AN O ON NOT EU ED ALD OLD LPS LRD LPP LDS AENO = S R TON TONR TOF CTU CTD CTUD
   MOVB MOVW MOVD MOVR BMB BMW BMD SWAP FILL +I -I *I /I +D -D *D /D +R -R *R /R MUL DIV INCB INCW INCD DECB DECW DECD
   SQRT LN EXP SIN COS TAN INVB INVW INVD ANDB ANDW ANDD ORB ORW ORD XORB XORW XORD SLB SRB SLW SRW SLD SRD
   RLB RRB RLW RRW RLD RRD SHRB BTI ITB ITD DTI DTR ROUND TRUNC BCDI IBCD SEG CALL RET CRET END MEND STOP WDR NOP
   JMP LBL FOR NEXT LSCR SCRT SCRE CSCRE`.split(/\s+/),
)
const COMPARE = /^(LD|A|O)(B|W|D|R)(=|==|<>|>=|<=|>|<)$/
const opName = (raw) => ALIASES[raw] ?? raw

// Programa -> { blocks: { OB1: [ins], SBR0: [...] }, errors } con ins = { op, args, line }.
export function parseProgram(text, resolve = (s) => s) {
  const blocks = {}
  let current = null
  const errors = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const code = raw.replace(/\/\/.*$/, '').trim()
    if (!code) return
    let m
    if ((m = /^(ORGANIZATION_BLOCK|SUBROUTINE_BLOCK|INTERRUPT_BLOCK)\s+([^\s:]+)(?::\s*(\S+))?/i.exec(code))) {
      const kind = m[1].toUpperCase()
      const name = (m[3] ?? m[2]).toUpperCase().replace(/^SBR_?/, 'SBR').replace(/^INT_?/, 'INT').replace(/^MAIN$/, 'OB1')
      current = kind === 'ORGANIZATION_BLOCK' ? 'OB1' : name
      blocks[current] = []
      return
    }
    if (/^(END_\w+|BEGIN|TITLE\s*=|VAR\b|END_VAR|\(\*)/i.test(code) || /^Network\b/i.test(code)) {
      if (/^Network\b/i.test(code) && current) blocks[current].push({ op: 'NETWORK', args: [], line })
      return
    }
    if (!current) {
      // Sin cabecera de bloque (un fragmento pegado): todo al programa principal.
      current = 'OB1'
      blocks.OB1 = blocks.OB1 ?? []
    }
    const sp = code.search(/\s/)
    const op = (sp < 0 ? code : code.slice(0, sp)).toUpperCase()
    const rest = sp < 0 ? '' : code.slice(sp + 1).trim()
    const args = rest
      ? rest
          .split(',')
          .map((a) => a.trim().replace(/^"(.*)"$/, '$1'))
          .filter(Boolean)
          .map((a) => {
            const up = a.toUpperCase().replace(/^%/, '')
            if (isOperand(up, a)) return up
            const r = resolve(a)
            if (!r) errors.push(new PlcError(`«${a}» no es una dirección ni un símbolo de la tabla de variables.`, line))
            return r ? r.toUpperCase() : up
          })
      : []
    const name = opName(op)
    if (!KNOWN.has(name) && !COMPARE.test(name)) errors.push(new PlcError(`la instrucción «${op}» no está en la CPU simulada.`, line))
    blocks[current].push({ op, args, line })
  })
  if (!blocks.OB1) errors.push(new PlcError('No hay programa principal (OB1).'))
  return { blocks, errors }
}

const SEGMENTS = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x67, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71]
const RANGE = { B: [0, 255], I: [-32768, 32767], D: [-2147483648, 2147483647] }
const WIDTH = { B: 8, W: 16, D: 32 }
const MAX_LOOP = 100000

// CPU sobre un programa ya interpretado. scan(dt) ejecuta un ciclo completo (dt en segundos).
export function createCpu(program) {
  const mem = Object.fromEntries(Object.entries(SIZES).map(([area, n]) => [area, new DataView(new ArrayBuffer(n))]))
  const acc = new DataView(new ArrayBuffer(16))
  const timers = new Map() // T37 -> { cv, q, kind, res (µs), pt, running, last, rem, prevIn }
  const counters = new Map() // C0 -> { cv, q, prevUp, prevDown }
  const edges = new Map()
  const decoded = new Map()
  let first = true
  let now = 0 // µs desde el arranque
  let scanCount = 0
  let eno = false
  let stopAt = null

  // ---- Operandos ----
  const decode = (text, line) => {
    let o = decoded.get(text)
    if (o) return o
    let m
    if ((m = BIT.exec(text))) o = { k: 'bit', area: m[1], byte: Number(m[2]), bit: Number(m[3]) }
    else if ((m = MEM.exec(text))) o = { k: 'mem', area: m[1], size: SIZE[m[2]], off: Number(m[3]) }
    else if ((m = ANALOG.exec(text))) o = { k: 'mem', area: m[1], size: 2, off: Number(m[2]) }
    else if ((m = AC.exec(text))) o = { k: 'ac', n: Number(m[1]) }
    else if ((m = TC.exec(text))) o = { k: m[1], n: Number(m[2]), id: text }
    else if ((m = HEX.exec(text))) o = { k: 'const', v: parseInt(m[1], 16) }
    else if ((m = BIN.exec(text))) o = { k: 'const', v: parseInt(m[1], 2) }
    else if (INT.test(text) || REAL.test(text)) o = { k: 'const', v: Number(text) }
    else throw new PlcError(`«${text}» no es un operando válido.`, line)
    if (o.area && (o.byte ?? o.off) + (o.size ?? 1) > SIZES[o.area]) throw new PlcError(`«${text}» está fuera de la memoria de la CPU.`, line)
    if (o.k === 'T' && o.n > 255) throw new PlcError(`«${text}»: los temporizadores van de T0 a T255.`, line)
    if (o.k === 'C' && o.n > 255) throw new PlcError(`«${text}»: los contadores van de C0 a C255.`, line)
    decoded.set(text, o)
    return o
  }
  const timer = (id) => {
    let t = timers.get(id)
    if (!t) {
      const n = Number(id.slice(1))
      t = { cv: 0, q: false, kind: null, res: Math.round(timerBase(n) * 1e6), pt: 0, running: false, last: 0, rem: 0, prevIn: false }
      timers.set(id, t)
    }
    return t
  }
  const counter = (id) => {
    let c = counters.get(id)
    if (!c) counters.set(id, (c = { cv: 0, q: false, prevUp: false, prevDown: false }))
    return c
  }

  const getBit = (a, line) => {
    const o = decode(a, line)
    if (o.k === 'bit') return ((mem[o.area].getUint8(o.byte) >> o.bit) & 1) === 1
    if (o.k === 'T') return timers.get(o.id)?.q ?? false
    if (o.k === 'C') return counters.get(o.id)?.q ?? false
    throw new PlcError(`«${a}» no es un bit.`, line)
  }
  const setBit = (a, v, line) => {
    const o = decode(a, line)
    if (o.k === 'bit') {
      const byte = mem[o.area].getUint8(o.byte)
      mem[o.area].setUint8(o.byte, v ? byte | (1 << o.bit) : byte & ~(1 << o.bit))
    } else if (o.k === 'T') timer(o.id).q = Boolean(v)
    else if (o.k === 'C') counter(o.id).q = Boolean(v)
    else throw new PlcError(`«${a}» no es un bit.`, line)
  }
  // Valor con tipo: B byte sin signo, I entero, W palabra (16 bits), D doble entero, R real.
  const read = (a, type, line) => {
    const o = decode(a, line)
    switch (o.k) {
      case 'const':
        return type === 'R' ? Math.fround(o.v) : type === 'B' ? o.v & 0xff : type === 'D' ? o.v | 0 : (o.v << 16) >> 16
      case 'ac':
        return type === 'R' ? acc.getFloat32(o.n * 4) : type === 'B' ? acc.getUint8(o.n * 4 + 3) : type === 'D' ? acc.getInt32(o.n * 4) : acc.getInt16(o.n * 4 + 2)
      case 'T':
        return timers.get(o.id)?.cv ?? 0
      case 'C':
        return counters.get(o.id)?.cv ?? 0
      case 'mem': {
        const v = mem[o.area]
        if (o.size === 1) return v.getUint8(o.off)
        if (o.size === 2) return v.getInt16(o.off)
        return type === 'R' ? v.getFloat32(o.off) : v.getInt32(o.off)
      }
      default:
        throw new PlcError(`«${a}» no es un byte, palabra ni doble palabra.`, line)
    }
  }
  const write = (a, type, value, line) => {
    const o = decode(a, line)
    switch (o.k) {
      case 'ac':
        // Como byte o palabra se usan los bits bajos del acumulador; el resto no cambia.
        if (type === 'R') acc.setFloat32(o.n * 4, value)
        else if (type === 'B') acc.setUint8(o.n * 4 + 3, value & 0xff)
        else if (type === 'D') acc.setInt32(o.n * 4, value | 0)
        else acc.setInt16(o.n * 4 + 2, value)
        return
      case 'T':
        timer(o.id).cv = (value << 16) >> 16
        return
      case 'C':
        counter(o.id).cv = (value << 16) >> 16
        return
      case 'mem': {
        const v = mem[o.area]
        if (o.size === 1) v.setUint8(o.off, value & 0xff)
        else if (o.size === 2) v.setInt16(o.off, value)
        else if (type === 'R') v.setFloat32(o.off, value)
        else v.setInt32(o.off, value | 0)
        return
      }
      default:
        throw new PlcError(`no se puede escribir en «${a}».`, line)
    }
  }

  // ---- Marcas especiales ----
  const setSM = (byte, bit, v) => {
    const b = mem.SM.getUint8(byte)
    mem.SM.setUint8(byte, v ? b | (1 << bit) : b & ~(1 << bit))
  }
  const flags = (value, type) => {
    setSM(1, 0, value === 0)
    setSM(1, 1, false)
    if (type !== 'B') setSM(1, 2, value < 0)
  }
  const overflow = () => {
    setSM(1, 1, true)
    eno = false
  }

  // ---- Temporizadores ----
  // Suma los intervalos completos transcurridos desde la última actualización.
  const accumulate = (t) => {
    if (!t.running) return
    const elapsed = now - t.last + t.rem
    const n = Math.floor(elapsed / t.res)
    t.rem = elapsed - n * t.res
    t.last = now
    t.cv = Math.min(t.kind === 'TOF' ? t.pt : 32767, t.cv + n)
  }
  const settle = (t) => {
    if (t.kind === 'TOF') {
      if (t.running && t.cv >= t.pt) {
        t.cv = t.pt
        t.q = false
        t.running = false
      }
    } else t.q = t.cv >= t.pt
  }
  const resetTimer = (t) => Object.assign(t, { cv: 0, q: false, running: false, rem: 0, prevIn: false })
  const start = (t) => Object.assign(t, { running: true, last: now, rem: 0 })

  // ---- Ejecución de un bloque ----
  const run = (name, depth = 0) => {
    const code = program.blocks[name]
    if (!code) throw new PlcError(`No existe la subrutina ${name}.`)
    if (depth > 8) throw new PlcError('Demasiadas subrutinas anidadas (máximo 8).')
    const labels = new Map()
    const loops = []
    let stack = depth ? [true] : []
    let scr = null // { bit, active } dentro de un segmento SCR
    let loopCount = 0
    let pc = 0
    let line = 0
    const rail = () => !scr || scr.active
    const top = () => {
      if (!stack.length) throw new PlcError('la pila lógica está vacía (falta un LD).', line)
      return stack[stack.length - 1]
    }
    // En un segmento SCR inactivo no hay flujo de corriente: toda la lógica da 0.
    const setTop = (v) => (stack[stack.length - 1] = v && rail())
    const push = (v) => {
      stack.push(v && rail())
      if (stack.length > 9) stack.shift() // la pila tiene 9 niveles: se pierde el de abajo
    }
    // Instrucción de caja: solo se ejecuta con flujo de corriente; ENO dice si fue bien.
    const enabled = () => {
      eno = top()
      return eno
    }
    const find = (from, open, close) => {
      let level = 0
      for (let i = from + 1; i < code.length; i++) {
        const op = opName(code[i].op)
        if (op === open) level++
        else if (op === close && level-- === 0) return i
      }
      throw new PlcError(`falta ${close}.`, line)
    }
    code.forEach((ins, i) => opName(ins.op) === 'LBL' && labels.set(Number(ins.args[0]), i))

    const arith = (type, args, f) => {
      if (!enabled()) return
      const b = read(args[0], type, line)
      const a = read(args[1], type, line)
      const r = f(a, b)
      if (r === null) return
      if (type === 'R' ? !Number.isFinite(Math.fround(r)) : r < RANGE[type][0] || r > RANGE[type][1]) return overflow()
      const v = type === 'R' ? Math.fround(r) : r
      write(args[1], type, v, line)
      flags(v, type)
    }
    const divide = (type, args) =>
      arith(type, args, (a, b) => {
        if (b === 0) {
          setSM(1, 3, true)
          eno = false
          return null
        }
        setSM(1, 3, false)
        return type === 'R' ? a / b : Math.trunc(a / b)
      })
    const logic = (type, args, f) => {
      if (!enabled()) return
      const mask = type === 'D' ? 0xffffffff : type === 'W' ? 0xffff : 0xff
      const t = type === 'W' ? 'I' : type
      const v = f(read(args[args.length - 1], t, line) & mask, args.length > 1 ? read(args[0], t, line) & mask : 0) & mask
      write(args[args.length - 1], t, v, line)
      setSM(1, 0, v === 0)
    }
    const shift = (type, args, dir, rotate) => {
      if (!enabled()) return
      const w = WIDTH[type]
      const t = type === 'W' ? 'I' : type
      let n = read(args[1], 'B', line)
      let v = BigInt.asUintN(w, BigInt(read(args[0], t, line)))
      const top1 = 1n << BigInt(w - 1)
      if (rotate) n %= w
      else n = Math.min(n, w)
      let out = false
      for (let k = 0; k < n; k++) {
        if (dir === 'L') {
          out = (v & top1) !== 0n
          v = BigInt.asUintN(w, v << 1n) | (rotate && out ? 1n : 0n)
        } else {
          out = (v & 1n) !== 0n
          v = (v >> 1n) | (rotate && out ? top1 : 0n)
        }
      }
      const value = Number(BigInt.asIntN(w, v))
      write(args[0], t, type === 'B' ? value & 0xff : value, line)
      setSM(1, 0, v === 0n)
      setSM(1, 1, n > 0 && out)
    }

    while (pc < code.length) {
      const { op: raw, args, line: l } = code[pc]
      line = l
      const op = opName(raw)
      let next = pc + 1
      let m
      switch (op) {
        case 'NETWORK':
          stack = scr ? [scr.active] : []
          break
        case 'LD':
          push(getBit(args[0], line) && rail())
          break
        case 'LDN':
          push(!getBit(args[0], line) && rail())
          break
        case 'A':
          setTop(top() && getBit(args[0], line))
          break
        case 'AN':
          setTop(top() && !getBit(args[0], line))
          break
        case 'O':
          setTop(top() || getBit(args[0], line))
          break
        case 'ON':
          setTop(top() || !getBit(args[0], line))
          break
        case 'ALD':
        case 'OLD': {
          const a = top()
          stack.pop()
          if (!stack.length) throw new PlcError(`${op} necesita dos niveles en la pila lógica.`, line)
          setTop(op === 'ALD' ? top() && a : top() || a)
          break
        }
        case 'NOT':
          setTop(!top())
          break
        case 'LPS':
          push(top())
          break
        case 'LRD':
          if (stack.length < 2) throw new PlcError('LRD sin LPS.', line)
          setTop(stack[stack.length - 2])
          break
        case 'LPP':
          if (stack.length < 2) throw new PlcError('LPP sin LPS.', line)
          stack.pop()
          break
        case 'LDS': {
          const n = Number(args[0])
          if (!(n >= 0 && n < stack.length)) throw new PlcError(`LDS ${args[0]}: la pila no tiene ese nivel.`, line)
          push(stack[stack.length - 1 - n])
          break
        }
        case 'AENO':
          setTop(top() && eno)
          break
        case 'EU':
        case 'ED': {
          // En el primer ciclo no hay flanco: solo se guarda el estado (manual, «Contacts»).
          const now1 = top()
          const key = `${name}:${pc}`
          const before = edges.get(key) ?? false
          edges.set(key, now1)
          setTop(!first && (op === 'EU' ? now1 && !before : !now1 && before))
          break
        }
        case '=':
          for (const a of args) setBit(a, top(), line)
          break
        case 'S':
        case 'R': {
          if (!top()) break
          const n = args[1] === undefined ? 1 : read(args[1], 'B', line)
          const o = decode(args[0], line)
          if (o.k === 'T' || o.k === 'C') {
            // Reset de un temporizador o contador: bit a 0 y valor actual a 0 (S solo pone el bit).
            for (let k = 0; k < n; k++) {
              const id = `${o.k}${o.n + k}`
              const item = o.k === 'T' ? timer(id) : counter(id)
              if (op === 'S') item.q = true
              else if (o.k === 'T') resetTimer(item)
              else Object.assign(item, { cv: 0, q: false })
            }
          } else if (o.k === 'bit') {
            let index = o.byte * 8 + o.bit
            for (let k = 0; k < n; k++, index++) setBit(`${o.area}${Math.floor(index / 8)}.${index % 8}`, op === 'S', line)
          } else throw new PlcError(`«${args[0]}» no es un bit.`, line)
          break
        }
        case 'TON':
        case 'TONR':
        case 'TOF': {
          const id = args[0]
          const number = Number(id.slice(1))
          if (!/^T\d+$/.test(id)) throw new PlcError(`${op} necesita un temporizador (T…), no «${id}».`, line)
          if ((op === 'TONR') !== isRetentiveTimer(number))
            throw new PlcError(`${id} no sirve para ${op}: TONR usa T0–T31 y T64–T95; TON y TOF, T32–T63 y T96–T255.`, line)
          const t = timer(id)
          if (t.kind && t.kind !== op && (t.kind === 'TOF') !== (op === 'TOF')) throw new PlcError(`${id} no puede ser a la vez TON y TOF.`, line)
          t.kind = op
          t.pt = read(args[1], 'I', line)
          const input = top()
          const slow = t.res === 100000 // los de 100 ms se actualizan al ejecutarse; el resto, al empezar el ciclo
          if (op === 'TOF') {
            if (scr && !scr.active) resetTimer(t) // TOF en un segmento SCR inactivo (manual, TOF)
            else if (input) Object.assign(t, { cv: 0, q: true, running: false })
            else if (t.prevIn) start(t)
            t.prevIn = input && rail()
            if (slow) {
              accumulate(t)
              settle(t)
            }
          } else if (input) {
            if (!t.running) start(t)
            if (slow) {
              accumulate(t)
              settle(t)
            }
          } else if (op === 'TON') resetTimer(t)
          else {
            if (slow) {
              accumulate(t)
              settle(t)
            }
            t.running = false
          }
          break
        }
        case 'CTU':
        case 'CTD':
        case 'CTUD': {
          // Pila: arriba el reset (o la carga en CTD), debajo CU o CD; en CTUD, CU en el tercer nivel.
          const id = args[0]
          if (!/^C\d+$/.test(id)) throw new PlcError(`${op} necesita un contador (C…), no «${id}».`, line)
          const pv = read(args[1], 'I', line)
          const c = counter(id)
          const need = op === 'CTUD' ? 3 : 2
          if (stack.length < need) throw new PlcError(`${op} necesita ${need} niveles en la pila lógica (un LD por entrada).`, line)
          const reset = stack[stack.length - 1]
          const second = stack[stack.length - 2]
          const up = op === 'CTD' ? false : op === 'CTUD' ? stack[stack.length - 3] : second
          const down = op === 'CTU' ? false : second
          if (op === 'CTD') {
            if (reset) Object.assign(c, { cv: pv })
            else if (down && !c.prevDown && c.cv > 0) c.cv--
            c.q = c.cv === 0
          } else {
            if (reset) c.cv = 0
            else {
              if (up && !c.prevUp) c.cv = op === 'CTUD' && c.cv === 32767 ? -32768 : Math.min(32767, c.cv + 1)
              if (down && !c.prevDown) c.cv = c.cv === -32768 ? 32767 : c.cv - 1
            }
            c.q = c.cv >= pv
          }
          c.prevUp = up
          c.prevDown = down
          break
        }
        case 'MOVB':
        case 'MOVW':
        case 'MOVD':
        case 'MOVR': {
          const t = { MOVB: 'B', MOVW: 'I', MOVD: 'D', MOVR: 'R' }[op]
          if (enabled()) write(args[1], t, read(args[0], t, line), line)
          break
        }
        case 'BMB':
        case 'BMW':
        case 'BMD': {
          if (!enabled()) break
          const t = { BMB: 'B', BMW: 'I', BMD: 'D' }[op]
          const n = read(args[2], 'B', line)
          const from = decode(args[0], line)
          const to = decode(args[1], line)
          if (from.k !== 'mem' || to.k !== 'mem') throw new PlcError(`${op} copia bloques de memoria (VB, VW, VD…).`, line)
          const values = Array.from({ length: n }, (_, k) => read(`${from.area}${'BWD'[Math.log2(from.size)]}${from.off + k * from.size}`, t, line))
          values.forEach((v, k) => write(`${to.area}${'BWD'[Math.log2(to.size)]}${to.off + k * to.size}`, t, v, line))
          break
        }
        case 'SWAP':
          if (enabled()) {
            const v = read(args[0], 'I', line) & 0xffff
            write(args[0], 'I', ((v & 0xff) << 8) | (v >> 8), line)
          }
          break
        case 'FILL': {
          if (!enabled()) break
          const v = read(args[0], 'I', line)
          const to = decode(args[1], line)
          const n = read(args[2], 'B', line)
          for (let k = 0; k < n; k++) write(`${to.area}W${to.off + 2 * k}`, 'I', v, line)
          break
        }
        case '+I':
        case '-I':
        case '*I':
        case '+D':
        case '-D':
        case '*D':
        case '+R':
        case '-R':
        case '*R': {
          const t = op[1]
          const f = op[0] === '+' ? (a, b) => a + b : op[0] === '*' ? (a, b) => a * b : (a, b) => a - b
          arith(t, args, t === 'R' ? (a, b) => Math.fround(f(a, b)) : f)
          break
        }
        case '/I':
        case '/D':
        case '/R':
          divide(op[1], args)
          break
        case 'MUL':
          if (enabled()) {
            const v = read(args[0], 'I', line) * read(args[1], 'I', line)
            write(args[1], 'D', v, line)
            flags(v, 'D')
          }
          break
        case 'DIV':
          if (enabled()) {
            const b = read(args[0], 'I', line)
            const a = read(args[1], 'I', line)
            if (b === 0) {
              setSM(1, 3, true)
              eno = false
              break
            }
            setSM(1, 3, false)
            const q = Math.trunc(a / b)
            if (q > 32767) {
              overflow()
              break
            }
            const r = a - q * b
            write(args[1], 'D', ((r & 0xffff) << 16) | (q & 0xffff), line)
            flags(q, 'I')
          }
          break
        case 'INCB':
        case 'INCW':
        case 'INCD':
        case 'DECB':
        case 'DECW':
        case 'DECD': {
          const t = { B: 'B', W: 'I', D: 'D' }[op[3]]
          const d = op.startsWith('INC') ? 1 : -1
          arith(t, [args[0], args[0]], (a) => a + d)
          break
        }
        case 'SQRT':
        case 'LN':
        case 'EXP':
        case 'SIN':
        case 'COS':
        case 'TAN':
          if (enabled()) {
            const r = Math.fround(Math[{ SQRT: 'sqrt', LN: 'log', EXP: 'exp', SIN: 'sin', COS: 'cos', TAN: 'tan' }[op]](read(args[0], 'R', line)))
            if (!Number.isFinite(r)) overflow()
            else {
              write(args[1], 'R', r, line)
              flags(r, 'R')
            }
          }
          break
        case 'INVB':
        case 'INVW':
        case 'INVD':
          logic(op[3], args, (v) => ~v)
          break
        case 'ANDB':
        case 'ANDW':
        case 'ANDD':
        case 'ORB':
        case 'ORW':
        case 'ORD':
        case 'XORB':
        case 'XORW':
        case 'XORD': {
          const f = op.startsWith('AND') ? (a, b) => a & b : op.startsWith('OR') ? (a, b) => a | b : (a, b) => a ^ b
          logic(op[op.length - 1], args, f)
          break
        }
        case 'SLB':
        case 'SRB':
        case 'SLW':
        case 'SRW':
        case 'SLD':
        case 'SRD':
          shift(op[2], args, op[1], false)
          break
        case 'RLB':
        case 'RRB':
        case 'RLW':
        case 'RRW':
        case 'RLD':
        case 'RRD':
          shift(op[2], args, op[1], true)
          break
        case 'SHRB': {
          if (!enabled()) break
          const data = getBit(args[0], line)
          const s = decode(args[1], line)
          const n = read(args[2], 'D', line)
          if (s.k !== 'bit' || n === 0 || Math.abs(n) > 64) throw new PlcError('SHRB necesita un bit de inicio y una longitud de 1 a 64 (negativa = hacia abajo).', line)
          const bits = Array.from({ length: Math.abs(n) }, (_, k) => {
            const index = s.byte * 8 + s.bit + k
            return `${s.area}${Math.floor(index / 8)}.${index % 8}`
          })
          if (n < 0) bits.reverse()
          const values = bits.map((b) => getBit(b, line))
          setSM(1, 1, values[values.length - 1])
          bits.forEach((b, k) => setBit(b, k === 0 ? data : values[k - 1], line))
          break
        }
        case 'BTI':
        case 'ITB':
        case 'ITD':
        case 'DTI':
        case 'DTR':
        case 'ROUND':
        case 'TRUNC': {
          if (!enabled()) break
          const [from, to] = { BTI: ['B', 'I'], ITB: ['I', 'B'], ITD: ['I', 'D'], DTI: ['D', 'I'], DTR: ['D', 'R'], ROUND: ['R', 'D'], TRUNC: ['R', 'D'] }[op]
          const x = read(args[0], from, line)
          // ROUND: con fracción de 0,5 o más se redondea hacia arriba (en valor absoluto).
          const v = op === 'ROUND' ? Math.sign(x) * Math.round(Math.abs(x)) : op === 'TRUNC' ? Math.trunc(x) : op === 'DTR' ? Math.fround(x) : x
          if (to !== 'R' && !(Number.isFinite(v) && v >= RANGE[to][0] && v <= RANGE[to][1])) {
            overflow()
            break
          }
          write(args[1], to, v, line)
          if (op === 'ITB') setSM(1, 1, false)
          break
        }
        case 'BCDI':
        case 'IBCD': {
          if (!enabled()) break
          const v = read(args[0], 'I', line) & 0xffff
          let r
          if (op === 'BCDI') {
            const digits = [12, 8, 4, 0].map((s) => (v >> s) & 0xf)
            r = digits.some((d) => d > 9) ? null : digits.reduce((acc1, d) => acc1 * 10 + d, 0)
          } else r = v > 9999 ? null : [...String(v).padStart(4, '0')].reduce((acc1, d) => (acc1 << 4) | Number(d), 0)
          setSM(1, 6, r === null)
          if (r === null) eno = false
          else write(args[0], 'I', r, line)
          break
        }
        case 'SEG':
          if (enabled()) write(args[1], 'B', SEGMENTS[read(args[0], 'B', line) & 0xf], line)
          break
        case 'CALL': {
          if (!top()) break
          if (args.length > 1) throw new PlcError('las subrutinas con parámetros (tabla de variables locales) no están en la CPU simulada.', line)
          const saved = stack
          run(args[0].replace(/^SBR_?/, 'SBR'), depth + 1)
          stack = saved
          break
        }
        case 'RET':
        case 'MEND':
          return
        case 'CRET':
          if (top()) return
          break
        case 'END':
          // END es condicional; escrito solo (sin LD antes) termina el ciclo.
          if (!stack.length || top()) return
          break
        case 'STOP':
          if (top() && stopAt === null) stopAt = line
          break
        case 'WDR':
        case 'NOP':
        case 'LBL':
          break
        case 'JMP':
          if (top()) {
            if (!labels.has(Number(args[0]))) throw new PlcError(`no hay LBL ${args[0]} en este bloque.`, line)
            next = labels.get(Number(args[0]))
          }
          break
        case 'FOR': {
          const end = find(pc, 'FOR', 'NEXT')
          if (!top()) {
            next = end + 1
            break
          }
          write(args[0], 'I', read(args[1], 'I', line), line)
          if (read(args[0], 'I', line) > read(args[2], 'I', line)) next = end + 1
          else loops.push({ start: pc, index: args[0], final: args[2] })
          break
        }
        case 'NEXT': {
          const loop = loops[loops.length - 1]
          if (!loop) throw new PlcError('NEXT sin FOR.', line)
          if (++loopCount > MAX_LOOP) throw new PlcError('el bucle FOR no termina (el ciclo superaría el tiempo de vigilancia).', line)
          const i = read(loop.index, 'I', line) + 1
          write(loop.index, 'I', i, line)
          if (i <= read(loop.final, 'I', line)) next = loop.start + 1
          else loops.pop()
          break
        }
        case 'LSCR': {
          const active = getBit(args[0], line)
          scr = { bit: args[0], active }
          stack = [active]
          break
        }
        case 'SCRT':
          if (!scr) throw new PlcError('SCRT fuera de un segmento SCR (falta LSCR).', line)
          if (top()) {
            setBit(scr.bit, false, line)
            setBit(args[0], true, line)
          }
          break
        case 'CSCRE':
          if (!scr) throw new PlcError('CSCRE fuera de un segmento SCR.', line)
          if (top()) next = find(pc, 'LSCR', 'SCRE')
          break
        case 'SCRE':
          if (!scr) throw new PlcError('SCRE sin LSCR.', line)
          scr = null
          stack = []
          break
        default:
          if ((m = COMPARE.exec(op))) {
            const t = m[2] === 'W' ? 'I' : m[2]
            const a = read(args[0], t, line)
            const b = read(args[1], t, line)
            if (t === 'R' && (Number.isNaN(a) || Number.isNaN(b))) throw new PlcError('comparación con un real no válido (NaN): la CPU pasaría a STOP.', line)
            const v = { '=': a === b, '==': a === b, '<>': a !== b, '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b }[m[3]]
            if (m[1] === 'LD') push(v && rail())
            else setTop(m[1] === 'A' ? top() && v : top() || v)
          } else throw new PlcError(`la instrucción «${raw}» no está en la CPU simulada.`, line)
      }
      pc = next
    }
  }

  // Accesos por dirección (bits y palabras) para el editor y las pruebas.
  const bits = {
    get: (a) => getBit(a),
    set: (a, v) => setBit(a, v),
  }
  const words = {
    get: (a) => read(a, decode(a).size === 4 ? 'D' : decode(a).size === 1 ? 'B' : 'I'),
    set: (a, v) => write(a, decode(a).size === 4 ? 'D' : decode(a).size === 1 ? 'B' : 'I', v),
  }

  return {
    bits,
    words,
    timers,
    counters,
    read: (a, type = 'I') => read(a, type),
    write: (a, type, v) => write(a, type, v),
    get stopped() {
      return stopAt !== null
    },
    scan(dt) {
      if (stopAt !== null) throw new PlcError('la CPU está en STOP (instrucción STOP).', stopAt)
      // El ciclo se ejecuta en el instante `now` (el primero en t = 0) y dura dt.
      const us = Math.round(dt * 1e6)
      // SMB0, al empezar el ciclo (el manual las actualiza al final del anterior).
      setSM(0, 0, true)
      setSM(0, 1, first)
      setSM(0, 2, first)
      setSM(0, 3, first)
      setSM(0, 4, now % 60e6 < 30e6)
      setSM(0, 5, now % 1e6 < 5e5)
      setSM(0, 6, scanCount % 2 === 0)
      setSM(0, 7, true)
      mem.SM.setInt16(22, Math.min(32767, Math.round(us / 1000)))
      // Temporizadores de 1 y 10 ms: al principio del ciclo (los de 1 ms, aproximados así).
      for (const t of timers.values())
        if (t.res < 100000 && t.running) {
          accumulate(t)
          settle(t)
        }
      run('OB1')
      first = false
      scanCount++
      now += us
      if (stopAt !== null) throw new PlcError('la CPU ha pasado a STOP (instrucción STOP).', stopAt)
    },
    reset() {
      for (const v of Object.values(mem)) new Uint8Array(v.buffer).fill(0)
      new Uint8Array(acc.buffer).fill(0)
      timers.clear()
      counters.clear()
      edges.clear()
      first = true
      now = 0
      scanCount = 0
      stopAt = null
    },
  }
}
