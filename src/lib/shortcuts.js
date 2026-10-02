import { useEffect, useRef } from 'react'

// Atajos de teclado globales del editor. Se ignoran mientras se escribe en un campo de texto
// o con un diálogo modal abierto, para no interferir con la edición.
// handlers: { undo, redo, copy, cut, paste, duplicate, selectAll, save, open, help, escape }
export function useEditorShortcuts(handlers) {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const onKeyDown = (e) => {
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      if (document.querySelector('dialog[open]')) return
      const h = ref.current
      const key = e.key.toLowerCase()
      const run = (fn) => {
        if (!fn) return
        e.preventDefault()
        fn()
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.altKey) return
        if (key === 'z') return run(e.shiftKey ? h.redo : h.undo)
        if (key === 'y') return run(h.redo)
        if (key === 'c') return run(h.copy)
        if (key === 'x') return run(h.cut)
        if (key === 'v') return run(h.paste)
        if (key === 'd') return run(h.duplicate)
        if (key === 'a') return run(h.selectAll)
        if (key === 's') return run(h.save)
        if (key === 'o') return run(h.open)
        return
      }
      if (e.key === '?' || e.key === 'F1') return run(h.help)
      if (e.key === 'Escape') h.escape?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

// Lista para la ayuda (HelpDialog).
export const SHORTCUTS = [
  ['Ctrl+Z', 'Deshacer'],
  ['Ctrl+Shift+Z · Ctrl+Y', 'Rehacer'],
  ['Ctrl+C · Ctrl+X · Ctrl+V', 'Copiar · cortar · pegar (renumera las etapas)'],
  ['Ctrl+D', 'Duplicar la selección'],
  ['Ctrl+A', 'Seleccionar todo'],
  ['Supr · Retroceso', 'Eliminar la selección'],
  ['Ctrl+S · Ctrl+O', 'Guardar · abrir proyecto (.json)'],
  ['Mayús + arrastrar', 'Seleccionar varios con un recuadro'],
  ['Doble clic', 'Editar etapa o transición'],
  ['Clic derecho', 'Menú contextual (ramificaciones, convergencias…)'],
  ['Esc', 'Cancelar / deseleccionar'],
  ['Pulsación larga (táctil)', 'Menú contextual (como el clic derecho)'],
  ['Doble toque (táctil)', 'Editar etapa, transición o nota'],
  ['Controles (abajo izq.)', 'Acercar · alejar · encuadrar todo · candado para bloquear la edición'],
  ['1 … 9 (simulando)', 'Cambiar las entradas 1 a 9'],
  ['? · F1', 'Esta ayuda'],
]
