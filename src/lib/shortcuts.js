import { useEffect, useRef } from 'react'
import { ARROWS } from './keyboardNav'

// Atajos de teclado globales del editor. Se ignoran mientras se escribe en un campo de texto
// o con un diálogo modal abierto, para no interferir con la edición.
// handlers: { undo, redo, copy, cut, paste, duplicate, selectAll, save, open, help, escape,
//             move(dx, dy), navigate(dir), edit, find }
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
        if (key === 'f') return run(h.find)
        return
      }
      // Flechas e Intro solo sobre el lienzo (o sin foco): en botones y menús hacen lo suyo
      // (Intro pulsa el botón, las flechas recorren el menú).
      const onCanvas = t === document.body || (t instanceof Element && !!t.closest('.react-flow'))
      const canvasKey = onCanvas && !document.querySelector('[role="menu"]')
      const arrow = canvasKey && ARROWS[e.key]
      if (arrow) {
        // Alt + flecha: ir al elemento vecino; flecha: mover la selección (Mayús: de 50 en 50).
        if (e.altKey) return run(() => h.navigate?.(arrow.dir))
        const step = e.shiftKey ? 50 : 10
        return run(() => h.move?.(arrow.dx * step, arrow.dy * step))
      }
      if (canvasKey && e.key === 'Enter' && !e.altKey) return run(h.edit)
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
  ['Ctrl+F', 'Buscar en el diagrama (Intro: siguiente)'],
  ['Mayús + arrastrar', 'Seleccionar varios con un recuadro'],
  ['Doble clic · Intro', 'Editar etapa o transición (Intro: la seleccionada)'],
  ['Alt + flechas', 'Ir a la etapa o transición siguiente, anterior o de la rama vecina'],
  ['Flechas · Mayús + flechas', 'Mover la selección 10 px · 50 px'],
  ['Clic derecho', 'Menú contextual (ramificaciones, convergencias…)'],
  ['Esc', 'Cancelar / deseleccionar'],
  ['Pulsación larga (táctil)', 'Menú contextual (como el clic derecho)'],
  ['Doble toque (táctil)', 'Editar etapa, transición o nota'],
  ['Controles (abajo izq.)', 'Acercar · alejar · encuadrar todo · candado para bloquear la edición'],
  ['1 … 9 (simulando)', 'Cambiar las entradas 1 a 9'],
  ['? · F1', 'Esta ayuda'],
]
