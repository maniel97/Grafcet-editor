import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, ReactFlowProvider, useNodesInitialized, useReactFlow } from '@xyflow/react'
import { nodeTypes } from '../nodes'
import { edgeTypes } from '../edges'
import { defaultEdgeOptions } from '../lib/initialDiagram'
import { EditorProvider } from '../lib/editorContext'
import { crossSheetRefs, sheetsOf, visibleEdges, visibleNodes } from '../lib/sheets'
import { capturePdf } from '../lib/exportImage'
import SheetRefs from './SheetRefs'

const noop = () => {}

// Direcciones en el diagrama, como en el lienzo (hooks/usePlcTable.js), si el proyecto las muestra.
function plcViewOf(project) {
  const { plc } = project
  if (!plc?.showAddresses) return null
  const stepByLabel = new Map(project.nodes.filter((n) => n.type === 'step').map((s) => [String(s.data.label), s.id]))
  return {
    stepAddress: (id) => plc.steps?.[id]?.address,
    lookup: {
      symbol: (name) => plc.variables?.[name]?.address,
      step: (label) => plc.steps?.[stepByLabel.get(label)]?.address,
    },
  }
}

// Una hoja dibujada; al terminar de medir los nodos (y trazar los enlaces), se captura.
function Sheet({ project, sheetId, onCaptured }) {
  const host = useRef(null)
  const ready = useNodesInitialized()
  const { getViewport } = useReactFlow()
  const first = sheetsOf(project.plc)[0].id
  // La tabla de variables no se dibuja: el cuaderno la lleva como tabla en su sección.
  const all = useMemo(() => project.nodes.filter((n) => n.type !== 'variables').map((n) => ({ ...n, selected: false, data: { ...n.data, sheet: n.data?.sheet ?? first } })), [project, first])
  const nodes = useMemo(() => visibleNodes(all, sheetId), [all, sheetId])
  const edges = useMemo(() => visibleEdges(project.edges, all, sheetId).map((e) => ({ ...e, selected: false })), [project, all, sheetId])
  const refs = useMemo(() => crossSheetRefs(all, project.edges, project.plc, sheetId), [all, project, sheetId])
  const done = useRef(false)
  useEffect(() => {
    if ((!ready && nodes.length) || done.current) return
    done.current = true
    let alive = true
    ;(async () => {
      // Tiempo para trazar los enlaces tras medir los nodos (como al capturar todas las hojas).
      await new Promise((resolve) => setTimeout(resolve, 150))
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const image = nodes.length ? await capturePdf(getViewport(), host.current?.querySelector('.react-flow__viewport')) : null
      if (alive) onCaptured(image)
    })()
    return () => {
      alive = false
    }
  }, [ready, nodes.length, getViewport, onCaptured])
  return (
    <div ref={host} className="exporting" style={{ width: 1600, height: 1200 }}>
      <ReactFlow
        defaultNodes={nodes}
        defaultEdges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <SheetRefs refs={refs} nodes={nodes} />
      </ReactFlow>
    </div>
  )
}

// Grafcet de un proyecto que no está abierto en el editor: se dibuja fuera de la pantalla con los
// mismos nodos que el lienzo, hoja a hoja, y se captura como en el dossier.
// onDone([{ dataUrl, width, height, scene, name }]) con una figura por hoja que tenga algo.
export default function OffscreenGrafcet({ project, onDone }) {
  const sheets = useMemo(() => sheetsOf(project.plc), [project])
  const [index, setIndex] = useState(0)
  const shots = useRef([])
  const editor = useMemo(
    () => ({
      takeSnapshot: noop,
      startLoop: noop,
      setPreview: noop,
      editNode: noop,
      setHighlight: noop,
      toggleTable: noop,
      renameEverywhere: noop,
      setEditingNoteId: noop,
      plcView: plcViewOf(project),
      readOnly: true,
      tableLocked: true,
    }),
    [project],
  )
  const sheet = sheets[index]
  const captured = useMemo(
    () => (image) => {
      if (image) shots.current.push({ ...image, name: sheet.name })
      if (index + 1 < sheets.length) setIndex(index + 1)
      else onDone(shots.current)
    },
    [index, sheets, sheet, onDone],
  )
  if (!sheet) return null
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: -30000, top: 0, pointerEvents: 'none' }}>
      <EditorProvider value={editor}>
        <ReactFlowProvider key={sheet.id}>
          <Sheet project={project} sheetId={sheet.id} onCaptured={captured} />
        </ReactFlowProvider>
      </EditorProvider>
    </div>
  )
}
