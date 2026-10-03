import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'

// Menú flotante genérico en coordenadas de pantalla. Se cierra con Esc, al hacer clic fuera
// o al elegir una opción. Se recoloca para no salirse de la ventana.
// items: [{ label, icon, onSelect, danger, hint }] o 'separator'
export default function ContextMenu({ x, y, title, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
    })
  }, [x, y])

  useEffect(() => {
    ref.current.querySelector('button')?.focus()
    const onPointerDown = (e) => !ref.current?.contains(e.target) && onClose()
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const buttons = [...ref.current.querySelectorAll('button')]
        const i = buttons.indexOf(document.activeElement)
        const next = e.key === 'ArrowDown' ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length
        buttons[next]?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', onClose)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 min-w-56 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
    >
      {title && <div className="px-3 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">{t(title)}</div>}
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 h-px bg-slate-100" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              item.onSelect()
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left pointer-coarse:py-3 outline-none focus:bg-slate-100 hover:bg-slate-100 ${
              item.danger ? 'text-red-600' : 'text-slate-700'
            }`}
          >
            {item.icon && <item.icon size={16} className={item.danger ? '' : 'text-slate-500'} />}
            <span className="flex-1">{t(item.label)}</span>
            {item.hint && <span className="text-xs text-slate-400">{t(item.hint)}</span>}
          </button>
        ),
      )}
    </div>
  )
}
