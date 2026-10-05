// Requisitos de un ejercicio (fase 3): lo que el profesor pide que el grafcet use, además de que
// funcione (p. ej. «usa una temporización», «como mucho 6 etapas»). Se miran en el dibujo del
// alumno: etapas, transiciones, enlaces y acciones. Puro: se prueba sin navegador.
import { N_, t } from './i18n'
import { normalizeAction } from './actions'

// Temporización «t/x» sobre una etapa (2s/X2) o sobre cualquier variable (1s/Pila), como en la norma.
const TIMER = /\d+(?:[.,]\d+)?\s*(?:ms|s|min|h)\s*\/\s*[\p{L}_][\p{L}\p{N}_]*/iu
const COUNT = /:=\s*[A-Za-z_]\w*\s*[+-]\s*\d/

const stepsOf = (nodes) => nodes.filter((n) => n.type === 'step')
const transitionsOf = (nodes) => nodes.filter((n) => n.type === 'transition')
const actionsOf = (nodes) => stepsOf(nodes).flatMap((s) => (s.data.actions ?? []).map(normalizeAction))
const textsOf = (nodes) => [...transitionsOf(nodes).map((n) => n.data.condition ?? ''), ...actionsOf(nodes).map((a) => `${a.text} ${a.condition ?? ''}`)]
// Cuántos enlaces salen de cada nodo (hacia nodos del tipo dado).
const fanOut = (nodes, edges, from, to) => {
  const type = new Map(nodes.map((n) => [n.id, n.type]))
  const count = new Map()
  for (const e of edges) if (type.get(e.source) === from && type.get(e.target) === to) count.set(e.source, (count.get(e.source) ?? 0) + 1)
  return Math.max(0, ...count.values())
}

// id -> { label, test(nodes, edges, value) -> bool, value? (si lleva número) }
export const REQUIREMENTS = [
  { id: 'timer', label: N_('Usa una temporización'), test: (nodes) => textsOf(nodes).some((s) => TIMER.test(s)) },
  { id: 'counter', label: N_('Usa un contador'), test: (nodes) => actionsOf(nodes).some((a) => COUNT.test(a.text)) },
  { id: 'edge', label: N_('Usa un flanco (↑ o ↓)'), test: (nodes) => textsOf(nodes).some((s) => /[↑↓]/.test(s)) },
  { id: 'or', label: N_('Elige entre secuencias (divergencia en O)'), test: (nodes, edges) => fanOut(nodes, edges, 'step', 'transition') >= 2 },
  { id: 'and', label: N_('Hace secuencias a la vez (divergencia en Y)'), test: (nodes, edges) => fanOut(nodes, edges, 'transition', 'step') >= 2 },
  { id: 'conditional', label: N_('Usa una acción condicionada'), test: (nodes) => actionsOf(nodes).some((a) => a.kind === 'conditional') },
  { id: 'stored', label: N_('Usa una acción memorizada'), test: (nodes) => actionsOf(nodes).some((a) => a.kind === 'stored-on' || a.kind === 'stored-off') },
  { id: 'maxSteps', label: N_('Como mucho {n} etapas'), value: 6, test: (nodes, edges, n) => stepsOf(nodes).length <= n },
]
export const requirement = (id) => REQUIREMENTS.find((r) => r.id === id)
export const requirementLabel = (req) => t(requirement(req.id)?.label ?? req.id, { n: req.value ?? requirement(req.id)?.value })

// Requisitos pedidos [{ id, value }] -> [{ id, ok, title, detail }] (para el corrector).
export function checkRequirements(nodes, edges, wanted = []) {
  return wanted
    .filter((r) => requirement(r.id))
    .map((r) => {
      const def = requirement(r.id)
      const value = Number(r.value ?? def.value)
      const ok = def.test(nodes, edges, value)
      const title = requirementLabel(r)
      const detail = ok ? '' : r.id === 'maxSteps' ? t('Tu grafcet tiene {n} etapas.', { n: stepsOf(nodes).length }) : t('El enunciado lo pide y tu grafcet aún no lo usa.')
      return { id: `requisito-${r.id}`, ok, title, detail }
    })
}

// Nota (fase 3, opcional): la parte de criterios cumplidos sobre el máximo, menos lo que reste cada
// pista vista; nunca por debajo de 0. results: los del corrector; grade: { max, hintPenalty }.
export function gradeOf(results, grade, hintsShown = 0) {
  if (!results.length) return 0
  const max = Number(grade?.max) || 10
  const passed = results.filter((r) => r.ok).length
  const raw = (max * passed) / results.length - (Number(grade?.hintPenalty) || 0) * hintsShown
  return Math.max(0, Math.round(raw * 10) / 10)
}
