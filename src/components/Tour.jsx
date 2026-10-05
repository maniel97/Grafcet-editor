import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { N_, t } from '../lib/i18n'

// Visita guiada (y, después, los tutoriales de la ayuda): la pantalla se oscurece salvo lo que
// se señala y una burbuja lo explica. Un paso (lib/tours.js) es { target, title, text, waitFor?,
// hint? }:
// - target: ancla o anclas [data-tour] (o selectores CSS), o una función que las devuelve en cada
//   momento (el foco sigue a lo que hay que hacer: la etapa, su +, el panel que se abre…); sin
//   target, la burbuja va en el centro.
// - free: no bloquea lo de fuera (para pasos que usan paneles o menús).
// - waitFor(memoria): el paso espera a que el usuario haga algo (se comprueba en la página); mientras,
//   «Siguiente» está desactivado y se muestra `hint`. Al cumplirse, se marca como hecho y, en los
//   tutoriales (tour.auto), pasa solo al siguiente a los 3 s si el alumno lo tiene activado.
// Lo señalado se puede usar (el hueco no tapa); lo demás no, para no perderse. Esc cierra.
const PAD = 6
const DEFAULT_HINT = N_('Hazlo para seguir.')
const WIDTH = 340
const AUTO_DELAY = 3000 // ms: tiempo para ver «¡Bien hecho!» antes de pasar al siguiente
const AUTO_KEY = 'grafcet-tour-auto'
// Oscurecido: negro con opacidad fija (los grises de la paleta se invierten en modo oscuro).
const SHADE = 'rgba(2, 6, 23, 0.72)'
const SHADE_FREE = 'rgba(2, 6, 23, 0.58)'

export const autoAdvance = () => {
  try {
    return localStorage.getItem(AUTO_KEY) !== 'no'
  } catch {
    return true
  }
}
const setAutoAdvance = (on) => {
  try {
    localStorage.setItem(AUTO_KEY, on ? 'si' : 'no')
  } catch {
    // sin almacenamiento: solo para esta vez
  }
}

const elementsOf = (target) => {
  const value = typeof target === 'function' ? target() : target
  return (Array.isArray(value) ? value : value ? [value] : []).flatMap((anchor) =>
    anchor instanceof Element ? [anchor] : [...document.querySelectorAll(/^[\w áéíóúñÁÉÍÓÚÑ-]+$/.test(anchor) ? `[data-tour="${anchor}"]` : anchor)],
  )
}

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
  const [auto, setAuto] = useState(autoAdvance)
  // Con un diálogo modal abierto, la visita se pinta dentro de él: si no, el diálogo (que va en la
  // capa superior del navegador) la taparía justo cuando explica qué hacer en él.
  const [host, setHost] = useState(null)
  const bubbleRef = useRef(null)
  const step = tour.steps[index]
  const last = index === tour.steps.length - 1

  // Sitio de lo señalado y estado del paso, en cada momento (paneles que se abren, scroll…).
  useEffect(() => {
    setDone(!step.waitFor)
    const memory = {} // estado propio de esta vez en el paso (lib/tutorials.js, sequence)
    const tick = () => {
      const modal = [...document.querySelectorAll('dialog[open]')].findLast((d) => d.matches(':modal')) ?? null
      setHost((prev) => (prev === modal ? prev : modal))
      // Lo señalado dentro de un diálogo largo puede quedar fuera de la vista: se trae una vez. (Solo
      // en diálogos: en el lienzo, desplazar su contenedor descolocaría el grafcet.)
      if (!memory.scrolled) {
        const el = elementsOf(step.target)[0]
        if (el?.closest('dialog')) {
          memory.scrolled = true
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
      }
      const next = areaOf(step.target)
      setArea((prev) => (same(prev, next) ? prev : next))
      if (step.waitFor?.(memory)) setDone(true)
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

  // Tutoriales (tour.auto): un paso cumplido pasa solo al siguiente, tras ver «¡Bien hecho!» unos
  // segundos (se puede desactivar: entonces se pasa con «Siguiente»).
  const autoNow = Boolean(tour.auto && auto && done && step.waitFor && !last)
  useEffect(() => {
    if (!autoNow) return
    const timer = setTimeout(() => setIndex((i) => i + 1), AUTO_DELAY)
    return () => clearTimeout(timer)
  }, [autoNow, step])

  useEffect(() => {
    const onKey = (e) => {
      // Escribiendo, Esc es del campo (cierra sus sugerencias), no de la visita.
      if (e.key === 'Escape' && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) {
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
  if (step.free) {
    // En los pasos libres se trabaja en el lienzo y los paneles: la burbuja, en la esquina que no
    // tape lo señalado (abajo a la izquierda si se puede).
    const corners = [
      [64, vh - bubble.h - 64],
      [vw - bubble.w - 24, vh - bubble.h - 24],
      [64, 72],
      [vw - bubble.w - 24, 72],
    ]
    const overlaps = ([x, y]) => area && x < area.x + area.w && x + bubble.w > area.x && y < area.y + area.h && y + bubble.h > area.y
    ;[left, top] = corners.find((c) => !overlaps(c)) ?? corners[0]
  } else if (area) {
    left = Math.min(Math.max(12, area.x + area.w / 2 - bubble.w / 2), vw - bubble.w - 12)
    if (area.y + area.h + 12 + bubble.h < vh) top = area.y + area.h + 12
    else if (area.y - 12 - bubble.h > 0) top = area.y - 12 - bubble.h
    else {
      top = Math.min(Math.max(12, area.y), vh - bubble.h - 12)
      left = area.x + area.w + 12 + bubble.w < vw ? area.x + area.w + 12 : Math.max(12, area.x - 12 - bubble.w)
    }
  }

  // Oscurecido en cuatro trozos alrededor del hueco (el hueco deja usar lo señalado).
  // Con free (tutoriales), oscurece igual pero deja usar todo (paneles, menús, el lienzo).
  const shade = `fixed ${step.free ? 'pointer-events-none' : 'pointer-events-auto'}`
  const shadeColor = { background: step.free ? SHADE_FREE : SHADE }
  const hole = area ?? { x: vw / 2, y: vh / 2, w: 0, h: 0 }

  return createPortal(
    <div className="tour pointer-events-none fixed inset-0 z-[70]" role="dialog" aria-modal="false" aria-label={t(tour.title)}>
      <div className={shade} style={{ ...shadeColor, left: 0, top: 0, width: vw, height: Math.max(0, hole.y) }} />
      <div className={shade} style={{ ...shadeColor, left: 0, top: hole.y + hole.h, width: vw, height: Math.max(0, vh - hole.y - hole.h) }} />
      <div className={shade} style={{ ...shadeColor, left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
      <div className={shade} style={{ ...shadeColor, left: hole.x + hole.w, top: hole.y, width: Math.max(0, vw - hole.x - hole.w), height: hole.h }} />
      {area && (
        <div
          className="tour-ring pointer-events-none fixed rounded-lg"
          style={{ left: area.x, top: area.y, width: area.w, height: area.h, outline: '4px solid #60a5fa' }}
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
          <div
            className={`mt-2 overflow-hidden rounded-md text-xs ${done ? 'tour-done bg-green-100 text-green-900' : 'bg-blue-50 text-blue-800'}`}
            data-tour-task={done ? 'hecho' : 'pendiente'}
          >
            <p className="flex items-center gap-1.5 px-2 py-1.5">
              {done && <Check size={16} className="tour-check shrink-0" />}
              {done ? <strong>{t('¡Bien hecho!')}</strong> : t(step.hint ?? DEFAULT_HINT)}
              {autoNow && <span className="ml-auto text-green-800">{t('Sigue en 3 s')}</span>}
            </p>
            {/* Cuenta atrás hasta el paso siguiente. */}
            {autoNow && <div key={index} className="tour-countdown h-1 bg-green-600" style={{ animationDuration: `${AUTO_DELAY}ms` }} />}
          </div>
        )}
        {tour.auto && (
          <label className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => {
                setAuto(e.target.checked)
                setAutoAdvance(e.target.checked)
              }}
            />
            {t('Al hacerlo bien, pasar solo al paso siguiente')}
          </label>
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
              className={`rounded-md px-3 py-1 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 ${done && step.waitFor ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {last ? t('Terminar') : t('Siguiente')}
            </button>
          </div>
        </div>
      </section>
    </div>,
    host ?? document.body,
  )
}
