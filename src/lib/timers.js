// Asistente de temporizaciones (panel de la transición): genera la sintaxis normalizada IEC 60848
// sin tener que sabérsela, y dice cómo se lee. Ver ayuda «Temporizaciones».
//   'on'   t1/a     retardo a la subida (5s/X2: X2 activa desde hace 5 s)
//   'off'  0s/a/t2  retardo a la bajada (sube con a y sigue t2 después de que a baje)
//   'both' t1/a/t2  los dos
import { N_ } from './i18n'

export const TIMER_UNITS = ['ms', 's', 'min', 'h']
export const TIMER_MODES = [
  { id: 'on', label: N_('Retardo a la subida (t1/a)') },
  { id: 'off', label: N_('Retardo a la bajada (0s/a/t2)') },
  { id: 'both', label: N_('Los dos (t1/a/t2)') },
]

const isTime = (value) => /^\d+(?:[.,]\d+)?$/.test(String(value ?? '')) && parseFloat(String(value).replace(',', '.')) > 0
const isRef = (ref) => /^[\p{L}_][\p{L}\p{N}_.]*$/u.test(String(ref ?? ''))
const isStepRef = (ref) => /^X\p{N}/u.test(ref)

// { mode, on, onUnit, ref, off, offUnit } -> texto de la receptividad, o null si falta algo.
export function timerText({ mode, on, onUnit, ref, off, offUnit }) {
  if (!isRef(ref)) return null
  const t1 = mode === 'off' ? '0s' : isTime(on) && `${on}${onUnit}`
  const t2 = mode !== 'on' && isTime(off) && `${off}${offUnit}`
  if (!t1 || (mode !== 'on' && !t2)) return null
  return t2 ? `${t1}/${ref}/${t2}` : `${t1}/${ref}`
}

// Cómo se lee: { text, vars } para traducir con t(text, vars), o null.
export function timerReading({ mode, on, onUnit, ref, off, offUnit }) {
  if (!timerText({ mode, on, onUnit, ref, off, offUnit })) return null
  const t1 = `${on} ${onUnit}`
  const t2 = `${off} ${offUnit}`
  const step = isStepRef(ref)
  if (mode === 'on')
    return step
      ? { text: N_('Verdadera cuando {ref} lleva {t1} activa.'), vars: { ref, t1 } }
      : { text: N_('Verdadera cuando {ref} lleva {t1} a 1; vuelve a 0 en cuanto {ref} baja.'), vars: { ref, t1 } }
  if (mode === 'off')
    return step
      ? { text: N_('Verdadera en cuanto se activa {ref}, y sigue a 1 hasta {t2} después de que se desactive.'), vars: { ref, t2 } }
      : { text: N_('Verdadera en cuanto {ref} sube, y sigue a 1 hasta {t2} después de que {ref} baje.'), vars: { ref, t2 } }
  return step
    ? { text: N_('Sube {t1} después de activarse {ref} y baja {t2} después de que se desactive.'), vars: { ref, t1, t2 } }
    : { text: N_('Sube {t1} después de que suba {ref} y baja {t2} después de que baje.'), vars: { ref, t1, t2 } }
}
