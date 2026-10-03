import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { capturePdf, download, renderDiagram } from '../lib/exportImage'
import { fileName } from '../lib/fileNames'

// Exportación del diagrama sin la selección (se dibuja en azul), sin el resaltado de la tabla y
// sin los textos de ayuda de edición (index.css: .exporting): se quitan, se captura y se
// restaura. Las capturas pueden solaparse (p. ej. React monta dos veces el diálogo en desarrollo):
// el estado limpio lo prepara la primera y lo deshace la última.
let exporting = 0 // capturas en curso
let savedSelection = null // { nodes: Set, edges: Set } de antes de la primera

// Devuelve la fuente de exportación del grafcet para el diálogo de exportación.
// sheets: { list, current, show(id) } para exportar todas las hojas en un PDF.
export function useImageExport(clearHighlight, title, sheets) {
  const { getNodes, getEdges, setNodes, setEdges, getViewport } = useReactFlow()
  // Las hojas se leen al exportar (ref): si la fuente cambiara al cambiar de hoja durante la
  // captura de todas, el diálogo volvería a capturar sin fin.
  const sheetsRef = useRef(sheets)
  useEffect(() => {
    sheetsRef.current = sheets
  })
  const multiSheet = (sheets?.list.length ?? 0) > 1

  const withCleanCanvas = useCallback(
    async (fn) => {
      if (exporting++ === 0) {
        savedSelection = {
          nodes: new Set(getNodes().filter((n) => n.selected).map((n) => n.id)),
          edges: new Set(getEdges().filter((e) => e.selected).map((e) => e.id)),
        }
        if (savedSelection.nodes.size || savedSelection.edges.size) {
          setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
          setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
        }
        clearHighlight()
        document.documentElement.classList.add('exporting')
      }
      // Espera a que React pinte el lienzo limpio antes de capturarlo.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      try {
        return await fn(getViewport())
      } finally {
        if (--exporting === 0) {
          document.documentElement.classList.remove('exporting')
          const { nodes, edges } = savedSelection
          savedSelection = null
          if (nodes.size || edges.size) {
            setNodes((nds) => nds.map((n) => ({ ...n, selected: nodes.has(n.id) })))
            setEdges((eds) => eds.map((e) => ({ ...e, selected: edges.has(e.id) })))
          }
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
      // Todas las hojas: se muestra cada una, se captura y se vuelve a la que estaba.
      captureAll:
        multiSheet
          ? () =>
              withCleanCanvas(async () => {
                const sheets = sheetsRef.current
                const out = []
                try {
                  for (const s of sheets.list) {
                    sheets.show(s.id)
                    // Tiempo para dibujar y medir la hoja (y trazar sus enlaces).
                    await new Promise((resolve) => setTimeout(resolve, 150))
                    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
                    const image = await capturePdf(getViewport())
                    if (image) out.push({ ...image, sheetName: s.name })
                  }
                } finally {
                  sheets.show(sheets.current)
                }
                return out
              })
          : null,
      save: (format, options) =>
        withCleanCanvas(async (viewport) => {
          const image = await renderDiagram(format, viewport, format === 'png' ? (options.pngScale ?? 2) : 1)
          if (image) download(image.dataUrl, fileName(format))
        }),
    }),
    [withCleanCanvas, title, multiSheet, getViewport],
  )

  return source
}
