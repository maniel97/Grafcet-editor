import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { t } from '../lib/i18n'

// Botón de la barra con un submenú desplegable (Abrir, Exportar...). El submenú se coloca con
// posición fija bajo el botón: la barra tiene desplazamiento horizontal y lo recortaría si fuera
// hijo suyo. Se maneja con teclado (flechas, Intro, Esc) y se cierra al hacer clic fuera.
// items: [{ id, label, hint, icon, onSelect, disabled }]
export default function ToolbarDropdown({ icon: Icon, label, title, menuLabel, items, labelClass, disabled }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    if (!open) return
    const r = buttonRef.current.getBoundingClientRect()
    const width = 300
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width })
  }, [open])

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector('button')?.focus()
    const close = () => setOpen(false)
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close()
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...menuRef.current.querySelectorAll('button')]
        const i = items.indexOf(document.activeElement)
        items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title={t(title)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex shrink-0 items-center gap-1.5 rounded-md py-2 pl-2.5 pr-2 text-sm text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 ${
          open ? 'bg-slate-100' : ''
        }`}
      >
        <Icon size={18} />
        <span className={labelClass}>{t(label)}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && pos && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t(menuLabel)}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          className="fixed z-50 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-xl"
        >
          {items.map((f) => (
            <button
              key={f.id}
              type="button"
              role="menuitem"
              disabled={f.disabled}
              onClick={() => {
                setOpen(false)
                f.onSelect()
              }}
              className="flex w-full items-start gap-3 px-3 py-2 text-left pointer-coarse:py-3 outline-none hover:bg-slate-100 focus:bg-slate-100 disabled:opacity-40"
            >
              <f.icon size={18} className="mt-0.5 shrink-0 text-slate-500" />
              <span>
                <span className="block font-medium text-slate-800">{t(f.label)}</span>
                <span className="block text-xs text-slate-500">{t(f.hint)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
