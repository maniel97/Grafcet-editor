import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { capturePdf, exportDiagram } from '../lib/exportImage'

// Exportación del diagrama sin la selección (se dibuja en azul) ni el resaltado de la tabla:
// se quitan, se captura y se restaura la selección.
// - exportImage('png' | 'svg'): descarga directa.
// - capturePdfImage(): imagen a alta resolución y escena vectorial para el diálogo de PDF.
export function useImageExport(clearHighlight) {
  const { getNodes, getEdges, setNodes, setEdges, getViewport } = useReactFlow()

  const withCleanCanvas = useCallback(
    async (fn) => {
      const selectedNodes = new Set(getNodes().filter((n) => n.selected).map((n) => n.id))
      const selectedEdges = new Set(getEdges().filter((e) => e.selected).map((e) => e.id))
      const hadSelection = selectedNodes.size || selectedEdges.size
      if (hadSelection) {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
      }
      clearHighlight()
      // Espera a que React pinte el lienzo sin selección antes de capturarlo.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      try {
        return await fn(getViewport())
      } finally {
        if (hadSelection) {
          setNodes((nds) => nds.map((n) => ({ ...n, selected: selectedNodes.has(n.id) })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: selectedEdges.has(e.id) })))
        }
      }
    },
    [getNodes, getEdges, setNodes, setEdges, getViewport, clearHighlight],
  )

  const exportImage = useCallback(
    async (format) => {
      try {
        await withCleanCanvas((viewport) => exportDiagram(format, viewport))
      } catch (err) {
        alert(`No se pudo exportar: ${err.message}`)
      }
    },
    [withCleanCanvas],
  )

  // 3x: resolución de impresión.
  const capturePdfImage = useCallback(() => withCleanCanvas((viewport) => capturePdf(viewport)), [withCleanCanvas])

  return { exportImage, capturePdfImage }
}
