import { useCallback, useEffect, useRef } from 'react'

const LONG_PRESS_MS = 550
const MOVE_TOLERANCE = 10 // px que puede moverse el dedo sin cancelar la pulsación larga
const DOUBLE_TAP_MS = 350

// Gestos táctiles que sustituyen a los del ratón (en pantallas táctiles no hay clic derecho y el
// doble toque no siempre llega como doble clic):
// - pulsación larga -> evento "contextmenu" en el punto pulsado: abre el mismo menú contextual
//   que el clic derecho. Si el navegador ya lo dispara solo (Chrome en Android), no se duplica.
// - doble toque sobre un nodo -> lo mismo que el doble clic (devuelve isDoubleTap para onNodeClick).
export function useTouchGestures(containerRef) {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let press = null

    const cancel = () => {
      if (press) clearTimeout(press.timer)
      press = null
    }
    const onDown = (e) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return
      cancel()
      const { clientX, clientY, target } = e
      press = {
        x: clientX,
        y: clientY,
        nativeMenu: false,
        timer: setTimeout(() => {
          if (!press || press.nativeMenu) return
          target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX, clientY, button: 2 }))
          press = null
        }, LONG_PRESS_MS),
      }
    }
    const onMove = (e) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancel()
    }
    // Menú contextual nativo durante la pulsación (Android): no se dispara el nuestro.
    const onNativeMenu = (e) => {
      if (press && e.isTrusted) press.nativeMenu = true
    }

    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('pointermove', onMove, true)
    el.addEventListener('pointerup', cancel, true)
    el.addEventListener('pointercancel', cancel, true)
    el.addEventListener('contextmenu', onNativeMenu, true)
    return () => {
      cancel()
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('pointermove', onMove, true)
      el.removeEventListener('pointerup', cancel, true)
      el.removeEventListener('pointercancel', cancel, true)
      el.removeEventListener('contextmenu', onNativeMenu, true)
    }
  }, [containerRef])

  // Doble toque sobre el mismo nodo.
  const lastTap = useRef(null)
  const isDoubleTap = useCallback((event, nodeId) => {
    if (event.nativeEvent?.pointerType !== 'touch') return false
    const now = Date.now()
    const double = lastTap.current?.id === nodeId && now - lastTap.current.time < DOUBLE_TAP_MS
    lastTap.current = double ? null : { id: nodeId, time: now }
    return double
  }, [])

  return { isDoubleTap }
}
