// Separador del borde izquierdo de un panel lateral (planta, esquema eléctrico, ladder): arrastrar
// para repartir el espacio con el grafcet; doble clic, mitad y mitad. El ancho se recuerda entre
// sesiones (por usuario, en este navegador: depende de la pantalla, no del proyecto).
import { useRef } from 'react'
import { maxPanelWidth } from './panelWidth'

// onWidth: durante el arrastre (un cambio por fotograma); onCommit(ancho | null): al soltar o con
// doble clic (null). onEnd: después de cada cambio terminado (p. ej. reencuadrar la planta).
export default function PanelSeparator({ sectionRef, min, onWidth, onCommit, onEnd, label, title }) {
  const resizing = useRef(null)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title={title}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-blue-400/40"
      onPointerDown={(ev) => {
        ev.preventDefault() // sin seleccionar el texto de alrededor al arrastrar
        const right = sectionRef.current.getBoundingClientRect().right
        resizing.current = { right, max: maxPanelWidth(sectionRef.current), frame: 0, width: null }
        ev.currentTarget.setPointerCapture(ev.pointerId)
      }}
      onPointerMove={(ev) => {
        const r = resizing.current
        if (!r) return
        r.width = Math.round(Math.min(Math.max(min, r.right - ev.clientX), Math.max(min, r.max)))
        // Un cambio por fotograma (el lienzo del grafcet se redimensiona con él).
        if (!r.frame) {
          r.frame = requestAnimationFrame(() => {
            r.frame = 0
            onWidth(r.width)
          })
        }
      }}
      onPointerUp={() => {
        const r = resizing.current
        resizing.current = null
        if (!r?.width) return
        cancelAnimationFrame(r.frame)
        onCommit(r.width)
        onEnd?.()
      }}
      onDoubleClick={() => {
        onCommit(null)
        onEnd?.()
      }}
    />
  )
}
