// Nombre de la variable de etapa (la que vale 1 cuando la etapa está activa).
// IEC 60848 usa X + número (X2), y así se escribe siempre en las receptividades (X2, 5s/X2).
// Para la tabla de variables, el ladder, el ST, el AWL y la simulación se puede elegir E + número
// (E2, «Etapa 2»), habitual en España. Se guarda en el proyecto (`plc.stepPrefix`); los
// proyectos sin elección propia usan la última elegida en este navegador.

export const STEP_PREFIXES = [
  { id: 'X', label: 'X1 (IEC 60848)' },
  { id: 'E', label: 'E1 (Etapa 1)' },
]

const STORAGE_KEY = 'grafcet-editor:step-prefix'

export function preferredStepPrefix() {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY)
    return STEP_PREFIXES.some((p) => p.id === value) ? value : null
  } catch {
    return null
  }
}

export function setPreferredStepPrefix(prefix) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, prefix)
  } catch {
    // Sin almacenamiento: la elección queda solo en el proyecto.
  }
}

export const resolveStepPrefix = (plc) => plc?.stepPrefix ?? preferredStepPrefix() ?? 'X'

export const stepVar = (label, prefix = 'X') => `${prefix}${label}`
