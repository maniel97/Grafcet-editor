import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_SIZE, clampRect, loadFloating, saveFloating } from '../lib/floating'

const MIME = 'application/x-grafcet-float'

// Paneles flotantes del simulador sobre el lienzo (lib/floating.js). Devuelve:
//   floating: lo que necesita el panel de simulación (abrir, devolver, mover, orden…)
//   layerRef: para la capa sobre el lienzo donde flotan
//   dropProps: para el lienzo, que acepta un título de sección soltado encima
export function useFloating() {
  const [layout, setLayout] = useState(loadFloating)
  const [layer, setLayer] = useState(null)
  const [order, setOrder] = useState([]) // el último tocado, encima
  useEffect(() => saveFloating(layout), [layout])

  const size = useCallback(() => {
    const r = layer?.getBoundingClientRect()
    return r ? { w: r.width, h: r.height } : { w: 1200, h: 800 }
  }, [layer])

  // Si el lienzo se hace más pequeño (ventana, paneles), los paneles vuelven a caber.
  useEffect(() => {
    if (!layer || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() =>
      setLayout((l) => {
        const host = size()
        let changed = false
        const next = { ...l }
        for (const [id, r] of Object.entries(l)) {
          if (!r.open) continue
          const fixed = clampRect(r, host)
          if (fixed.x !== r.x || fixed.y !== r.y || fixed.w !== r.w || fixed.h !== r.h) {
            next[id] = { ...r, ...fixed }
            changed = true
          }
        }
        return changed ? next : l
      }),
    )
    observer.observe(layer)
    return () => observer.disconnect()
  }, [layer, size])

  const focus = useCallback((id) => setOrder((o) => (o.at(-1) === id ? o : [...o.filter((x) => x !== id), id])), [])
  // Abrir: donde se soltó (at, relativo a la zona de trabajo), donde estaba la última vez o arriba a
  // la izquierda (escalonados).
  const open = useCallback(
    (id, at) => {
      setLayout((l) => {
        const host = size()
        const prev = l[id]
        const w = prev?.w ?? Math.min(DEFAULT_SIZE.w, host.w - 32)
        const h = prev?.h ?? DEFAULT_SIZE.h
        const openCount = Object.values(l).filter((r) => r.open).length
        const base = at ? { x: at.x - 60, y: at.y - 14 } : prev ? { x: prev.x, y: prev.y } : { x: 16 + openCount * 40, y: 16 + openCount * 48 }
        return { ...l, [id]: { ...clampRect({ ...base, w, h }, host), open: true } }
      })
      focus(id)
    },
    [size, focus],
  )
  const dock = useCallback((id) => setLayout((l) => ({ ...l, [id]: { ...l[id], open: false } })), [])
  const move = useCallback((id, rect) => setLayout((l) => ({ ...l, [id]: { ...l[id], ...rect, open: true } })), [])

  const floating = useMemo(
    () => ({
      layer,
      isOpen: (id) => Boolean(layout[id]?.open),
      rect: (id) => layout[id] ?? { x: 16, y: 16, ...DEFAULT_SIZE },
      z: (id) => 20 + Math.max(0, order.indexOf(id)),
      open,
      dock,
      move,
      focus,
    }),
    [layer, layout, order, open, dock, move, focus],
  )

  const dropProps = {
    onDragOver: (ev) => {
      if (ev.dataTransfer.types.includes(MIME)) {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
      }
    },
    onDrop: (ev) => {
      const id = ev.dataTransfer.getData(MIME)
      if (!id || !layer) return
      ev.preventDefault()
      const r = layer.getBoundingClientRect()
      open(id, { x: ev.clientX - r.left, y: ev.clientY - r.top })
    },
  }
  return { floating, layerRef: setLayer, dropProps }
}
