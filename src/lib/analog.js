// Entradas y salidas analógicas: señal (4–20 mA o 0–10 V), rango físico (p. ej. 0–100 °C) y
// valor bruto que lee el autómata. En la simulación se trabaja en unidades físicas; en el
// programa del autómata, los umbrales constantes se convierten al valor bruto al generarlo
// (lib/ladder/generate.js), sin cálculos en el PLC: «Temperatura > 60» -> «AIW0 > 22016».

export const SIGNALS = [
  { id: '4-20mA', label: '4–20 mA' },
  { id: '0-10V', label: '0–10 V' },
]
export const DEFAULT_ANALOG = { signal: '4-20mA', min: 0, max: 100, unit: '' }

// Valor bruto del autómata para el principio y el final de escala.
// S7-200 (EM231/EM235): 0–32000; con 4–20 mA (módulo en 0–20 mA) empieza en 6400.
// S7-300/1200 y genérico: 0–27648 en los dos casos.
export function rawRange(signal, scheme) {
  if (scheme === 's7200') return signal === '4-20mA' ? [6400, 32000] : [0, 32000]
  return [0, 27648]
}

export const analogConfig = (entry = {}) => ({
  signal: entry.signal ?? DEFAULT_ANALOG.signal,
  min: Number.isFinite(Number(entry.min)) && entry.min !== '' && entry.min != null ? Number(entry.min) : DEFAULT_ANALOG.min,
  max: Number.isFinite(Number(entry.max)) && entry.max !== '' && entry.max != null ? Number(entry.max) : DEFAULT_ANALOG.max,
  unit: entry.unit ?? DEFAULT_ANALOG.unit,
})

// Valor físico -> valor bruto (entero, redondeado; fuera de rango se recorta al rango del módulo).
export function toRaw(value, entry, scheme) {
  const { signal, min, max } = analogConfig(entry)
  const [r0, r1] = rawRange(signal, scheme)
  if (max === min) return r0
  const raw = Math.round(r0 + ((value - min) / (max - min)) * (r1 - r0))
  return Math.min(Math.max(raw, Math.min(r0, r1)), Math.max(r0, r1))
}

export const isAnalog = (type) => type === 'analogIn' || type === 'analogOut'

export const describeRange = (entry) => {
  const { signal, min, max, unit } = analogConfig(entry)
  return `${SIGNALS.find((s) => s.id === signal)?.label ?? signal}, ${min}–${max}${unit ? ` ${unit}` : ''}`
}
