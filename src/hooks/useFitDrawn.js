import { useCallback, useEffect, useRef } from 'react'
import { useNodesInitialized, useReactFlow } from '@xyflow/react'
import { drawnBounds } from '../lib/exportImage'

// Encuadra todo lo dibujado (no solo las cajas de los nodos: también receptividades, bucles,
// saltos y la tabla), con margen. Sustituye al encuadre de React Flow, que lo recortaba.
// También hace el encuadre inicial en cuanto React Flow ha medido los nodos.
export function useFitDrawn(wrapperRef) {
  const { getViewport, setViewport, getNodes } = useReactFlow()

  const fitDrawn = useCallback(
    (duration = 300) => {
      const wrapper = wrapperRef.current
      const viewportEl = wrapper?.querySelector('.react-flow__viewport')
      const bounds = viewportEl && drawnBounds(viewportEl, getViewport())
      if (!bounds) return
      const { width, height } = wrapper.getBoundingClientRect()
      const pad = 48
      const w = bounds.maxX - bounds.minX
      const h = bounds.maxY - bounds.minY
      const zoom = Math.min(1.5, Math.max(0.1, Math.min((width - pad * 2) / w, (height - pad * 2) / h)))
      setViewport(
        { x: (width - w * zoom) / 2 - bounds.minX * zoom, y: (height - h * zoom) / 2 - bounds.minY * zoom, zoom },
        { duration },
      )
    },
    [wrapperRef, getViewport, setViewport],
  )

  // Encuadre pendiente (al abrir un proyecto, al cambiar de hoja): se hace cuando React Flow ha
  // medido todos los nodos, no a ciegas tras unos fotogramas (en un equipo lento la tabla podía no
  // estar medida todavía y quedar fuera).
  const nodesInitialized = useNodesInitialized()
  const initializedRef = useRef(nodesInitialized)
  const pending = useRef(0) // duración del encuadre pendiente (null: ninguno); 0 = el inicial
  useEffect(() => {
    initializedRef.current = nodesInitialized
    if (!nodesInitialized || pending.current === null) return
    const duration = pending.current
    pending.current = null
    requestAnimationFrame(() => fitDrawn(duration))
  }, [nodesInitialized, fitDrawn])

  // Pide un encuadre en cuanto todo esté medido (si ya lo está, enseguida). Se mira en cada fotograma
  // y nodo a nodo. isCurrent(nodos): los nodos de React Flow ya son los esperados. Al abrir otro
  // proyecto, setNodes aún no ha llegado a React Flow en los primeros fotogramas: sin esto se
  // encuadraba el proyecto anterior, el encuadre quedaba hecho y, con el equipo cargado, lo nuevo
  // (la tabla de variables) se quedaba fuera de la vista.
  const fitWhenReady = useCallback(
    (duration = 0, isCurrent = null) => {
      pending.current = duration
      const started = performance.now()
      const attempt = () => {
        if (pending.current === null) return // ya encuadrado (por el efecto de arriba)
        const nodes = getNodes()
        const ready = (!isCurrent || isCurrent(nodes)) && nodes.every((n) => n.hidden || (n.measured?.width && n.measured?.height))
        if (!ready && performance.now() - started < 5000) {
          requestAnimationFrame(attempt)
          return
        }
        const d = pending.current
        pending.current = null
        // Un fotograma más: los enlaces y receptividades se dibujan tras medir los nodos.
        requestAnimationFrame(() => fitDrawn(d))
      }
      requestAnimationFrame(attempt)
    },
    [fitDrawn, getNodes],
  )

  // El sitio del lienzo ha cambiado (p. ej. se abre el panel del ejercicio al abrir el proyecto):
  // si hay un encuadre pendiente ya usará el tamaño nuevo; si no, se reencuadra. Sin esto la tabla
  // de variables quedaba debajo del panel, encuadrada con el ancho de antes.
  const refit = useCallback(() => {
    if (pending.current !== null) return
    requestAnimationFrame(() => fitDrawn(0))
  }, [fitDrawn])

  return { fitDrawn, fitWhenReady, refit }
}
