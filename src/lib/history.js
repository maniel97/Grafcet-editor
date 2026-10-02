import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'

const MAX_HISTORY = 100
// Cambios con la misma clave seguidos (p. ej. escribir en un campo) se agrupan en un solo paso.
const COALESCE_MS = 1000

// Historial deshacer/rehacer basado en instantáneas de nodos y conexiones, más un estado
// adicional opcional (`extra`: { get, set }, p. ej. la tabla de variables).
// Hay que llamar a takeSnapshot() justo ANTES de cada cambio que se quiera poder deshacer.
export function useHistory(extra) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow()
  const [past, setPast] = useState([])
  const [future, setFuture] = useState([])
  const lastChange = useRef(null)
  const extraRef = useRef(extra)
  useEffect(() => {
    extraRef.current = extra
  })

  const current = useCallback(
    () => ({ nodes: getNodes(), edges: getEdges(), extra: extraRef.current?.get() }),
    [getNodes, getEdges],
  )

  const takeSnapshot = useCallback(
    (coalesceKey) => {
      const now = Date.now()
      const last = lastChange.current
      lastChange.current = coalesceKey ? { key: coalesceKey, time: now } : null
      if (coalesceKey && last?.key === coalesceKey && now - last.time < COALESCE_MS) return

      setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), current()])
      setFuture([])
    },
    [current],
  )

  const restore = useCallback(
    (snapshot) => {
      setNodes(snapshot.nodes)
      setEdges(snapshot.edges)
      if (snapshot.extra !== undefined) extraRef.current?.set(snapshot.extra)
      lastChange.current = null
    },
    [setNodes, setEdges],
  )

  const undo = useCallback(() => {
    if (!past.length) return
    setPast(past.slice(0, -1))
    setFuture((f) => [...f, current()])
    restore(past[past.length - 1])
  }, [past, current, restore])

  const redo = useCallback(() => {
    if (!future.length) return
    setFuture(future.slice(0, -1))
    setPast((p) => [...p, current()])
    restore(future[future.length - 1])
  }, [future, current, restore])

  return { takeSnapshot, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 }
}
// Los atajos Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y están en lib/shortcuts.js.
