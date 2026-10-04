import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { N_, t } from '../lib/i18n'

// Visita guiada (y, después, los tutoriales de la ayuda): la pantalla se oscurece salvo lo que
// se señala y una burbuja lo explica. Un paso (lib/tours.js) es { target, title, text, waitFor?,
// hint? }:
// - target: ancla o anclas [data-tour] (o selectores CSS); sin target, la burbuja va en el centro.
// - waitFor(): el paso espera a que el usuario haga algo (se comprueba en la página); mientras,
//   «Siguiente» está desactivado y se muestra `hint`. Al cumplirse, se marca como hecho.
// Lo señalado se puede usar (el hueco no tapa); lo demás no, para no perderse. Esc cierra.
const PAD = 6
const DEFAULT_HINT = N_('Hazlo para seguir.')
const WIDTH = 340

const elementsOf = (target) =>
  (Array.isArray(target) ? target : target ? [target] : []).flatMap((anchor) => [
    ...document.querySelectorAll(/^[\w áéíóúñÁÉÍÓÚÑ-]+$/.test(anchor) ? `[data-tour="${anchor}"]` : anchor),
  ])

// Rectángulo que abarca los elementos visibles del paso (null si no hay ninguno).
function areaOf(target) {
  const rects = elementsOf(target)
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
  if (!rects.length) return null
  // Con su margen, pero sin salirse de la ventana (el aro se vería cortado).
  const x = Math.max(2, Math.min(...rects.map((r) => r.left)) - PAD)
  const y = Math.max(2, Math.min(...rects.map((r) => r.top)) - PAD)
  const right = Math.min(window.innerWidth - 2, Math.max(...rects.map((r) => r.right)) + PAD)
  const bottom = Math.min(window.innerHeight - 2, Math.max(...rects.map((r) => r.bottom)) + PAD)
  return { x, y, w: right - x, h: bottom - y }
}
const same = (a, b) => a === b || (a && b && ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k] - b[k]) < 0.5))

export default function Tour({ tour, onClose }) {
  const [index, setIndex] = useState(0)
  const [area, setArea] = useState(null)
  const [done, setDone] = useState(false)
  const [bubble, setBubble] = useState({ w: WIDTH, h: 160 })
  const bubbleRef = useRef(null)
  const step = tour.steps[index]
  const last = index === tour.steps.length - 1

  // Sitio de lo señalado y estado del paso, en cada momento (paneles que se abren, scroll…).
  useEffect(() => {
    setDone(!step.waitFor)
    const tick = () => {
      const next = areaOf(step.target)
      setArea((prev) => (same(prev, next) ? prev : next))
      if (step.waitFor?.()) setDone(true)
    }
    tick()
    const timer = setInterval(tick, 200)
    return () => clearInterval(timer)
  }, [step])

  useLayoutEffect(() => {
    const r = bubbleRef.current?.getBoundingClientRect()
    if (r && (Math.abs(r.width - bubble.w) > 1 || Math.abs(r.height - bubble.h) > 1)) setBubble({ w: r.width, h: r.height })
  })

  const go = (delta) => {
    const next = index + delta
    if (next < 0) return
    if (next >= tour.steps.length) return onClose(true)
    setIndex(next)
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  // La burbuja: debajo de lo señalado si cabe; si no, encima, a un lado o, sin nada, en el centro.
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left = (vw - bubble.w) / 2
  let top = (vh - bubble.h) / 2
  if (area) {
    left = Math.min(Math.max(12, area.x + area.w / 2 - bubble.w / 2), vw - bubble.w - 12)
    if (area.y + area.h + 12 + bubble.h < vh) top = area.y + area.h + 12
    else if (area.y - 12 - bubble.h > 0) top = area.y - 12 - bubble.h
    else {
      top = Math.min(Math.max(12, area.y), vh - bubble.h - 12)
      left = area.x + area.w + 12 + bubble.w < vw ? area.x + area.w + 12 : Math.max(12, area.x - 12 - bubble.w)
    }
  }

  // Oscurecido en cuatro trozos alrededor del hueco (el hueco deja usar lo señalado).
  const shade = 'fixed bg-slate-900/45 pointer-events-auto'
  const hole = area ?? { x: vw / 2, y: vh / 2, w: 0, h: 0 }

  return createPortal(
    <div className="tour pointer-events-none fixed inset-0 z-[70]" role="dialog" aria-modal="false" aria-label={t(tour.title)}>
      <div className={shade} style={{ left: 0, top: 0, width: vw, height: Math.max(0, hole.y) }} />
      <div className={shade} style={{ left: 0, top: hole.y + hole.h, width: vw, height: Math.max(0, vh - hole.y - hole.h) }} />
      <div className={shade} style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
      <div className={shade} style={{ left: hole.x + hole.w, top: hole.y, width: Math.max(0, vw - hole.x - hole.w), height: hole.h }} />
      {area && (
        <div
          className="pointer-events-none fixed rounded-lg ring-4 ring-blue-500/80"
          style={{ left: area.x, top: area.y, width: area.w, height: area.h }}
          data-tour-spot=""
        />
      )}
      <section
        ref={bubbleRef}
        className="pointer-events-auto fixed rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-2xl"
        style={{ left, top, width: WIDTH }}
        aria-live="polite"
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">{t(step.title)}</h2>
          <button type="button" onClick={() => onClose(false)} title={t('Salir de la visita (Esc)')} aria-label={t('Salir de la visita')} className="rounded p-0.5 text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <p className="whitespace-pre-line leading-relaxed">{t(step.text)}</p>
        {step.waitFor && (
          <p className={`mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${done ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`} data-tour-task={done ? 'hecho' : 'pendiente'}>
            {done && <Check size={14} />}
            {done ? t('¡Hecho!') : t(step.hint ?? DEFAULT_HINT)}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-slate-400">{t('{n} de {total}', { n: index + 1, total: tour.steps.length })}</span>
          <div className="flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => go(-1)} className="rounded-md px-3 py-1 text-slate-600 hover:bg-slate-100">
                {t('Anterior')}
              </button>
            )}
            <button
              type="button"
              autoFocus
              disabled={!done}
              onClick={() => go(1)}
              className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {last ? t('Terminar') : t('Siguiente')}
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
