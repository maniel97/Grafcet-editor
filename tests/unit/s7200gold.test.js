// Programas «gold» de la CPU S7-200 simulada: los ejemplos del «S7-200 Programmable Controller
// System Manual» (Siemens, 08/2008; página impresa entre paréntesis) con el resultado que da el
// manual en su cronograma o figura, y casos límite y de carrera (orden de ejecución dentro del ciclo).
// Lo que el manual no deja claro está marcado «a confirmar en una CPU real» (docs/s7200-auditoria.md).
import { describe, expect, it } from 'vitest'
import { createCpu, parseProgram } from '../../src/lib/plc/s7200cpu'

const cpuOf = (text) => {
  const { blocks, errors } = parseProgram(text)
  if (errors.length) throw errors[0]
  return createCpu({ blocks })
}
// Ciclos de 10 ms durante `ms`, con las entradas indicadas.
const run = (cpu, ms, inputs = {}) => {
  for (const [a, v] of Object.entries(inputs)) cpu.bits.set(a, v)
  for (let t = 0; t < ms; t += 10) cpu.scan(0.01)
}
const bit = (cpu, a) => cpu.bits.get(a)
const sm = (cpu, b) => cpu.bits.get(`SM1.${b}`)

describe('S7-200 gold: lógica de bits (manual, cap. 6)', () => {
  it('contactos, NOT, EU/ED de un ciclo y S/R (ejemplo «Contact Instructions», p. 68)', () => {
    const cpu = cpuOf(`Network 1
LD I0.0
A I0.1
= Q0.0
NOT
= Q0.1
Network 2
LD I0.2
ON I0.3
= Q0.2
Network 3
LD I0.4
LPS
EU
S Q0.3, 1
= Q0.4
LPP
ED
R Q0.3, 1
= Q0.5`)
    run(cpu, 10)
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1'), bit(cpu, 'Q0.2')]).toEqual([false, true, true]) // I0.3 = 0: ON da 1
    run(cpu, 10, { 'I0.0': true, 'I0.1': true, 'I0.3': true })
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1'), bit(cpu, 'Q0.2')]).toEqual([true, false, false])
    run(cpu, 10, { 'I0.4': true })
    expect([bit(cpu, 'Q0.3'), bit(cpu, 'Q0.4'), bit(cpu, 'Q0.5')]).toEqual([true, true, false]) // flanco: un ciclo
    run(cpu, 10)
    expect([bit(cpu, 'Q0.3'), bit(cpu, 'Q0.4')]).toEqual([true, false])
    run(cpu, 10, { 'I0.4': false })
    expect([bit(cpu, 'Q0.3'), bit(cpu, 'Q0.5')]).toEqual([false, true])
    run(cpu, 10)
    expect(bit(cpu, 'Q0.5')).toBe(false)
  })

  it('en el primer ciclo EU y ED no dan flanco (p. 67, «Tip»)', () => {
    const cpu = cpuOf('LD I0.0\nEU\n= Q0.0\nLD I0.0\nED\n= Q0.1')
    run(cpu, 10, { 'I0.0': true })
    expect(bit(cpu, 'Q0.0')).toBe(false)
    run(cpu, 10, { 'I0.0': false })
    expect(bit(cpu, 'Q0.1')).toBe(true)
  })

  it('S/R de varios bits y la última escritura gana (ejemplo «Coil Instructions», p. 70)', () => {
    const cpu = cpuOf(`Network 1
LD I0.1
S Q0.2, 6
Network 2
LD I0.2
R Q0.2, 6
Network 3
LD I0.3
LPS
A I0.4
S Q1.0, 8
LPP
A I0.5
R Q1.0, 8
Network 4
LD I0.6
= Q1.0`)
    run(cpu, 10, { 'I0.1': true })
    expect(['Q0.2', 'Q0.7', 'Q1.0'].map((a) => bit(cpu, a))).toEqual([true, true, false]) // Q0.2…Q0.7: 6 bits
    run(cpu, 10, { 'I0.2': true })
    expect(bit(cpu, 'Q0.2')).toBe(false) // el R va después del S en el ciclo
    run(cpu, 10, { 'I0.3': true, 'I0.4': true })
    expect(cpu.words.get('QB1')).toBe(0xfe) // Q1.1…Q1.7 a 1; Q1.0 lo pisa la red 4
  })

  it('pila lógica: ALD, OLD, LPS, LRD, LPP (ejemplo «Logic Stack Instructions», p. 72)', () => {
    const cpu = cpuOf(`Network 1
LD I0.0
LD I0.1
LD I2.0
A I2.1
OLD
ALD
= Q5.0
Network 2
LD I0.0
LPS
LD I0.5
O I0.6
ALD
= Q7.0
LRD
LD I2.1
O I1.3
ALD
= Q6.0
LPP
A I1.0
= Q3.0`)
    const names = ['I0.0', 'I0.1', 'I2.0', 'I2.1', 'I0.5', 'I0.6', 'I1.3', 'I1.0']
    for (let k = 0; k < 256; k += 7) {
      const v = Object.fromEntries(names.map((n, i) => [n, Boolean((k >> i) & 1)]))
      run(cpu, 10, v)
      expect(bit(cpu, 'Q5.0')).toBe(v['I0.0'] && (v['I0.1'] || (v['I2.0'] && v['I2.1'])))
      expect(bit(cpu, 'Q7.0')).toBe(v['I0.0'] && (v['I0.5'] || v['I0.6']))
      expect(bit(cpu, 'Q6.0')).toBe(v['I0.0'] && (v['I2.1'] || v['I1.3']))
      expect(bit(cpu, 'Q3.0')).toBe(v['I0.0'] && v['I1.0'])
    }
  })

  it('LDS copia un nivel de la pila; AENO lee el ENO de la última caja (p. 71)', () => {
    const cpu = cpuOf(`LD I0.0
LD I0.1
LDS 1
= Q0.0
LD SM0.0
/I 0, VW0
AENO
= Q0.1
LD SM0.0
MOVW 5, VW2
AENO
= Q0.2`)
    run(cpu, 10, { 'I0.0': true })
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1'), bit(cpu, 'Q0.2')]).toEqual([true, false, true])
  })
})

describe('S7-200 gold: temporizadores (p. 197–201)', () => {
  it('TON T37 (100 ms) +10: bit a 1 s, el valor sigue hasta 32767 y se borra al quitar IN', () => {
    const cpu = cpuOf('LD I0.0\nTON T37, +10\nLD T37\n= Q0.0')
    run(cpu, 1000, { 'I0.0': true }) // ciclos en t = 0 … 0,99 s
    expect(bit(cpu, 'Q0.0')).toBe(false)
    run(cpu, 10) // t = 1 s
    expect(bit(cpu, 'Q0.0')).toBe(true)
    expect(cpu.words.get('T37')).toBe(10)
    run(cpu, 2000)
    expect(cpu.words.get('T37')).toBe(30) // sigue contando pasado el preset
    cpu.words.set('T37', 32760)
    run(cpu, 2000)
    expect(cpu.words.get('T37')).toBe(32767) // y se queda en el máximo
    run(cpu, 10, { 'I0.0': false })
    expect([bit(cpu, 'Q0.0'), cpu.words.get('T37')]).toEqual([false, 0])
  })

  it('TON autorreseteado de 10 ms con M0.0: Q0.0 40 % apagada y 60 % encendida (p. 200)', () => {
    const cpu = cpuOf(`Network 1
LDN M0.0
TON T33, +100
Network 2
LDW>= T33, +40
= Q0.0
Network 3
LD T33
= M0.0`)
    const samples = []
    for (let i = 0; i < 400; i++) {
      cpu.scan(0.01)
      samples.push(bit(cpu, 'Q0.0'))
    }
    const on = samples.slice(100).filter(Boolean).length / 300
    expect(on).toBeGreaterThan(0.55)
    expect(on).toBeLessThan(0.65)
    const rises = samples.filter((v, i) => v && !samples[i - 1]).length
    expect(rises).toBeGreaterThanOrEqual(3) // un periodo por segundo (más los ciclos del reset)
  })

  it('TOF T33 (10 ms) +100: la salida sigue 1 s tras soltar; si vuelve antes, sigue encendida (p. 200)', () => {
    const cpu = cpuOf('LD I0.0\nTOF T33, +100\nLD T33\n= Q0.0')
    run(cpu, 100)
    expect(bit(cpu, 'Q0.0')).toBe(false) // sin la transición de 1 a 0 no arranca
    run(cpu, 100, { 'I0.0': true })
    expect(bit(cpu, 'Q0.0')).toBe(true)
    run(cpu, 990, { 'I0.0': false })
    expect(bit(cpu, 'Q0.0')).toBe(true)
    run(cpu, 20)
    expect([bit(cpu, 'Q0.0'), cpu.words.get('T33')]).toEqual([false, 100]) // el valor se para en el preset
    run(cpu, 100, { 'I0.0': true })
    run(cpu, 800, { 'I0.0': false })
    run(cpu, 100, { 'I0.0': true })
    expect(bit(cpu, 'Q0.0')).toBe(true) // 0,8 s fuera: no llega a apagarse
    expect(cpu.words.get('T33')).toBe(0)
  })

  it('TONR T1 (10 ms) acumula 0,6 s + 0,4 s y solo se borra con R (p. 201)', () => {
    const cpu = cpuOf('LD I0.0\nTONR T1, +100\nLD T1\n= Q0.0\nLD I0.1\nR T1, 1')
    run(cpu, 600, { 'I0.0': true })
    run(cpu, 500, { 'I0.0': false })
    expect(cpu.words.get('T1')).toBe(60)
    run(cpu, 400, { 'I0.0': true })
    run(cpu, 10)
    expect(bit(cpu, 'Q0.0')).toBe(true)
    run(cpu, 10, { 'I0.0': false, 'I0.1': true })
    expect([bit(cpu, 'T1'), cpu.words.get('T1')]).toEqual([false, 0])
  })

  it('el número del temporizador decide tipo y resolución (tabla 6-72)', () => {
    expect(() => run(cpuOf('LD I0.0\nTON T1, +10'), 10)).toThrow('T1 no sirve para TON')
    expect(() => run(cpuOf('LD I0.0\nTONR T37, +10'), 10)).toThrow('T37 no sirve para TONR')
    expect(() => run(cpuOf('LD I0.0\nTON T40, +10\nLD I0.1\nTOF T40, +10'), 10)).toThrow('a la vez TON y TOF')
    const cpu = cpuOf('LD SM0.0\nTON T32, +500\nTON T33, +50\nTON T37, +5\nTONR T0, +500\nTONR T5, +5')
    run(cpu, 510) // el último ciclo, en t = 0,5 s
    expect(['T32', 'T33', 'T37', 'T0', 'T5'].map((t) => cpu.words.get(t))).toEqual([500, 50, 5, 500, 5])
  })

  it('carrera: TON de 10 ms con su propio bit como habilitación; el pulso solo lo ven las redes anteriores (p. 199–200)', () => {
    const cpu = cpuOf(`Network 1
LD T33
= Q0.0
Network 2
LDN T33
TON T33, +10
Network 3
LD T33
= Q0.1
Network 4
LD Q0.0
S M0.0, 1
LD Q0.1
S M0.1, 1`)
    run(cpu, 500)
    expect([bit(cpu, 'M0.0'), bit(cpu, 'M0.1')]).toEqual([true, false])
  })

  it('carrera: con 100 ms el bit cambia al ejecutar TON, y el pulso lo ven las redes posteriores (p. 199)', () => {
    const cpu = cpuOf(`Network 1
LDN T37
TON T37, +2
Network 2
LD T37
S M0.1, 1`)
    run(cpu, 500)
    expect(bit(cpu, 'M0.1')).toBe(true)
  })

  it('10 ms: el valor actual no cambia durante el ciclo (se actualiza al empezar) (p. 199)', () => {
    const cpu = cpuOf(`LD SM0.0
TON T33, +1000
MOVW T33, VW0
MOVW T33, VW2`)
    run(cpu, 100)
    expect(cpu.words.get('VW0')).toBe(cpu.words.get('VW2'))
    expect(cpu.words.get('VW0')).toBe(9) // arranca en el primer ciclo: 9 intervalos completos después
  })

  it('R de un TOF: hace falta otra bajada para que vuelva a contar (p. 198, «Tip»)', () => {
    const cpu = cpuOf('LD I0.0\nTOF T37, +5\nLD I0.1\nR T37, 1\nLD T37\n= Q0.0')
    run(cpu, 100, { 'I0.0': true })
    run(cpu, 10, { 'I0.0': false, 'I0.1': true })
    expect(bit(cpu, 'Q0.0')).toBe(false)
    run(cpu, 1000, { 'I0.1': false })
    expect([bit(cpu, 'Q0.0'), cpu.words.get('T37')]).toEqual([false, 0])
  })
})

describe('S7-200 gold: contadores (p. 107–109)', () => {
  const pulse = (cpu, a, n = 1) => {
    for (let i = 0; i < n; i++) {
      run(cpu, 10, { [a]: true })
      run(cpu, 10, { [a]: false })
    }
  }

  it('CTD C1 +3: carga con LD, cuenta 3-2-1-0 y se queda en 0 con el bit encendido (p. 108)', () => {
    const cpu = cpuOf('LD I0.0\nLD I0.1\nCTD C1, +3\nLD C1\n= Q0.0')
    run(cpu, 10)
    pulse(cpu, 'I0.1')
    expect([cpu.words.get('C1'), bit(cpu, 'Q0.0')]).toEqual([3, false])
    pulse(cpu, 'I0.0', 2)
    expect(cpu.words.get('C1')).toBe(1)
    pulse(cpu, 'I0.0', 3)
    expect([cpu.words.get('C1'), bit(cpu, 'Q0.0')]).toEqual([0, true])
    pulse(cpu, 'I0.1')
    expect([cpu.words.get('C1'), bit(cpu, 'Q0.0')]).toEqual([3, false])
  })

  it('CTUD C48 +4: 0-1-2-3-4-5-4-3-4-5 y reset a 0, con el bit en >= 4 (p. 109)', () => {
    const cpu = cpuOf('LD I0.0\nLD I0.1\nLD I0.2\nCTUD C48, +4\nLD C48\n= Q0.0')
    run(cpu, 10)
    const seen = []
    const step = (a) => {
      pulse(cpu, a)
      seen.push([cpu.words.get('C48'), bit(cpu, 'Q0.0')])
    }
    for (const a of ['I0.0', 'I0.0', 'I0.0', 'I0.0', 'I0.0', 'I0.1', 'I0.1', 'I0.0', 'I0.0', 'I0.2']) step(a)
    expect(seen).toEqual([
      [1, false], [2, false], [3, false], [4, true], [5, true], [4, true], [3, false], [4, true], [5, true], [0, false],
    ])
  })

  it('límites: CTU se para en 32767; CTUD da la vuelta a −32768 y al revés (p. 107)', () => {
    const cpu = cpuOf('LD I0.0\nLD I0.7\nCTU C0, +1\nLD I0.1\nLD I0.2\nLD I0.7\nCTUD C1, +1')
    run(cpu, 10)
    cpu.words.set('C0', 32767)
    cpu.words.set('C1', 32767)
    pulse(cpu, 'I0.0')
    pulse(cpu, 'I0.1')
    expect([cpu.words.get('C0'), cpu.words.get('C1')]).toEqual([32767, -32768])
    pulse(cpu, 'I0.2')
    expect(cpu.words.get('C1')).toBe(32767)
  })

  it('reset con prioridad sobre la cuenta, y R de un contador lo pone a 0 (p. 107–108)', () => {
    const cpu = cpuOf('LD I0.0\nLD I0.1\nCTU C3, +2\nLD I0.2\nR C3, 1')
    run(cpu, 10)
    pulse(cpu, 'I0.0', 2)
    expect(bit(cpu, 'C3')).toBe(true)
    run(cpu, 10, { 'I0.0': true, 'I0.1': true })
    expect([cpu.words.get('C3'), bit(cpu, 'C3')]).toEqual([0, false])
    run(cpu, 10, { 'I0.0': false, 'I0.1': false })
    pulse(cpu, 'I0.0', 3)
    run(cpu, 10, { 'I0.2': true })
    expect([cpu.words.get('C3'), bit(cpu, 'C3')]).toEqual([0, false])
  })
})

describe('S7-200 gold: cálculo, conversión y lógica de palabras', () => {
  it('enteros: +I, *I, /I (ejemplo «Integer Math», p. 142)', () => {
    const cpu = cpuOf('LD I0.0\n+I AC1, AC0\n*I AC1, VW100\n/I VW10, VW200')
    cpu.write('AC1', 'I', 40)
    cpu.write('AC0', 'I', 60)
    cpu.words.set('VW100', 20)
    cpu.words.set('VW200', 4000)
    cpu.words.set('VW10', 40)
    run(cpu, 10, { 'I0.0': true })
    expect([cpu.read('AC0'), cpu.words.get('VW100'), cpu.words.get('VW200')]).toEqual([100, 800, 100])
  })

  it('reales: +R, *R, /R (ejemplo «Real Math», p. 142)', () => {
    const cpu = cpuOf('LD I0.0\n+R AC1, AC0\n*R AC2, VD100\n/R VD10, VD200')
    cpu.write('AC1', 'R', 4000)
    cpu.write('AC0', 'R', 6000)
    cpu.write('AC2', 'R', 400)
    cpu.write('VD100', 'R', 200)
    cpu.write('VD10', 'R', 41)
    cpu.write('VD200', 'R', 4000)
    run(cpu, 10, { 'I0.0': true })
    expect(cpu.read('AC0', 'R')).toBe(10000)
    expect(cpu.read('VD100', 'R')).toBe(80000)
    expect(cpu.read('VD200', 'R')).toBeCloseTo(97.561, 3)
  })

  it('MUL y DIV: producto doble y resto en la palabra alta (p. 143)', () => {
    const cpu = cpuOf('LD I0.0\nMUL AC1, VD100\nDIV VW10, VD200')
    cpu.write('AC1', 'I', 400)
    cpu.words.set('VW102', 200)
    cpu.words.set('VW10', 41)
    cpu.words.set('VW202', 4000)
    run(cpu, 10, { 'I0.0': true })
    expect(cpu.words.get('VD100')).toBe(80000)
    expect([cpu.words.get('VW200'), cpu.words.get('VW202')]).toEqual([23, 97])
  })

  it('desbordamiento y división por cero: SM1.1 / SM1.3, la salida no cambia y la CPU sigue (p. 141)', () => {
    const cpu = cpuOf('LD SM0.0\n+I 1, VW0\nLD SM0.0\n/I VW4, VW2\n= Q0.0')
    cpu.words.set('VW0', 32767)
    cpu.words.set('VW2', 7)
    run(cpu, 10)
    expect([cpu.words.get('VW0'), sm(cpu, 1)]).toEqual([32767, true])
    expect([cpu.words.get('VW2'), sm(cpu, 3), bit(cpu, 'Q0.0')]).toEqual([7, true, true])
    cpu.words.set('VW4', -2)
    run(cpu, 10)
    expect([cpu.words.get('VW2'), sm(cpu, 3), sm(cpu, 2)]).toEqual([-3, false, true]) // trunca hacia 0, negativo
  })

  it('INCW/DECB: con signo la palabra, sin signo el byte; SM1.0 si da cero (p. 145)', () => {
    const cpu = cpuOf('LD SM0.0\nINCW VW0\nDECB VB10')
    cpu.words.set('VW0', -1)
    cpu.words.set('VB10', 1)
    run(cpu, 10)
    expect([cpu.words.get('VW0'), cpu.words.get('VB10'), sm(cpu, 0)]).toEqual([0, 0, true])
    run(cpu, 10)
    expect([cpu.words.get('VW0'), cpu.words.get('VB10'), sm(cpu, 1)]).toEqual([1, 0, true]) // 0 − 1 en byte: desborda
  })

  it('conversión pulgadas -> cm y BCDI (ejemplo «Standard Conversion», p. 95)', () => {
    const cpu = cpuOf('LD I0.0\nITD C10, AC1\nDTR AC1, VD0\nMOVR VD0, VD8\n*R VD4, VD8\nROUND VD8, VD12\nLD I0.3\nBCDI AC0')
    cpu.words.set('C10', 101)
    cpu.write('VD4', 'R', 2.54)
    cpu.write('AC0', 'I', 0x1234)
    run(cpu, 10, { 'I0.0': true, 'I0.3': true })
    expect(cpu.read('VD8', 'R')).toBeCloseTo(256.54, 2)
    expect(cpu.words.get('VD12')).toBe(257)
    expect(cpu.read('AC0')).toBe(1234)
  })

  it('ROUND (0,5 hacia arriba en valor absoluto), TRUNC, DTI con desbordamiento, IBCD y SEG (p. 94–96)', () => {
    const cpu = cpuOf(`LD SM0.0
ROUND VD0, VD10
ROUND VD4, VD14
TRUNC VD4, VD18
DTI VD22, VW30
IBCD VW32
SEG VB40, QB0`)
    cpu.write('VD0', 'R', 2.5)
    cpu.write('VD4', 'R', -2.5)
    cpu.words.set('VD22', 40000)
    cpu.words.set('VW30', 9)
    cpu.words.set('VW32', 1234)
    cpu.words.set('VB40', 5)
    run(cpu, 10)
    expect(['VD10', 'VD14', 'VD18', 'VW30'].map((a) => cpu.words.get(a))).toEqual([3, -3, -2, 9])
    expect(cpu.words.get('VW32')).toBe(0x1234)
    expect(cpu.words.get('QB0')).toBe(0x6d) // el 5 en siete segmentos
  })

  it('INVW, rotación y desplazamiento con SM1.1 = último bit que sale (p. 163 y 181)', () => {
    const cpu = cpuOf('LD I4.0\nINVW AC0\nLD I4.1\nRRW AC1, 2\nSLW VW200, 3')
    cpu.write('AC0', 'I', 0xd795)
    run(cpu, 10, { 'I4.0': true })
    expect(cpu.read('AC0') & 0xffff).toBe(0x286a)
    cpu.write('AC1', 'I', 0x4001)
    cpu.write('VW200', 'I', 0xe2ad)
    run(cpu, 10, { 'I4.0': false, 'I4.1': true })
    expect(cpu.read('AC1') & 0xffff).toBe(0x5000)
    expect(cpu.words.get('VW200') & 0xffff).toBe(0x1568)
    expect(sm(cpu, 1)).toBe(true)
  })

  it('SHRB: registro de 4 bits en V100.0, una vez por flanco (ejemplo «Shift Register Bit», p. 183)', () => {
    const cpu = cpuOf('LD I0.2\nEU\nSHRB I0.3, V100.0, +4')
    cpu.words.set('VB100', 0b0101)
    run(cpu, 10)
    run(cpu, 10, { 'I0.2': true, 'I0.3': true })
    expect([cpu.words.get('VB100'), sm(cpu, 1)]).toEqual([0b1011, false])
    run(cpu, 10, { 'I0.2': false, 'I0.3': false })
    run(cpu, 10, { 'I0.2': true })
    expect([cpu.words.get('VB100'), sm(cpu, 1)]).toEqual([0b0110, true])
  })

  it('ANDW, ORW, XORW con SM1.0 (p. 164)', () => {
    const cpu = cpuOf('LD SM0.0\nANDW 16#00FF, VW0\nORW 16#F000, VW2\nXORW VW4, VW4')
    cpu.words.set('VW0', 0x1234)
    cpu.words.set('VW2', 0x0001)
    cpu.words.set('VW4', 0x5555)
    run(cpu, 10)
    expect([cpu.words.get('VW0'), cpu.words.get('VW2') & 0xffff, cpu.words.get('VW4'), sm(cpu, 0)]).toEqual([0x34, 0xf001, 0, true])
  })
})

describe('S7-200 gold: memoria, programa y SCR', () => {
  it('VB, VW y VD comparten bytes (el alto primero) y QB0 son Q0.0–Q0.7 (cap. 4)', () => {
    const cpu = cpuOf('LD SM0.0\nMOVW 16#1234, VW100\nMOVB 16#FF, QB0\nMOVR 1.0, VD200')
    run(cpu, 10)
    expect([cpu.words.get('VB100'), cpu.words.get('VB101')]).toEqual([0x12, 0x34])
    expect([bit(cpu, 'V101.2'), bit(cpu, 'V101.0')]).toEqual([true, false])
    expect(['Q0.0', 'Q0.7'].map((a) => bit(cpu, a))).toEqual([true, true])
    expect(cpu.words.get('VW200')).toBe(0x3f80) // 1.0 en IEEE 754: 3F80 0000
  })

  it('SM0.1 solo en el primer ciclo, SM0.5 a 0,5 s, SM0.6 alterna cada ciclo (apéndice D)', () => {
    const cpu = cpuOf('LD SM0.1\nS M0.0, 1\nLD SM0.0\nINCW VW0\nLD SM0.1\n= M0.1')
    run(cpu, 30)
    expect([bit(cpu, 'M0.0'), bit(cpu, 'M0.1'), cpu.words.get('VW0')]).toEqual([true, false, 3])
    const clock = []
    for (let i = 0; i < 100; i++) {
      cpu.scan(0.01)
      clock.push(bit(cpu, 'SM0.5'))
    }
    expect(clock.filter(Boolean).length).toBe(50)
    const toggles = []
    for (let i = 0; i < 4; i++) {
      cpu.scan(0.01)
      toggles.push(bit(cpu, 'SM0.6'))
    }
    expect(toggles[0]).not.toBe(toggles[1])
    expect(toggles[1]).not.toBe(toggles[2])
  })

  it('FOR/NEXT anidados: 100 × 2 vueltas (ejemplo «For-Next», p. 171)', () => {
    const cpu = cpuOf(`Network 1
LD I2.0
FOR VW100, +1, +100
Network 2
LD I2.1
FOR VW225, +1, +2
Network 3
LD SM0.0
INCW VW0
Network 4
NEXT
Network 5
NEXT`)
    run(cpu, 10, { 'I2.0': true, 'I2.1': true })
    expect([cpu.words.get('VW0'), cpu.words.get('VW100')]).toEqual([200, 101])
    run(cpu, 10, { 'I2.0': false })
    expect(cpu.words.get('VW0')).toBe(200) // FOR sin corriente: no entra
  })

  it('JMP/LBL salta; END condicional termina el ciclo; STOP para la CPU al acabar el ciclo (p. 169–173)', () => {
    const cpu = cpuOf(`LD I0.0
JMP 4
LD SM0.0
= Q0.0
LBL 4
LD I0.1
END
LD SM0.0
= Q0.1
LD I0.2
STOP
LD SM0.0
= Q0.2`)
    run(cpu, 10)
    expect(['Q0.0', 'Q0.1'].map((a) => bit(cpu, a))).toEqual([true, true])
    cpu.bits.set('Q0.0', false)
    cpu.bits.set('Q0.1', false)
    run(cpu, 10, { 'I0.0': true, 'I0.1': true })
    expect(['Q0.0', 'Q0.1'].map((a) => bit(cpu, a))).toEqual([false, false])
    expect(() => run(cpu, 10, { 'I0.1': false, 'I0.2': true })).toThrow('STOP')
    expect(bit(cpu, 'Q0.2')).toBe(true) // el ciclo se termina antes de pasar a STOP
  })

  it('subrutina: entra con la pila a 1 y la recupera al volver (p. 204)', () => {
    const cpu = cpuOf(`ORGANIZATION_BLOCK MAIN:OB1
BEGIN
LD I0.0
CALL SBR_0
= Q0.1
END_ORGANIZATION_BLOCK
SUBROUTINE_BLOCK SBR_0:SBR0
BEGIN
= Q0.0
END_SUBROUTINE_BLOCK`)
    run(cpu, 10, { 'I0.0': true })
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1')]).toEqual([true, true])
  })

  it('SCR: semáforo del manual; SCRT pasa de S0.1 a S0.2 a los 2 s (ejemplo «Sequence Control Relay», p. 176)', () => {
    const cpu = cpuOf(`Network 1
LD SM0.1
S S0.1, 1
Network 2
LSCR S0.1
Network 3
LD SM0.0
S Q0.4, 1
R Q0.5, 2
TON T37, +20
Network 4
LD T37
SCRT S0.2
Network 5
SCRE
Network 6
LSCR S0.2
Network 7
LD SM0.0
S Q0.2, 1
TON T38, +250
Network 8
LD T38
SCRT S0.3
Network 9
SCRE`)
    cpu.bits.set('Q0.5', true)
    run(cpu, 1990)
    expect(['S0.1', 'S0.2', 'Q0.4', 'Q0.5', 'Q0.2'].map((a) => bit(cpu, a))).toEqual([true, false, true, false, false])
    run(cpu, 20)
    expect(['S0.1', 'S0.2', 'Q0.2'].map((a) => bit(cpu, a))).toEqual([false, true, true])
    run(cpu, 10)
    expect(cpu.words.get('T37')).toBe(0) // TON de un segmento inactivo: se ejecuta sin corriente
  })

  it('SCR: las = de un segmento inactivo se apagan; las S se mantienen (a confirmar en una CPU real)', () => {
    const cpu = cpuOf(`LD SM0.1
S S0.0, 1
LSCR S0.0
LD SM0.0
= Q0.0
S Q0.1, 1
LD I0.0
SCRT S0.1
SCRE
LSCR S0.1
LD SM0.0
= Q0.2
SCRE`)
    run(cpu, 20)
    expect(['Q0.0', 'Q0.1', 'Q0.2'].map((a) => bit(cpu, a))).toEqual([true, true, false])
    run(cpu, 10, { 'I0.0': true }) // S0.1 está más abajo: se activa en este mismo ciclo
    expect(['S0.0', 'S0.1', 'Q0.2'].map((a) => bit(cpu, a))).toEqual([false, true, true])
    run(cpu, 10)
    expect(['Q0.0', 'Q0.1', 'Q0.2'].map((a) => bit(cpu, a))).toEqual([false, true, true])
  })
})

// Programa para comparar con un S7-200 real (docs/s7200/pruebas-cpu-real.awl): lo que da la CPU
// simulada en cada prueba, el mismo valor que pone su comentario.
describe('S7-200: pruebas para una CPU real (docs/s7200/pruebas-cpu-real.awl)', () => {
  it('la CPU simulada da lo que dicen los comentarios', async () => {
    const { readFileSync } = await import('node:fs')
    const text = readFileSync(new URL('../../docs/s7200/pruebas-cpu-real.awl', import.meta.url), 'utf8')
    const cpu = cpuOf(text)
    run(cpu, 20)
    cpu.bits.set('I0.0', true)
    run(cpu, 20)
    const b = (a) => (cpu.bits.get(a) ? 1 : 0)
    expect({
      P1: [b('M10.0'), b('M10.1'), b('M10.2')],
      P2: [cpu.words.get('VW500'), b('M11.0')],
      P3: [cpu.words.get('VB502'), b('M11.1'), b('M11.2')],
      P4: cpu.words.get('C10'),
      P5: [b('M11.3'), b('M11.4')],
      P6: cpu.words.get('VD510'),
      P7: cpu.words.get('VD520'),
      P8: cpu.words.get('T40') === cpu.words.get('T41'),
      P9: cpu.words.get('C20'),
      P10: b('M11.5'),
    }).toEqual({ P1: [0, 1, 1], P2: [32767, 1], P3: [255, 1, 0], P4: 1, P5: [0, 0], P6: -3, P7: 0x12340000, P8: true, P9: 5, P10: 0 })
  })
})
