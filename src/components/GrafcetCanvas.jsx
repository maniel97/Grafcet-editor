import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, Background, BackgroundVariant, MiniMap, addEdge, useNodesState, useEdgesState, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Lock } from 'lucide-react'

import Toolbar from './Toolbar'
import PropertiesPanel from './PropertiesPanel'
import VerifyPanel from './VerifyPanel'
import LoopPickerBanner from './LoopPickerBanner'
import GrafcetContextMenu from './GrafcetContextMenu'
import GhostPreview from './GhostPreview'
import CanvasControls from './CanvasControls'
import { nodeTypes } from '../nodes'
import { NOTE_SIZE } from '../lib/notes'
import { edgeTypes } from '../edges'
import { useSimulation } from '../lib/sim/useSimulation'
import { useSettings } from '../lib/settings'
import { initialNodes, initialEdges, defaultEdgeOptions } from '../lib/initialDiagram'
import { saveProject, loadProject, normalizeProject } from '../lib/projectFile'
import { pushRecent } from '../lib/recent'
import { EMPTY_PLC } from '../lib/addressing'
import { nextStepLabel, nextTransitionLabel, findFreePosition } from '../lib/layout'
import { useHistory } from '../lib/history'
import { EditorProvider } from '../lib/editorContext'
import { isValidGrafcetConnection } from '../lib/grafcetRules'
import { loadAutosave, useAutosave } from '../lib/autosave'
import { useEditorShortcuts } from '../lib/shortcuts'
import { normalizeAction } from '../lib/actions'
import { useFitDrawn } from '../hooks/useFitDrawn'
import { usePlcTable } from '../hooks/usePlcTable'
import { useVerification } from '../hooks/useVerification'
import { useClipboard } from '../hooks/useClipboard'
import { useCanvasContextMenu } from '../hooks/useCanvasContextMenu'
import { useImageExport } from '../hooks/useImageExport'

// Partes que no hacen falta al abrir el editor: se descargan la primera vez que se usan, para que
// la carga inicial sea más ligera (importa sobre todo publicado en internet).
const SettingsDialog = lazy(() => import('./SettingsDialog'))
const HelpDialog = lazy(() => import('./HelpDialog'))
const SimulationPanel = lazy(() => import('./SimulationPanel'))
const LadderView = lazy(() => import('./LadderView'))
const VariablesDialog = lazy(() => import('./VariablesDialog'))
const PdfExportDialog = lazy(() => import('./PdfExportDialog'))
const ProjectsDialog = lazy(() => import('./ProjectsDialog'))

// Mientras se descarga una parte diferida (normalmente un instante).
function Loading({ panel }) {
  return panel ? (
    <aside className="flex w-80 shrink-0 items-center justify-center border-l border-slate-200 bg-white text-sm text-slate-400">
      Cargando…
    </aside>
  ) : null
}

const defaultData = {
  step: (nodes) => ({ label: nextStepLabel(nodes), actions: [] }),
  transition: (nodes) => ({ condition: nextTransitionLabel(nodes) }),
  note: () => ({ text: '', color: 'yellow' }),
}

export default function GrafcetCanvas() {
  // --- Estado del diagrama -------------------------------------------------------------------
  // Al abrir se recupera el último trabajo autoguardado; si no hay, se muestra el ejemplo.
  const [restored] = useState(loadAutosave)
  const [nodes, setNodes, onNodesChange] = useNodesState(restored?.nodes ?? initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(restored?.edges ?? initialEdges)
  // Tabla de variables (direcciones de PLC); entra en el historial de deshacer.
  const [plc, setPlc] = useState(restored?.plc ?? EMPTY_PLC)
  const plcRef = useRef(plc)
  useEffect(() => {
    plcRef.current = plc
  }, [plc])
  useAutosave(nodes, edges, plc)
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useHistory({ get: () => plcRef.current, set: setPlc })

  // --- Estado de la interfaz -----------------------------------------------------------------
  const [editingId, setEditingId] = useState(null)
  // Transición desde la que se está creando un bucle (herramienta Bucle activa) o null.
  const [loopSourceId, setLoopSourceId] = useState(null)
  const [variablesOpen, setVariablesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [ladderOpen, setLadderOpen] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)
  // Modo simulación: la edición queda bloqueada y el lienzo muestra la evolución.
  const [simulating, setSimulating] = useState(false)
  // Bloqueo de edición (candado de los controles): solo mirar, desplazar y hacer zoom.
  const [editLocked, setEditLocked] = useState(false)
  // Solo lectura: al simular o con la edición bloqueada.
  const readOnly = simulating || editLocked
  // Conexión que se está arrastrando ({ nodeId, handleType }) o null: los conectores la usan para
  // marcarse como destino válido. Solo cambia al empezar y al terminar la conexión.
  const [connecting, setConnecting] = useState(null)
  // Vista previa de lo que añadiría el "+" flotante bajo el ratón (ver GhostPreview).
  const [preview, setPreview] = useState(null)
  // Nota en edición de texto (ver nodes/NoteNode.jsx) o null.
  const [editingNoteId, setEditingNoteId] = useState(null)

  const { settings, update: updateSettings, reset: resetSettings } = useSettings()
  const { screenToFlowPosition, updateNodeData, toObject, setViewport, fitView, getNode, getNodes, getEdges, deleteElements } =
    useReactFlow()
  const wrapperRef = useRef(null)
  const fileInputRef = useRef(null)

  // --- Piezas ----------------------------------------------------------------------------------
  const simulation = useSimulation(nodes, edges, plc, simulating)
  const fitDrawn = useFitDrawn(wrapperRef)
  const openVariables = useCallback(() => setVariablesOpen(true), [])
  const { symbols, stepNodes, plcIssues, changePlc, tableShown, toggleTable, plcTable, plcView, exportCsv, highlight, setHighlight } =
    usePlcTable({ nodes, plc, setPlc, plcRef, takeSnapshot, onOpenDialog: openVariables })
  const { issues, issueCounts, markedIssues } = useVerification({ nodes, edges, plcIssues, verifyOpen })
  const { copy, paste, duplicate } = useClipboard(takeSnapshot)
  const { menu, setMenu, closeMenu, onNodeContextMenu, onSelectionContextMenu, onPaneContextMenu } = useCanvasContextMenu()
  const clearHighlight = useCallback(() => setHighlight(null), [setHighlight])
  const { exportImage, capturePdfImage } = useImageExport(clearHighlight)
  // PNG y SVG se descargan directamente; PDF abre el diálogo con opciones y vista previa.
  const onExport = useCallback((format) => (format === 'pdf' ? setPdfOpen(true) : exportImage(format)), [exportImage])

  const editingNode = nodes.find((n) => n.id === editingId)
  const selectedStep = nodes.find((n) => n.selected && n.type === 'step')

  const focusIssue = useCallback(
    (issue) => {
      const ids = new Set(issue.nodeIds)
      setNodes((nds) => nds.map((n) => ({ ...n, selected: ids.has(n.id) })))
      fitView({ nodes: issue.nodeIds.map((id) => ({ id })), duration: 400, maxZoom: 1.5, padding: 0.5 })
    },
    [setNodes, fitView],
  )

  const focusNode = useCallback((id) => fitView({ nodes: [{ id }], duration: 400, maxZoom: 1.5, padding: 0.6 }), [fitView])

  // Etapas inmediatamente anteriores a la transición en edición (para sugerir "5s/Xn").
  const previousSteps = useMemo(() => {
    if (editingNode?.type !== 'transition') return []
    return edges
      .filter((e) => e.target === editingId)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n) => n?.type === 'step' && n.data.label)
      .map((n) => n.data.label)
  }, [editingNode, editingId, edges, nodes])

  // --- Conexiones y bucles -----------------------------------------------------------------------
  // Reglas de la norma (alternancia etapa/transición, salida de transición: bucle o etapas).
  const isValidConnection = useCallback(
    (connection) => isValidGrafcetConnection(connection, getNode, getEdges()),
    [getNode, getEdges],
  )

  const onConnect = useCallback(
    (params) => {
      takeSnapshot()
      setEdges((eds) => addEdge(params, eds))
    },
    [takeSnapshot, setEdges],
  )

  // Herramienta Bucle: une la transición origen con la etapa elegida. Si la etapa está por
  // encima, el enlace Grafcet lo dibuja solo como bucle por la izquierda con flecha.
  const finishLoop = useCallback(
    (targetId) => {
      if (!loopSourceId) return
      if (!isValidConnection({ source: loopSourceId, target: targetId })) return
      takeSnapshot()
      setEdges((eds) =>
        addEdge({ ...defaultEdgeOptions, source: loopSourceId, target: targetId, sourceHandle: null, targetHandle: null }, eds),
      )
      setLoopSourceId(null)
    },
    [loopSourceId, isValidConnection, takeSnapshot, setEdges],
  )

  // Lo que los nodos necesitan del editor (ver lib/editorContext.js). Solo debe cambiar cuando
  // cambia algo que los nodos muestran: si cambia, se vuelven a dibujar todos.
  const editorApi = useMemo(
    () => ({
      takeSnapshot,
      startLoop: setLoopSourceId,
      setPreview,
      issuesByNode: markedIssues,
      plcView,
      plcTable,
      highlightIds: highlight,
      setHighlight,
      toggleTable,
      simulating,
      readOnly,
      connecting,
      editingNoteId,
      setEditingNoteId,
      sim: simulating ? simulation.view : null,
    }),
    [takeSnapshot, markedIssues, plcView, plcTable, highlight, setHighlight, toggleTable, simulating, readOnly, connecting, editingNoteId, simulation.view],
  )

  // --- Edición -----------------------------------------------------------------------------------
  // Añade un nodo en `at` (coordenadas del lienzo) o, si no se indica, en el centro de la vista.
  const addNode = useCallback(
    (type, extra = {}, at) => {
      takeSnapshot()
      const rect = wrapperRef.current.getBoundingClientRect()
      const position = at ?? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      const id = crypto.randomUUID()
      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position: findFreePosition(position, type, nds),
          data: { ...defaultData[type](nds), ...extra },
          ...(type === 'note' ? NOTE_SIZE : {}),
        },
      ])
      // Una nota nueva se abre directamente para escribir.
      if (type === 'note') setEditingNoteId(id)
    },
    [takeSnapshot, screenToFlowPosition, setNodes],
  )

  // Añade una acción a la etapa seleccionada y abre su panel para editarla.
  const addAction = useCallback(() => {
    if (!selectedStep) return
    takeSnapshot()
    updateNodeData(selectedStep.id, { actions: [...(selectedStep.data.actions ?? []), normalizeAction('Acción')] })
    setEditingId(selectedStep.id)
  }, [selectedStep, takeSnapshot, updateNodeData])

  // Ediciones desde el panel: lo escrito seguido en un mismo campo cuenta como un solo paso.
  const editNode = useCallback(
    (patch) => {
      takeSnapshot(`edit:${editingId}:${Object.keys(patch).join(',')}`)
      updateNodeData(editingId, patch)
    },
    [editingId, takeSnapshot, updateNodeData],
  )

  const clear = useCallback(() => {
    if (!nodes.length && !edges.length) return
    pushRecent({ nodes: getNodes(), edges: getEdges(), plc: plcRef.current }, 'Antes de limpiar el lienzo')
    takeSnapshot()
    setNodes([])
    setEdges([])
    setEditingId(null)
  }, [nodes.length, edges.length, getNodes, getEdges, takeSnapshot, setNodes, setEdges])

  // --- Archivos ----------------------------------------------------------------------------------
  const save = useCallback(() => saveProject({ ...toObject(), plc }), [toObject, plc])

  // Sustituye el diagrama (abrir archivo, ejemplo o trabajo anterior). Lo que había se guarda
  // antes como trabajo anterior (lib/recent.js) y además se puede deshacer con Ctrl+Z.
  const replaceProject = useCallback(
    (project, reason) => {
      pushRecent({ nodes: getNodes(), edges: getEdges(), plc: plcRef.current }, reason)
      takeSnapshot()
      setNodes(project.nodes)
      setEdges(project.edges)
      setPlc(project.plc ?? EMPTY_PLC)
      setEditingId(null)
      if (project.viewport) setViewport(project.viewport)
      else requestAnimationFrame(() => requestAnimationFrame(() => fitDrawn(0)))
    },
    [getNodes, getEdges, takeSnapshot, setNodes, setEdges, setViewport, fitDrawn],
  )

  const load = useCallback(
    async (file) => {
      try {
        replaceProject(await loadProject(file), `Antes de abrir «${file.name}»`)
      } catch (err) {
        alert(err.message)
      }
    },
    [replaceProject],
  )

  const [projectsTab, setProjectsTab] = useState(null) // 'examples' | 'recent' | null
  const openExample = useCallback(
    (example) => {
      replaceProject(normalizeProject(example.build()), `Antes de abrir el ejemplo «${example.title}»`)
      setProjectsTab(null)
    },
    [replaceProject],
  )
  const restoreRecent = useCallback(
    (entry) => {
      replaceProject(normalizeProject(entry.project), 'Antes de recuperar un trabajo anterior')
      setProjectsTab(null)
    },
    [replaceProject],
  )

  // --- Simulación --------------------------------------------------------------------------------
  // Entrar en simulación: se cierran paneles y menús de edición y se arranca en marcha.
  const startSimulation = useCallback(() => {
    setEditingId(null)
    setLoopSourceId(null)
    setMenu(null)
    setPreview(null)
    setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds))
    setSimulating(true)
    simulation.setPlaying(true)
  }, [setNodes, setMenu, simulation])

  // --- Atajos ------------------------------------------------------------------------------------
  // En solo lectura (simulando o con la edición bloqueada) los atajos de edición no hacen nada.
  const selectedIds = () => getNodes().filter((n) => n.selected).map((n) => ({ id: n.id }))
  useEditorShortcuts({
    undo: () => !readOnly && undo(),
    redo: () => !readOnly && redo(),
    copy,
    cut: () => !readOnly && copy() && deleteElements({ nodes: selectedIds() }),
    paste: () => !readOnly && paste(),
    duplicate: () => !readOnly && duplicate(),
    selectAll: () => !readOnly && setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),
    save,
    open: () => fileInputRef.current?.click(),
    help: () => setHelpOpen(true),
    escape: () => {
      setLoopSourceId(null)
      setEditingId(null)
      setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds))
    },
  })

  const loopSource = loopSourceId ? nodes.find((n) => n.id === loopSourceId) : null
  const initialSteps = nodes.filter((n) => n.type === 'step' && n.data.initial)
  const modalOpen = settingsOpen || helpOpen || variablesOpen || ladderOpen || pdfOpen || !!projectsTab || !!menu
  // En solo lectura el clic derecho no abre menús de edición (ni el del navegador).
  const blockMenu = (handler) => (readOnly ? (e) => e.preventDefault() : handler)

  return (
    <EditorProvider value={editorApi}>
      <div className="flex h-full flex-col">
        <Toolbar
          onAdd={addNode}
          onAddAction={addAction}
          canAddAction={!!selectedStep}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onExport={onExport}
          onSave={save}
          onOpen={() => fileInputRef.current?.click()}
          onOpenExamples={() => setProjectsTab('examples')}
          onOpenRecent={() => setProjectsTab('recent')}
          onClear={clear}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleVerify={() => setVerifyOpen((v) => !v)}
          verifyOpen={verifyOpen}
          issueCounts={issueCounts}
          onHelp={() => setHelpOpen(true)}
          onOpenVariables={() => setVariablesOpen(true)}
          simulating={simulating}
          readOnly={readOnly}
          onToggleSimulation={() => (simulating ? setSimulating(false) : startSimulation())}
          onOpenLadder={() => setLadderOpen(true)}
        />
        {ladderOpen && (
          <Suspense fallback={<Loading />}>
            <LadderView
              nodes={nodes}
              edges={edges}
              plc={plc}
              grafcetErrors={issueCounts.errors}
              onClose={() => setLadderOpen(false)}
            />
          </Suspense>
        )}
        {variablesOpen && (
          <Suspense fallback={<Loading />}>
            <VariablesDialog
              plc={plc}
              stepNodes={stepNodes}
              symbols={symbols}
              issues={plcIssues}
              onChange={changePlc}
              onAutoAssign={plcTable.autoAssign}
              onExportCsv={exportCsv}
              tableShown={tableShown}
              onToggleTable={() => toggleTable()}
              onAddVariable={(type) => plcTable.addVariable(type, { reveal: false })}
              onClose={() => setVariablesOpen(false)}
            />
          </Suspense>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) load(file)
            e.target.value = '' // permite volver a cargar el mismo archivo
          }}
        />
        {settingsOpen && (
          <Suspense fallback={<Loading />}>
            <SettingsDialog
              settings={settings}
              onChange={updateSettings}
              onReset={resetSettings}
              onClose={() => setSettingsOpen(false)}
            />
          </Suspense>
        )}
        {projectsTab && (
          <Suspense fallback={<Loading />}>
            <ProjectsDialog
              initialTab={projectsTab}
              onOpenExample={openExample}
              onRestore={restoreRecent}
              onClose={() => setProjectsTab(null)}
            />
          </Suspense>
        )}
        {pdfOpen && (
          <Suspense fallback={<Loading />}>
            <PdfExportDialog capture={capturePdfImage} onClose={() => setPdfOpen(false)} />
          </Suspense>
        )}
        {helpOpen && (
          <Suspense fallback={<Loading />}>
            <HelpDialog onClose={() => setHelpOpen(false)} />
          </Suspense>
        )}
        <div className="flex min-h-0 flex-1">
          <div ref={wrapperRef} className={`relative flex-1 ${loopSource ? 'loop-picking' : ''} ${readOnly ? 'read-only' : ''}`}>
            {editLocked && !simulating && (
              <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 shadow">
                <Lock size={14} /> Edición bloqueada: solo puedes desplazarte y hacer zoom
                <button
                  type="button"
                  onClick={() => setEditLocked(false)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-amber-100"
                >
                  Desbloquear
                </button>
              </div>
            )}
            {loopSource && (
              <LoopPickerBanner
                source={loopSource}
                initialSteps={initialSteps}
                onPick={finishLoop}
                onCancel={() => setLoopSourceId(null)}
              />
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onConnectStart={(_, { nodeId, handleType }) => setConnecting({ nodeId, handleType })}
              onConnectEnd={() => setConnecting(null)}
              onNodeDragStart={() => takeSnapshot()}
              onSelectionDragStart={() => takeSnapshot()}
              onBeforeDelete={async () => {
                takeSnapshot()
                return true
              }}
              onNodeContextMenu={blockMenu(onNodeContextMenu)}
              onSelectionContextMenu={blockMenu(onSelectionContextMenu)}
              onPaneContextMenu={blockMenu(onPaneContextMenu)}
              onMoveStart={closeMenu}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              elementsSelectable={!readOnly}
              onNodeClick={(_, node) => loopSource && node.type === 'step' && finishLoop(node.id)}
              onNodeDoubleClick={(_, node) => {
                if (loopSource || readOnly) return
                if (node.type === 'variables') setVariablesOpen(true)
                else if (node.type === 'note') setEditingNoteId(node.id)
                else setEditingId(node.id)
              }}
              onPaneClick={() => {
                setEditingId(null)
                setLoopSourceId(null)
              }}
              zoomOnDoubleClick={false}
              snapToGrid
              snapGrid={[10, 10]}
              // Con un diálogo o menú abierto, Supr/Retroceso no deben borrar nodos del lienzo de fondo.
              deleteKeyCode={modalOpen || readOnly ? null : ['Delete', 'Backspace']}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <CanvasControls
                onFitView={fitDrawn}
                locked={readOnly}
                onToggleLock={() => setEditLocked((l) => !l)}
                lockDisabled={simulating}
              />
              <MiniMap pannable zoomable ariaLabel="Minimapa" />
              <GhostPreview preview={preview} />
            </ReactFlow>
            {menu && (
              <GrafcetContextMenu menu={menu} onClose={closeMenu} onEdit={setEditingId} onAddNodeAt={addNode} />
            )}
          </div>
          {simulating ? (
            <Suspense fallback={<Loading panel />}>
              <SimulationPanel simulation={simulation} onFocusNode={focusNode} onClose={() => setSimulating(false)} />
            </Suspense>
          ) : (
            <>
              <PropertiesPanel
                node={editingNode}
                onChange={editNode}
                onClose={() => setEditingId(null)}
                previousSteps={previousSteps}
              />
              {verifyOpen && <VerifyPanel issues={issues} onFocus={focusIssue} onClose={() => setVerifyOpen(false)} />}
            </>
          )}
        </div>
      </div>
    </EditorProvider>
  )
}
