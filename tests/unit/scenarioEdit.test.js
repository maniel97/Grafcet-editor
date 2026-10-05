import { describe, expect, it } from 'vitest'
import { eventsOf, paint, resize, seriesOf } from '../../src/lib/sim/scenarioEdit'

describe('editor de formas de onda', () => {
  const scenario = { duration: 1, events: [{ t: 0.2, name: 'Marcha', value: 1 }, { t: 0.5, name: 'Marcha', value: 0 }] }

  it('escenario -> filas por casilla de 0,1 s', () => {
    expect(seriesOf(scenario, ['Marcha', 'Paro'])).toEqual({ Marcha: [0, 0, 1, 1, 1, 0, 0, 0, 0, 0], Paro: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    // Una entrada NC que en reposo vale 1.
    expect(seriesOf(scenario, ['Paro'], { Paro: 1 }).Paro.every((v) => v === 1)).toBe(true)
  })

  it('pintar un pulso y volver a eventos (ida y vuelta)', () => {
    const series = seriesOf(scenario, ['Marcha', 'Paro'], { Paro: 1 })
    series.Paro = paint(series.Paro, 7, 6, 0) // Paro pulsado de 0,6 a 0,7 s (arrastrando hacia atrás)
    expect(eventsOf(series, { Paro: 1 })).toEqual([
      { t: 0.2, name: 'Marcha', value: 1 },
      { t: 0.5, name: 'Marcha', value: 0 },
      { t: 0.6, name: 'Paro', value: 0 },
      { t: 0.8, name: 'Paro', value: 1 },
    ])
    expect(seriesOf({ duration: 1, events: eventsOf(series, { Paro: 1 }) }, ['Marcha', 'Paro'], { Paro: 1 })).toEqual(series)
  })

  it('cambiar la duración conserva lo pintado', () => {
    const series = seriesOf(scenario, ['Marcha'])
    expect(resize(series, 0.4).Marcha).toEqual([0, 0, 1, 1])
    expect(resize(series, 1.2).Marcha.slice(-3)).toEqual([0, 0, 0])
  })
})
