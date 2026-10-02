import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { exportDiagram, exportPdf } from '../lib/exportImage'

// Exporta el diagrama (PNG, SVG, PDF) sin la selección (se dibuja en azul) ni el resaltado de
// la tabla; después restaura la selección.
export function useImageExport(clearHighlight) {
  const { getNodes, getEdges, setNodes, setEdges, getViewport } = useReactFlow()

  return useCallback(
    async (format) => {
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
        if (format === 'pdf') await exportPdf(getViewport())
        else await exportDiagram(format, getViewport())
      } catch (err) {
        alert(`No se pudo exportar: ${err.message}`)
      } finally {
        if (hadSelection) {
          setNodes((nds) => nds.map((n) => ({ ...n, selected: selectedNodes.has(n.id) })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: selectedEdges.has(e.id) })))
        }
      }
    },
    [getNodes, getEdges, setNodes, setEdges, getViewport, clearHighlight],
  )
}
