import { useCallback, useState } from 'react'
import { useReactFlow } from '@xyflow/react'

// Estado del menú contextual (clic derecho) y sus manejadores para React Flow.
// menu: { x, y, kind: 'node' | 'selection' | 'pane' | 'edge', nodeIds, edgeId, flowPosition } o null.
export function useCanvasContextMenu() {
  const { getNodes, setNodes, screenToFlowPosition } = useReactFlow()
  const [menu, setMenu] = useState(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const onNodeContextMenu = useCallback(
    (e, node) => {
      e.preventDefault()
      const selected = getNodes().filter((n) => n.selected)
      // Clic derecho sobre un nodo de una selección múltiple: el menú actúa sobre toda la selección.
      if (node.selected && selected.length > 1) {
        setMenu({ x: e.clientX, y: e.clientY, kind: 'selection', nodeIds: selected.map((n) => n.id) })
        return
      }
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })))
      setMenu({ x: e.clientX, y: e.clientY, kind: 'node', nodeIds: [node.id] })
    },
    [getNodes, setNodes],
  )

  const onSelectionContextMenu = useCallback((e, selectedNodes) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, kind: 'selection', nodeIds: selectedNodes.map((n) => n.id) })
  }, [])

  const onPaneContextMenu = useCallback(
    (e) => {
      e.preventDefault()
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setMenu({ x: e.clientX, y: e.clientY, kind: 'pane', flowPosition })
    },
    [screenToFlowPosition],
  )

  const onEdgeContextMenu = useCallback((e, edge) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, kind: 'edge', edgeId: edge.id })
  }, [])

  return { menu, setMenu, closeMenu, onNodeContextMenu, onSelectionContextMenu, onPaneContextMenu, onEdgeContextMenu }
}
