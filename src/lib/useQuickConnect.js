import { useCallback } from 'react'
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { nextStepLabel, nextTransitionLabel, positionBelow } from './layout'
import { useEditor } from './editorContext'
import { transitionOutput } from './grafcetRules'
import { defaultEdgeOptions } from './initialDiagram'

// Qué crearía el "+" bajo `source` y dónde. Lo usan tanto la creación real como su vista previa,
// para que lo previsualizado coincida exactamente con lo que se añade.
export function planQuickConnect(source, nodes) {
  const type = source.type === 'step' ? 'transition' : 'step'
  const data =
    type === 'transition' ? { condition: nextTransitionLabel(nodes) } : { label: nextStepLabel(nodes), actions: [] }
  return { type, data, position: positionBelow(source, type, nodes) }
}

// Crea bajo el nodo `sourceId` el siguiente elemento de la secuencia Grafcet
// (etapa -> transición -> etapa...), lo conecta, lo selecciona y lo mantiene a la vista.
export function useQuickConnect() {
  const { getNodes, getNode, getEdges, setNodes, addEdges, getViewport, setCenter } = useReactFlow()
  const store = useStoreApi()
  const { takeSnapshot } = useEditor()

  return useCallback(
    (sourceId) => {
      const source = getNode(sourceId)
      if (!source) return
      // Una transición que ya hace bucle no admite etapas debajo (ver lib/grafcetRules.js).
      if (source.type === 'transition' && transitionOutput(sourceId, getEdges(), (id) => getNode(id)?.position.y) === 'loop')
        return
      takeSnapshot()
      const { type, data, position } = planQuickConnect(source, getNodes())
      const id = crypto.randomUUID()

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { id, type, position, data, selected: true }])
      addEdges({ ...defaultEdgeOptions, id: `e-${sourceId}-${id}`, source: sourceId, target: id })

      // Si el nodo nuevo queda fuera de la vista, desplaza el lienzo para seguirlo.
      const { width, height } = store.getState()
      const { x, y, zoom } = getViewport()
      const sx = position.x * zoom + x
      const sy = position.y * zoom + y
      if (sx < 0 || sy < 0 || sx + 200 * zoom > width || sy + 100 * zoom > height) {
        setCenter(position.x + 28, position.y + 28, { zoom, duration: 300 })
      }
    },
    [getNode, getNodes, getEdges, setNodes, addEdges, getViewport, setCenter, store, takeSnapshot],
  )
}
