import { useRef } from 'react'
import { PanelRightClose } from 'lucide-react'
import { t } from '../lib/i18n'
import { clampRect, resizeRect } from '../lib/floating'

const TITLE_H = 32
const EDGES = [
  ['n', 'left-2 right-2 top-0 h-1.5 cursor-ns-resize'],
  ['s', 'left-2 right-2 bottom-0 h-1.5 cursor-ns-resize'],
  ['e', 'top-2 bottom-2 right-0 w-1.5 cursor-ew-resize'],
  ['w', 'top-2 bottom-2 left-0 w-1.5 cursor-ew-resize'],
  ['nw', 'left-0 top-0 h-3 w-3 cursor-nwse-resize'],
  ['ne', 'right-0 top-0 h-3 w-3 cursor-nesw-resize'],
  ['sw', 'left-0 bottom-0 h-3 w-3 cursor-nesw-resize'],
  ['se', 'right-0 bottom-0 h-4 w-4 cursor-nwse-resize pointer-coarse:h-8 pointer-coarse:w-8'],
]

// Sección del panel de simulación sacada al lienzo (lib/floating.js): se mueve por su barra de
// título y se redimensiona por bordes y esquinas (con el teclado: flechas para mover, Mayús +
// flechas para el tamaño). host(): el elemento sobre el que flota (para no salirse de él).
// children({ width, height }): el contenido, al tamaño de la ventana.
export default function FloatingWidget({ id, title, rect, host, onChange, onDock, onFocus, z = 20, children }) {
  const drag = useRef(null)
  const hostSize = () => {
    const r = host()?.getBoundingClientRect()
    return r ? { w: r.width, h: r.height } : { w: 4000, h: 4000 }
  }
  const start = (ev, mode) => {
    if (ev.button !== undefined && ev.button !== 0) return
    ev.preventDefault()
    ev.stopPropagation()
    onFocus?.()
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    drag.current = { mode, x: ev.clientX, y: ev.clientY, rect, size: hostSize() }
  }
  const move = (ev) => {
    const d = drag.current
    if (!d) return
    const dx = ev.clientX - d.x
    const dy = ev.clientY - d.y
    const next = d.mode === 'move' ? { ...d.rect, x: d.rect.x + dx, y: d.rect.y + dy } : resizeRect(d.rect, d.mode, dx, dy)
    onChange(clampRect(next, d.size))
  }
  const end = () => {
    drag.current = null
  }
  const keys = (ev) => {
    const step = ev.altKey ? 2 : 16
    const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const d = arrows[ev.key]
    if (!d) return
    ev.preventDefault()
    const next = ev.shiftKey ? resizeRect(rect, 'se', d[0], d[1]) : { ...rect, x: rect.x + d[0], y: rect.y + d[1] }
    onChange(clampRect(next, hostSize()))
  }

  return (
    <section
      role="region"
      aria-label={t('{titulo} (flotante)', { titulo: title })}
      data-floating={id}
      onPointerDown={onFocus}
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, zIndex: z }}
      className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl"
    >
      <div
        role="toolbar"
        tabIndex={0}
        aria-label={t('Mover «{titulo}»: arrastra o usa las flechas (Mayús + flechas: tamaño)', { titulo: title })}
        onPointerDown={(ev) => start(ev, 'move')}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onKeyDown={keys}
        style={{ height: TITLE_H, touchAction: 'none' }}
        className="flex shrink-0 cursor-move select-none items-center gap-2 border-b border-slate-200 bg-slate-50 pl-3 pr-1 text-xs font-medium uppercase tracking-wide text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <button
          type="button"
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={onDock}
          title={t('Devolver al panel de simulación')}
          aria-label={t('Devolver «{titulo}» al panel', { titulo: title })}
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
        >
          <PanelRightClose size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children({ width: rect.w - 24 - 2, height: rect.h - TITLE_H - 24 - 2 })}</div>
      {EDGES.map(([edge, cls]) => (
        <div
          key={edge}
          data-resize={edge}
          onPointerDown={(ev) => start(ev, edge)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{ touchAction: 'none' }}
          className={`absolute ${cls}`}
        />
      ))}
    </section>
  )
}
