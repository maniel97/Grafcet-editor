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

describe('S7-200 gold: segunda pasada (2026-10): instrucciones que faltaban por probar', () => {
  it('SR/RS (Set/Reset Dominant, p. 77): manda S1 en SR y R1 en RS; con las dos a 0 el bit se queda', () => {
    const cpu = cpuOf(`LD I0.0
LD I0.1
SR Q0.0
LD I0.2
LD I0.3
RS Q0.1`)
    cpu.bits.set('Q0.1', true)
    run(cpu, 10) // todo a 0: se quedan como estaban
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1')]).toEqual([false, true])
    run(cpu, 10, { 'I0.0': true, 'I0.1': true }) // SR con las dos: manda el set
    expect(bit(cpu, 'Q0.0')).toBe(true)
    run(cpu, 10, { 'I0.0': false, 'I0.1': true })
    expect(bit(cpu, 'Q0.0')).toBe(false)
    run(cpu, 10, { 'I0.2': true, 'I0.3': true }) // RS con las dos: manda el reset
    expect(bit(cpu, 'Q0.1')).toBe(false)
    run(cpu, 10, { 'I0.2': false, 'I0.3': false })
    expect(bit(cpu, 'Q0.1')).toBe(false)
    run(cpu, 10, { 'I0.2': true })
    expect(bit(cpu, 'Q0.1')).toBe(true)
  })

  it('RET cuenta como CRET: el retorno de subrutina es condicional (apéndice G, solo CRET)', () => {
    const cpu = cpuOf(`ORGANIZATION_BLOCK MAIN:OB1
BEGIN
LD I0.0
CALL SBR_0
= Q0.1
END_ORGANIZATION_BLOCK
SUBROUTINE_BLOCK SBR_0:SBR0
BEGIN
LD I0.1
RET
LD SM0.0
= Q0.0
END_SUBROUTINE_BLOCK`)
    run(cpu, 10, { 'I0.0': true, 'I0.1': true })
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1')]).toEqual([false, true]) // RET con flujo: vuelve antes
    cpu.bits.set('Q0.1', false)
    run(cpu, 10, { 'I0.0': true, 'I0.1': false })
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1')]).toEqual([true, true]) // sin flujo: la bobina se ejecuta
  })

  it('END y MEND solo en el programa principal (p. 167, 204)', () => {
    const sbr = `ORGANIZATION_BLOCK MAIN:OB1
BEGIN
LD I0.0
END_ORGANIZATION_BLOCK
SUBROUTINE_BLOCK SBR_0:SBR0
BEGIN
%INS%
END_SUBROUTINE_BLOCK`
    for (const ins of ['END', 'MEND']) {
      const { errors } = parseProgram(sbr.replace('%INS%', ins))
      expect(errors.map((e) => e.message).join(' ')).toContain(`«${ins}» solo puede ir en el programa principal (OB1), no en SBR0.`)
    }
  })

  it('las constantes fuera de rango dan error con su línea, como al compilar en Micro/WIN', () => {
    expect(() => run(cpuOf('LD SM0.0\nMOVB 300, VB0'), 10)).toThrow('no cabe en 8 bits')
    expect(() => run(cpuOf('LD SM0.0\nMOVB -1, VB0'), 10)).toThrow('no cabe en 8 bits')
    expect(() => run(cpuOf('LD SM0.0\nMOVW 40000, VW0'), 10)).toThrow('no cabe en 16 bits')
    expect(() => run(cpuOf('LD SM0.0\nMOVW 16#10000, VW0'), 10)).toThrow('no cabe en 16 bits')
    expect(() => run(cpuOf('LD SM0.0\nMOVW 1.5, VW0'), 10)).toThrow('constante real')
    // En hexadecimal o binario se admite el ancho completo: 16#FFFF es una palabra válida.
    const cpu = cpuOf('LD SM0.0\nMOVW 16#FFFF, VW0\nMOVD 16#FFFFFFFF, VD4\nMOVB 16#FF, VB10\nMOVW 2#1111111111111111, VW2')
    run(cpu, 10)
    expect([cpu.words.get('VW0'), cpu.words.get('VD4'), cpu.words.get('VB10'), cpu.words.get('VW2')]).toEqual([-1, -1, 255, -1])
  })

  it('S/R de 1 a 255 puntos (p. 74): fuera de eso da error', () => {
    expect(() => run(cpuOf('LD SM0.0\nS Q0.0, 0'), 10)).toThrow('va de 1 a 255')
    expect(() => run(cpuOf('LD SM0.0\nS Q0.0, 256'), 10)).toThrow('no cabe en 8 bits')
  })

  it('LSCR y SCRT solo con bits S (tabla 6-68) y los segmentos no se anidan', () => {
    expect(() => run(cpuOf('LD SM0.1\nLSCR M0.0\nSCRE'), 10)).toThrow('solo admite bits S')
    expect(() => run(cpuOf('LD SM0.1\nLSCR S0.0\nLD SM0.0\nSCRT M0.1\nSCRE'), 10)).toThrow('solo admite bits S')
    expect(() => run(cpuOf('LD SM0.1\nLSCR S0.0\nLSCR S0.1\nSCRE\nSCRE'), 10)).toThrow('no se anidan')
  })

  it('LBL repetido: error al cargar el programa', () => {
    const { errors } = parseProgram('LD I0.0\nJMP 4\nLBL 4\nLBL 4')
    expect(errors.map((e) => e.message).join(' ')).toContain('LBL 4 repetido en OB1.')
  })

  it('comentarios (* *) de varias líneas', () => {
    const { blocks, errors } = parseProgram(`(* esto es
un comentario
de varias líneas *)
LD I0.0
= Q0.0`)
    expect(errors).toEqual([])
    expect(blocks.OB1.map((i) => i.op)).toEqual(['LD', '='])
  })

  it('doble entero: +D, -D, *D, /D con truncamiento, desbordamiento y división por cero (p. 141)', () => {
    const cpu = cpuOf('LD SM0.0\n+D VD4, VD0\n-D VD8, VD0\n*D VD12, VD0\n/D VD16, VD0')
    cpu.words.set('VD0', 100)
    cpu.words.set('VD4', 50)
    cpu.words.set('VD8', 30)
    cpu.words.set('VD12', 2)
    cpu.words.set('VD16', 7)
    run(cpu, 10)
    expect(cpu.words.get('VD0')).toBe(34) // 100+50=150, −30=120, ×2=240, /7=34
    const cpu2 = cpuOf('LD SM0.0\n+D VD4, VD0') // el desbordamiento, solo con la +D
    cpu2.words.set('VD0', 1)
    cpu2.words.set('VD4', 2147483647)
    run(cpu2, 10)
    expect([cpu2.words.get('VD0'), sm(cpu2, 1)]).toEqual([1, true]) // +D desborda: no cambia
    cpu.words.set('VD4', 0)
    cpu.words.set('VD8', 0)
    cpu.words.set('VD12', 1)
    cpu.words.set('VD16', 0)
    run(cpu, 10)
    expect([cpu.words.get('VD0'), sm(cpu, 3)]).toEqual([34, true]) // /D entre 0: no cambia
  })

  it('funciones numéricas SQRT, LN, EXP, SIN, COS, TAN (p. 143)', () => {
    const cpu = cpuOf(`LD SM0.0
SQRT VD0, VD4
LN VD0, VD8
EXP VD12, VD16
SIN VD20, VD24
COS VD20, VD28
TAN VD20, VD32
SQRT VD36, VD40`)
    cpu.write('VD0', 'R', 4)
    cpu.write('VD12', 'R', 0)
    cpu.write('VD20', 'R', 0)
    cpu.write('VD36', 'R', -4)
    run(cpu, 10)
    expect(cpu.read('VD4', 'R')).toBe(2)
    expect(cpu.read('VD8', 'R')).toBeCloseTo(1.386294, 5)
    expect(cpu.read('VD16', 'R')).toBe(1)
    expect([cpu.read('VD24', 'R'), cpu.read('VD28', 'R'), cpu.read('VD32', 'R')]).toEqual([0, 1, 0])
    expect(sm(cpu, 1)).toBe(true) // SQRT de −4: desbordamiento
  })

  it('lógica de byte y doble: INV, AND, OR, XOR con SM1.0 (p. 161–163)', () => {
    const cpu = cpuOf(`LD SM0.0
INVB VB0
INVD VD4
ANDB 16#0F, VB10
ORB 16#F0, VB12
XORB 16#FF, VB14
ANDD 16#FFFF0000, VD20
ORD 16#0000FFFF, VD24
XORD 16#FFFFFFFF, VD28
XORW VW50, VW50`)
    cpu.words.set('VB0', 0x0f)
    cpu.words.set('VD4', 0)
    cpu.words.set('VB10', 0x3c)
    cpu.words.set('VB12', 0x01)
    cpu.words.set('VB14', 0x55)
    cpu.words.set('VD20', 0x12345678)
    cpu.words.set('VD24', 0x11110000)
    cpu.words.set('VD28', 0)
    run(cpu, 10)
    expect(cpu.words.get('VB0')).toBe(0xf0)
    expect(cpu.words.get('VD4')).toBe(-1)
    expect([cpu.words.get('VB10'), cpu.words.get('VB12'), cpu.words.get('VB14')]).toEqual([0x0c, 0xf1, 0xaa])
    expect([cpu.words.get('VD20'), cpu.words.get('VD24'), cpu.words.get('VD28')]).toEqual([0x12340000, 0x1111ffff, -1])
    expect(sm(cpu, 0)).toBe(true) // XORW de una palabra consigo misma: cero
  })

  it('desplazamientos y rotaciones: SM1.1 con el último bit que sale (p. 179–180)', () => {
    const cpu = cpuOf(`LD SM0.0
SLB VB0, 2
SRB VB2, 1
RLB VB4, 1
RRB VB6, 1
SLW VW10, 1
SRW VW12, 1
RLW VW14, 1
RRW VW16, 1
SLD VD20, 1
SRD VD24, 1
RLD VD28, 1
RRD VD32, 1`)
    cpu.words.set('VB0', 0xc1)
    cpu.words.set('VB2', 0x81)
    cpu.words.set('VB4', 0x81)
    cpu.words.set('VB6', 0x81)
    cpu.words.set('VW10', 0x4001)
    cpu.words.set('VW12', 0x8001)
    cpu.words.set('VW14', 0x8001)
    cpu.words.set('VW16', 0x8001)
    cpu.words.set('VD20', 0x80000001)
    cpu.words.set('VD24', 0x80000001)
    cpu.words.set('VD28', 0x80000001)
    cpu.words.set('VD32', 0x80000001)
    run(cpu, 10)
    expect([cpu.words.get('VB0'), cpu.words.get('VB2'), cpu.words.get('VB4'), cpu.words.get('VB6')]).toEqual([0x04, 0x40, 0x03, 0xc0])
    expect([cpu.words.get('VW10') & 0xffff, cpu.words.get('VW12') & 0xffff, cpu.words.get('VW14') & 0xffff, cpu.words.get('VW16') & 0xffff]).toEqual([0x8002, 0x4000, 0x0003, 0xc000])
    expect([cpu.words.get('VD20'), cpu.words.get('VD24'), cpu.words.get('VD28'), cpu.words.get('VD32')]).toEqual([2, 0x40000000, 3, -1073741824])
    expect(sm(cpu, 1)).toBe(true) // el último en salir (RRD de 16#80000001) es un 1
  })

  it('FILL, BMB, BMW, BMD y SWAP (p. 146–147 y 183)', () => {
    const cpu = cpuOf(`LD SM0.0
FILL +10, VW100, 3
BMB VB0, VB10, 3
BMW VW30, VW44, 2
BMD VD60, VD70, 1
SWAP VW50`)
    cpu.words.set('VB0', 1)
    cpu.words.set('VB1', 2)
    cpu.words.set('VB2', 3)
    cpu.words.set('VW30', 0x1111)
    cpu.words.set('VW32', 0x2222)
    cpu.words.set('VD60', 0x12345678)
    cpu.words.set('VW50', 0x1234)
    run(cpu, 10)
    expect([cpu.words.get('VW100'), cpu.words.get('VW102'), cpu.words.get('VW104')]).toEqual([10, 10, 10])
    expect([cpu.words.get('VB10'), cpu.words.get('VB11'), cpu.words.get('VB12')]).toEqual([1, 2, 3])
    expect([cpu.words.get('VW44'), cpu.words.get('VW46')]).toEqual([0x1111, 0x2222])
    expect(cpu.words.get('VD70')).toBe(0x12345678)
    expect(cpu.words.get('VW50')).toBe(0x3412)
  })

  it('BTI sin signo, ITD con signo e ITB que desborda sin tocar la salida; ROUND aclara SM1.1 (p. 99–100)', () => {
    const cpu = cpuOf('LD SM0.0\nBTI VB0, VW0\nITD VW2, VD10\nITB VW4, VB20')
    cpu.words.set('VB0', 0xff)
    cpu.words.set('VW2', -5)
    cpu.words.set('VW4', 300)
    cpu.words.set('VB20', 7)
    run(cpu, 10)
    expect(cpu.words.get('VW0')).toBe(255)
    expect(cpu.words.get('VD10')).toBe(-5)
    expect([cpu.words.get('VB20'), sm(cpu, 1)]).toEqual([7, true]) // ITB: desborda y no toca
    const cpu2 = cpuOf('LD SM0.0\nROUND VD30, VD34')
    cpu2.write('VD30', 'R', 2.5)
    run(cpu2, 10)
    expect([cpu2.words.get('VD34'), sm(cpu2, 1)]).toEqual([3, false]) // con éxito, SM1.1 queda a 0
  })

  it('comparaciones: byte sin signo, doble entero y real, en LD/A/O (p. 96–97)', () => {
    const cpu = cpuOf(`LD I0.0
LDB= VB20, 16#FF
AB= VB21, 16#01
= Q0.0
LD I0.0
OB= VB22, 16#01
= Q0.1
LD SM0.0
LDD= VD30, 16#FFFFFFFF
AD= VD34, 100
= Q0.2
LD SM0.0
LDR= VD40, 3.5
AR= VD44, -2.25
= Q0.3
LD I0.7
OR= VD48, 1.0
= Q0.4`)
    cpu.words.set('VB20', 255) // byte sin signo: 255 = 16#FF
    cpu.words.set('VB21', 1)
    cpu.words.set('VB22', 2)
    cpu.words.set('VD30', -1) // doble: −1 = 16#FFFFFFFF
    cpu.words.set('VD34', 100)
    cpu.write('VD40', 'R', 3.5)
    cpu.write('VD44', 'R', -2.25)
    cpu.write('VD48', 'R', 2.0)
    run(cpu, 10, { 'I0.0': true })
    expect([bit(cpu, 'Q0.0'), bit(cpu, 'Q0.1'), bit(cpu, 'Q0.2'), bit(cpu, 'Q0.3'), bit(cpu, 'Q0.4')]).toEqual([true, true, true, true, false])
  })

  it('comparación con un real no válido (NaN): la CPU pasaría a STOP', () => {
    const cpu = cpuOf('LD SM0.0\nLDR= VD0, 0.0')
    cpu.write('VD0', 'R', NaN)
    expect(() => run(cpu, 10)).toThrow('real no válido')
  })

  it('inmediatas LDI, AI, =I, SI y RI se ejecutan como las normales (sin módulo físico)', () => {
    const cpu = cpuOf(`LDI I0.0
AI I0.1
=I Q0.0
LD I0.2
SI Q0.1, 2
LD I0.3
RI Q0.1, 2`)
    run(cpu, 10, { 'I0.0': true, 'I0.1': true })
    expect(bit(cpu, 'Q0.0')).toBe(true)
    run(cpu, 10, { 'I0.2': true })
    expect([bit(cpu, 'Q0.1'), bit(cpu, 'Q0.2')]).toEqual([true, true])
    run(cpu, 10, { 'I0.3': true })
    expect(bit(cpu, 'Q0.1')).toBe(false)
  })

  it('la pila tiene 9 niveles: al cargar el décimo se pierde el de abajo (p. 67)', () => {
    const cpu = cpuOf(`LD I0.0
LD I0.1
LD I0.1
LD I0.1
LD I0.1
LD I0.1
LD I0.1
LD I0.1
LD I0.1
LD I1.0
OLD
OLD
OLD
OLD
OLD
OLD
OLD
OLD
= Q0.0`)
    run(cpu, 10, { 'I0.0': true }) // I0.0 era el fondo: se perdió al cargar I1.0
    expect(bit(cpu, 'Q0.0')).toBe(false)
    run(cpu, 10, { 'I1.0': true })
    expect(bit(cpu, 'Q0.0')).toBe(true)
    run(cpu, 10, { 'I1.0': false, 'I0.1': true })
    expect(bit(cpu, 'Q0.0')).toBe(true)
  })

  it('subrutinas anidadas: máximo 8 niveles (p. 204)', () => {
    const blocks = Array.from({ length: 10 }, (_, i) => i)
    const text = blocks
      .map((i) => {
        const head = i === 0 ? 'ORGANIZATION_BLOCK MAIN:OB1\nBEGIN\n' : `SUBROUTINE_BLOCK SBR_${i - 1}:SBR${i - 1}\nBEGIN\n`
        const call = i < 9 ? `LD SM0.0\nCALL SBR_${i}\n` : '= M0.0\n'
        const foot = i === 0 ? 'END_ORGANIZATION_BLOCK' : `END_SUBROUTINE_BLOCK`
        return `${head}${call}${foot}`
      })
      .join('\n')
    const cpu = cpuOf(text)
    expect(() => run(cpu, 10)).toThrow('Demasiadas subrutinas anidadas')
  })

  it('BCDI con un dígito no BCD: SM1.6 y el valor no cambia (p. 100)', () => {
    const cpu = cpuOf('LD SM0.0\nMOVW 16#123A, VW0\nBCDI VW0')
    run(cpu, 10)
    expect([cpu.words.get('VW0'), sm(cpu, 6)]).toEqual([0x123a, true])
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
      P11: b('M11.6'),
    }).toEqual({ P1: [0, 1, 1], P2: [32767, 1], P3: [255, 1, 0], P4: 1, P5: [0, 0], P6: -3, P7: 0x12340000, P8: true, P9: 5, P10: 0, P11: 1 })
  })
})
