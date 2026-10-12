// Paneles apilados (#18): planta, esquema eléctrico y ladder en una columna junto al grafcet, uno
// encima de otro. El reparto del alto (grow de cada panel) se cambia arrastrando el borde de arriba
// de cada uno, menos el primero; doble clic, a partes iguales.
import { useRef } from 'react'
import { Columns2, Rows2 } from 'lucide-react'
import { boxChildren } from './panelWidth'
import { t } from '../lib/i18n'

const MIN_HEIGHT = 140

// Borde de arriba de un panel apilado. onGrow({ id: alto }) durante el arrastre; onCommit al soltar
// (con el reparto final) o con doble clic (null: a partes iguales).
export function StackSeparator({ onGrow, onCommit }) {
  const drag = useRef(null)
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={t('Alto de los paneles apilados')}
      title={t('Arrastra para repartir el alto entre los paneles (doble clic: a partes iguales)')}
      className="absolute inset-x-0 -top-1 z-10 h-2 cursor-row-resize hover:bg-blue-400/40"
      onPointerDown={(ev) => {
        ev.preventDefault()
        const self = ev.currentTarget.parentElement
        const panels = boxChildren(self.closest('[data-stack]')).filter((el) => el.dataset.panel)
        const i = panels.indexOf(self)
        if (i < 1) return
        // Todos en píxeles (la misma escala) y se mueve el borde entre el anterior y este.
        const heights = Object.fromEntries(panels.map((p) => [p.dataset.panel, p.getBoundingClientRect().height]))
        drag.current = { y: ev.clientY, heights, above: panels[i - 1].dataset.panel, below: self.dataset.panel, frame: 0, next: null }
        ev.currentTarget.setPointerCapture(ev.pointerId)
      }}
      onPointerMove={(ev) => {
        const d = drag.current
        if (!d) return
        const total = d.heights[d.above] + d.heights[d.below]
        const above = Math.min(Math.max(MIN_HEIGHT, d.heights[d.above] + ev.clientY - d.y), total - MIN_HEIGHT)
        d.next = { ...d.heights, [d.above]: Math.round(above), [d.below]: Math.round(total - above) }
        if (!d.frame) {
          d.frame = requestAnimationFrame(() => {
            d.frame = 0
            onGrow(d.next)
          })
        }
      }}
      onPointerUp={() => {
        const d = drag.current
        drag.current = null
        if (!d?.next) return
        cancelAnimationFrame(d.frame)
        onCommit(d.next)
      }}
      onDoubleClick={() => onCommit(null)}
    >
      {/* La raya entre los dos paneles (el separador es más ancho, para cogerlo bien). */}
      <div className="pointer-events-none absolute inset-x-0 top-1 h-px bg-slate-300" />
    </div>
  )
}

// Botón de la cabecera: apilar los paneles en una columna o ponerlos uno al lado de otro.
export function StackButton({ stacked, onToggle }) {
  const label = stacked ? t('Paneles uno al lado de otro') : t('Apilar los paneles en una columna')
  return (
    <button type="button" onClick={onToggle} title={label} aria-label={label} aria-pressed={stacked} className="rounded p-1 text-slate-500 hover:bg-slate-100">
      {stacked ? <Columns2 size={14} /> : <Rows2 size={14} />}
    </button>
  )
}
