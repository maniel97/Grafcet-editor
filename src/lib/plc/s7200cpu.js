// CPU S7-200 simulada: ejecuta un programa STL (AWL) de STEP 7-Micro/WIN ciclo a ciclo, para mover
// la planta virtual con el programa del alumno en lugar de con el grafcet del editor.
//
// Lo que entiende (lo habitual en las prácticas):
//   Bits:      LD LDN A AN O ON ALD OLD NOT EU ED LPS LRD LPP  (y las variantes inmediatas LDI, =I…)
//   Salidas:   =  S  R  (S/R con número de bits: «S Q0.0, 2»)
//   Tiempos:   TON TOF TONR (base según el número: T0/T64 1 ms, T1–T4… 10 ms, el resto 100 ms)
//   Contadores: CTU CTD CTUD (C0…)
//   Palabras:  LDW= AW<> OW>=… (comparaciones), MOVW MOVB, +I −I *I /I, INCW DECW
//   REAL:      LDR= AR<> OR>=…, MOVR MOVD, ITD DTI DTR ROUND TRUNC, +R −R *R /R (en VD, MD, AC0–AC3)
//   Programa:  CALL SBRn, RET, CRET, END, MEND; bloques OB1, SBR e INT (las interrupciones no se usan)
//   Marcas especiales: SM0.0 (siempre 1), SM0.1 (primer ciclo), SM0.4 (reloj de 1 min), SM0.5 (de 1 s)
// Operandos: direcciones (I0.0, Q0.1, M0.0, V10.3, VW100, VD200, AIW0, AQW0, T37, C0) o símbolos de la tabla
// de variables del editor (con o sin comillas). Lo que no entiende se dice con su línea.

import { timerBase } from '../ladder/exportS7200'

export class PlcError extends Error {
  constructor(message, line) {
    super(line ? `Línea ${line}: ${message}` : message)
    this.line = line
  }
}

const BIT = /^(I|Q|M|V|SM)(\d+)\.([0-7])$/
const WORD = /^(VW|MW|IW|QW|AIW|AQW|SMW)(\d+)$/
const BYTE = /^(VB|MB|IB|QB|SMB)(\d+)$/
const TC = /^(T|C)(\d+)$/
const NUM = /^[+-]?\d+$/
// Dobles palabras (doble entero o REAL; sin solaparse con las palabras de la misma zona).
const DWORD = /^(VD|MD|SMD)(\d+)$|^AC[0-3]$/
const REAL = /^[+-]?(\d+\.\d*|\.\d+)(E[+-]?\d+)?$/i

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
            if (BIT.test(up) || WORD.test(up) || BYTE.test(up) || DWORD.test(up) || TC.test(up) || NUM.test(a) || REAL.test(a) || /^SBR_?\d+$/.test(up)) return up
            const r = resolve(a)
            if (!r) errors.push(new PlcError(`«${a}» no es una dirección ni un símbolo de la tabla de variables.`, line))
            return r ? r.toUpperCase() : up
          })
      : []
    blocks[current].push({ op, args, line })
  })
  if (!blocks.OB1) errors.push(new PlcError('No hay programa principal (OB1).'))
  return { blocks, errors }
}

// CPU sobre un programa ya interpretado. Memoria: bits por dirección, palabras, temporizadores y
// contadores. scan(dt) ejecuta un ciclo completo (dt en segundos).
export function createCpu(program) {
  const bits = new Map()
  const words = new Map()
  const timers = new Map() // T37 -> { acc (s), q }
  const counters = new Map() // C0 -> { cv, q, prevUp, prevDown }
  const edges = new Map()
  let first = true
  let time = 0

  const getBit = (a, line) => {
    if (a === 'SM0.0') return true
    if (a === 'SM0.1') return first
    if (a === 'SM0.4') return time % 60 < 30
    if (a === 'SM0.5') return time % 1 < 0.5
    if (/^T\d+$/.test(a)) return Boolean(timers.get(a)?.q)
    if (/^C\d+$/.test(a)) return Boolean(counters.get(a)?.q)
    if (!BIT.test(a)) throw new PlcError(`«${a}» no es un bit.`, line)
    return Boolean(bits.get(a))
  }
  const getWord = (a, line) => {
    if (NUM.test(a) || REAL.test(a)) return Number(a)
    if (/^T\d+$/.test(a)) {
      const t = timers.get(a)
      return t ? Math.floor(t.acc / timerBase(Number(a.slice(1))) + 1e-9) : 0
    }
    if (/^C\d+$/.test(a)) return counters.get(a)?.cv ?? 0
    if (!WORD.test(a) && !BYTE.test(a) && !DWORD.test(a)) throw new PlcError(`«${a}» no es una palabra.`, line)
    return words.get(a) ?? 0
  }
  // Escribir en C0 o T37 (MOVW, +I…) cambia su valor actual, como en el S7-200 (su bit, al
  // ejecutarse la caja); no es una palabra aparte.
  const setWord = (a, value) => {
    if (/^C\d+$/.test(a)) counters.set(a, { cv: 0, q: false, prevUp: false, prevDown: false, ...counters.get(a), cv: value })
    else if (/^T\d+$/.test(a)) timers.set(a, { acc: 0, q: false, ...timers.get(a), acc: value * timerBase(Number(a.slice(1))) })
    else words.set(a, value)
  }
  const setBits = (a, value, n = 1, line) => {
    const m = BIT.exec(a)
    if (!m) throw new PlcError(`«${a}» no es un bit.`, line)
    let index = Number(m[2]) * 8 + Number(m[3])
    for (let k = 0; k < n; k++, index++) bits.set(`${m[1]}${Math.floor(index / 8)}.${index % 8}`, value)
  }
  const cmp = (op, a, b) => ({ '=': a === b, '==': a === b, '<>': a !== b, '>': a > b, '<': a < b, '>=': a >= b, '<=': a <= b })[op]
  const clamp16 = (v) => Math.max(-32768, Math.min(32767, Math.trunc(v)))

  const run = (name, dt, depth = 0) => {
    const code = program.blocks[name]
    if (!code) throw new PlcError(`No existe la subrutina ${name}.`)
    if (depth > 8) throw new PlcError('Demasiadas subrutinas anidadas.')
    let stack = []
    const top = () => {
      if (!stack.length) throw new PlcError('la pila lógica está vacía (falta un LD).', current)
      return stack[stack.length - 1]
    }
    const setTop = (v) => (stack[stack.length - 1] = v)
    let current = 0
    for (const [pc, { op: raw, args, line }] of code.entries()) {
      current = line
      const op = raw.replace(/I$/, (s) => (['LDI', 'LDNI', 'AI', 'ANI', 'OI', 'ONI', '=I', 'SI', 'RI'].includes(raw) ? '' : s))
      let m
      switch (op) {
        case 'NETWORK':
          stack = []
          break
        case 'LD':
          stack.push(getBit(args[0], line))
          break
        case 'LDN':
          stack.push(!getBit(args[0], line))
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
          const a = stack.pop()
          if (!stack.length) throw new PlcError(`${op} necesita dos niveles en la pila lógica.`, line)
          setTop(op === 'ALD' ? top() && a : top() || a)
          break
        }
        case 'NOT':
          setTop(!top())
          break
        case 'LPS':
          stack.push(top())
          break
        case 'LRD':
          if (stack.length < 2) throw new PlcError('LRD sin LPS.', line)
          setTop(stack[stack.length - 2])
          break
        case 'LPP':
          if (stack.length < 2) throw new PlcError('LPP sin LPS.', line)
          stack.pop()
          break
        case 'EU':
        case 'ED': {
          const now = top()
          const before = edges.get(`${name}:${pc}`) ?? false
          edges.set(`${name}:${pc}`, now)
          setTop(op === 'EU' ? now && !before : !now && before)
          break
        }
        case '=':
          for (const a of args) setBits(a, top(), 1, line)
          break
        case 'S':
        case 'R':
          if (top()) setBits(args[0], op === 'S', Number(args[1] ?? 1), line)
          break
        case 'TON':
        case 'TONR':
        case 'TOF': {
          const id = args[0]
          const pt = getWord(args[1], line) * timerBase(Number(id.slice(1)))
          const t = timers.get(id) ?? { acc: 0, q: false }
          const input = top()
          if (op === 'TOF') {
            if (input) {
              t.acc = 0
              t.q = true
            } else if (t.q) {
              t.acc += dt
              if (t.acc >= pt - 1e-9) t.q = false
            }
          } else {
            if (input) t.acc += dt
            else if (op === 'TON') t.acc = 0
            t.q = t.acc >= pt - 1e-9
          }
          timers.set(id, t)
          break
        }
        case 'CTU':
        case 'CTD':
        case 'CTUD': {
          // Pila: CTU -> [CU, R]; CTD -> [CD, LD]; CTUD -> [CU, CD, R] (el último arriba).
          const id = args[0]
          const pv = getWord(args[1], line)
          const c = counters.get(id) ?? { cv: 0, q: false, prevUp: false, prevDown: false }
          const reset = stack.pop()
          const down = op === 'CTUD' ? stack.pop() : op === 'CTD' ? stack.pop() : false
          const up = op === 'CTD' ? false : stack.pop()
          if (op === 'CTD') {
            if (reset) c.cv = pv
            else if (down && !c.prevDown && c.cv > 0) c.cv--
            c.q = c.cv === 0
          } else {
            if (reset) c.cv = 0
            else {
              if (up && !c.prevUp && c.cv < 32767) c.cv++
              if (down && !c.prevDown && c.cv > -32768) c.cv--
            }
            c.q = c.cv >= pv
          }
          c.prevUp = up
          c.prevDown = down
          counters.set(id, c)
          stack.push(reset) // lo que queda en la pila tras la caja
          break
        }
        case 'MOVW':
        case 'MOVB':
          if (top()) setWord(args[1], getWord(args[0], line))
          break
        case '+I':
        case '-I':
        case '*I':
        case '/I':
          if (top()) {
            const a = getWord(args[1], line)
            const b = getWord(args[0], line)
            if (op === '/I' && b === 0) throw new PlcError('división por cero.', line)
            setWord(args[1], clamp16(op === '+I' ? a + b : op === '-I' ? a - b : op === '*I' ? a * b : a / b))
          }
          break
        case 'MOVR':
        case 'MOVD':
          if (top()) setWord(args[1], getWord(args[0], line))
          break
        case 'ITD':
        case 'DTR':
          if (top()) setWord(args[1], getWord(args[0], line))
          break
        case 'DTI': {
          // Fuera del rango de un entero (desbordamiento), la salida no cambia.
          const v = getWord(args[0], line)
          if (top() && v >= -32768 && v <= 32767) setWord(args[1], Math.trunc(v))
          break
        }
        case 'ROUND':
        case 'TRUNC':
          if (top()) {
            const v = getWord(args[0], line)
            setWord(args[1], op === 'TRUNC' ? Math.trunc(v) : Math.sign(v) * Math.round(Math.abs(v)))
          }
          break
        case '+R':
        case '-R':
        case '*R':
        case '/R':
          if (top()) {
            const a = getWord(args[1], line)
            const b = getWord(args[0], line)
            if (op === '/R' && b === 0) throw new PlcError('división por cero.', line)
            setWord(args[1], Math.fround(op === '+R' ? a + b : op === '-R' ? a - b : op === '*R' ? a * b : a / b))
          }
          break
        case 'INCW':
        case 'DECW':
          if (top()) setWord(args[0], clamp16(getWord(args[0], line) + (op === 'INCW' ? 1 : -1)))
          break
        case 'CALL':
          if (top()) run(args[0].replace(/^SBR_?/, 'SBR'), dt, depth + 1)
          break
        case 'RET':
        case 'END':
        case 'MEND':
          return
        case 'CRET':
        case 'CEND':
          if (top()) return
          break
        default:
          if ((m = /^(LD|A|O)(W|B|D|R)(=|==|<>|>=|<=|>|<)$/.exec(op))) {
            const v = cmp(m[3], getWord(args[0], line), getWord(args[1], line))
            if (m[1] === 'LD') stack.push(v)
            else setTop(m[1] === 'A' ? top() && v : top() || v)
          } else throw new PlcError(`la instrucción «${raw}» no está en la CPU simulada.`, line)
      }
    }
  }

  return {
    bits,
    words,
    timers,
    counters,
    scan(dt) {
      time += dt
      run('OB1', dt)
      first = false
    },
    reset() {
      bits.clear()
      words.clear()
      timers.clear()
      counters.clear()
      edges.clear()
      first = true
      time = 0
    },
  }
}
