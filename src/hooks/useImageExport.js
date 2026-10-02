import { useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { capturePdf, download, renderDiagram } from '../lib/exportImage'
import { fileName } from '../lib/fileNames'

// Exportación del diagrama sin la selección (se dibuja en azul) ni el resaltado de la tabla:
// se quitan, se captura y se restaura la selección.
// Devuelve la fuente de exportación del grafcet para el diálogo de exportación.
export function useImageExport(clearHighlight, title) {
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
      // Los textos de ayuda de edición no salen en lo exportado (index.css: .exporting).
      document.documentElement.classList.add('exporting')
      // Espera a que React pinte el lienzo sin selección antes de capturarlo.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      try {
        return await fn(getViewport())
      } finally {
        document.documentElement.classList.remove('exporting')
        if (hadSelection) {
          setNodes((nds) => nds.map((n) => ({ ...n, selected: selectedNodes.has(n.id) })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: selectedEdges.has(e.id) })))
        }
      }
    },
    [getNodes, getEdges, setNodes, setEdges, getViewport, clearHighlight],
  )

  // Fuente para el diálogo de exportación (components/ExportDialog.jsx): captura a 3x (vista
  // previa e impresión) con su escena vectorial, y guardado del PNG o del SVG.
  const source = useMemo(
    () => ({
      kind: 'grafcet',
      title,
      capture: () => withCleanCanvas((viewport) => capturePdf(viewport)),
      save: (format, options) =>
        withCleanCanvas(async (viewport) => {
          const image = await renderDiagram(format, viewport, format === 'png' ? (options.pngScale ?? 2) : 1)
          if (image) download(image.dataUrl, fileName(format))
        }),
    }),
    [withCleanCanvas, title],
  )

  return source
}
