// Acciones asociadas a etapas según IEC 60848.
// Cada acción es { text, kind, condition }. Los proyectos antiguos guardaban solo el texto
// (string): normalizeAction los trata como acciones continuas.

export const ACTION_KINDS = [
  {
    id: 'continuous',
    label: 'Continua',
    help: 'Activa mientras la etapa está activa.',
  },
  {
    id: 'conditional',
    label: 'Condicionada',
    help: 'Activa mientras la etapa está activa Y se cumple la condición. Con una condición de tiempo (p. ej. 3s/X2) es retardada; con su negación, limitada en el tiempo.',
    needsCondition: true,
    placeholder: 'p. ej. b, 3s/X2',
  },
  {
    id: 'stored-on',
    label: 'Memorizada en la activación',
    help: 'Se ejecuta una vez al activarse la etapa (p. ej. A:=1, C:=C+1).',
  },
  {
    id: 'stored-off',
    label: 'Memorizada en la desactivación',
    help: 'Se ejecuta una vez al desactivarse la etapa (p. ej. A:=0).',
  },
  {
    id: 'event',
    label: 'Al evento',
    help: 'Se ejecuta una vez cuando ocurre el evento estando la etapa activa (p. ej. ↑b).',
    needsCondition: true,
    placeholder: 'p. ej. ↑b',
  },
]

export const actionKind = (id) => ACTION_KINDS.find((k) => k.id === id) ?? ACTION_KINDS[0]

export function normalizeAction(action) {
  if (typeof action === 'string') return { text: action, kind: 'continuous', condition: '' }
  return { text: '', kind: 'continuous', condition: '', ...action }
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
