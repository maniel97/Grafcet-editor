// Acciones asociadas a etapas según IEC 60848.
// Cada acción es { text, kind, condition }. Los proyectos antiguos guardaban solo el texto
// (string): normalizeAction los trata como acciones continuas.
import { N_ } from './i18n'

export const ACTION_KINDS = [
  {
    id: 'continuous',
    label: N_('Continua'),
    help: N_('Activa mientras la etapa está activa.'),
  },
  {
    id: 'conditional',
    label: N_('Condicionada'),
    help: N_('Activa mientras la etapa está activa Y se cumple la condición. Con una condición de tiempo (p. ej. 3s/X2) es retardada; con su negación, limitada en el tiempo.'),
    needsCondition: true,
    placeholder: N_('p. ej. b, 3s/X2'),
  },
  {
    id: 'stored-on',
    label: N_('Memorizada en la activación'),
    help: N_('Se ejecuta una vez al activarse la etapa (p. ej. A:=1, C:=C+1).'),
  },
  {
    id: 'stored-off',
    label: N_('Memorizada en la desactivación'),
    help: N_('Se ejecuta una vez al desactivarse la etapa (p. ej. A:=0).'),
  },
  {
    id: 'event',
    label: N_('Al evento'),
    help: N_('Se ejecuta una vez cuando ocurre el evento estando la etapa activa (p. ej. ↑b).'),
    needsCondition: true,
    placeholder: N_('p. ej. ↑b'),
  },
]

export const actionKind = (id) => ACTION_KINDS.find((k) => k.id === id) ?? ACTION_KINDS[0]

export function normalizeAction(action) {
  if (typeof action === 'string') return { text: action, kind: 'continuous', condition: '' }
  return { text: '', kind: 'continuous', condition: '', ...action }
}

// Asignación (A:=1, C:=C+1, N:=5). IEC 60848: solo existe memorizada (al activar o al desactivar
// la etapa) o al evento; como continua o condicionada no haría nada (la simulación y el ladder la
// saltan), así que al escribirla se pasa sola a «memorizada al activar».
export const isAssignment = (text) => /^\s*[\p{L}_][\p{L}\p{N}_.]*\s*:=/u.test(text ?? '')
export const misplacedAssignment = (action) => {
  const a = normalizeAction(action)
  return isAssignment(a.text) && (a.kind === 'continuous' || a.kind === 'conditional')
}
// La acción con su tipo corregido si es una asignación continua (la devuelve igual si no).
export function fixAssignmentKind(action) {
  const a = normalizeAction(action)
  return isAssignment(a.text) && a.kind === 'continuous' ? { ...a, kind: 'stored-on' } : action
}

// Acciones habituales para añadir con un clic.
export const ACTION_PRESETS = [
  { text: 'A+', kind: 'continuous' },
  { text: 'A-', kind: 'continuous' },
  { text: 'Motor ON', kind: 'continuous' },
  { text: 'Luz OK', kind: 'continuous' },
  { text: 'A:=1', kind: 'stored-on' },
  { text: 'A:=0', kind: 'stored-off' },
  { text: 'C:=C+1', kind: 'stored-on' },
]
