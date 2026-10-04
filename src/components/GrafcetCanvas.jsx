import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlow, Background, BackgroundVariant, MiniMap, addEdge, useNodesInitialized, useNodesState, useEdgesState, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Compass, Lock } from 'lucide-react'

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
import { explainTransition } from '../lib/sim/explain'
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
import { measureBoxes, spreadFactor, spreadNodes } from '../lib/spread'
import { useFitDrawn } from '../hooks/useFitDrawn'
import { usePlcTable } from '../hooks/usePlcTable'
import { useVerification } from '../hooks/useVerification'
import { useClipboard } from '../hooks/useClipboard'
import { useCanvasContextMenu } from '../hooks/useCanvasContextMenu'
import { useImageExport } from '../hooks/useImageExport'
import { useTouchGestures } from '../hooks/useTouchGestures'
import { fileName, setProjectName } from '../lib/fileNames'
import { neighbor } from '../lib/keyboardNav'
import { FRAME_SIZE, frameAround, frameOf, membersOf, nextFrameName } from '../lib/frames'
import { isValidName, renameVariable, renumberStep } from '../lib/rename'
import SearchBar from './SearchBar'
import SheetTabs from './SheetTabs'
import SheetRefs from './SheetRefs'
import { crossSheetRefs, sheetOf, sheetsOf, visibleEdges, visibleNodes } from '../lib/sheets'
import { EMPTY_GEMMA, generateConduction } from '../lib/gemma'
import { clearSharedHash, decodeProject, sharedData } from '../lib/share'
import { applySymbols } from '../lib/plc/symbolTable'
import { buildPlcModel } from '../lib/plcModel'
import { t } from '../lib/i18n'
import { FIRST_TOUR, markTourSeen, tourSeen } from '../lib/tours'

// Partes que no hacen falta al abrir el editor: se descargan la primera vez que se usan, para que
// la carga inicial sea más ligera (importa sobre todo publicado en internet).
const SettingsDialog = lazy(() => import('./SettingsDialog'))
const HelpDialog = lazy(() => import('./HelpDialog'))
const Tour = lazy(() => import('./Tour'))
const SimulationPanel = lazy(() => import('./SimulationPanel'))
const SceneView = lazy(() => import('./SceneView'))
const ElectricalView = lazy(() => import('./elec/ElectricalView'))
const LadderView = lazy(() => import('./LadderView'))
const VariablesDialog = lazy(() => import('./VariablesDialog'))
const ExportDialog = lazy(() => import('./ExportDialog'))
const GemmaDialog = lazy(() => import('./GemmaDialog'))
const PneumaticDialog = lazy(() => import('./PneumaticDialog'))
const NewProjectDialog = lazy(() => import('./NewProjectDialog'))
const DossierDialog = lazy(() => import('./DossierDialog'))
const ShareDialog = lazy(() => import('./ShareDialog'))
// Lo que va en el enlace: sin la selección ni el estado de arrastre.
const stripForShare = ({ nodes, edges }) => ({
  nodes: nodes.map(({ selected: _s, dragging: _d, measured: _m, ...n }) => n),
  edges: edges.map(({ selected: _s, ...e }) => e),
})
const ProjectsDialog = lazy(() => import('./ProjectsDialog'))

// Mientras se descarga una parte diferida (normalmente un instante).
function Loading({ panel }) {
  return panel ? (
    <aside className="side-panel flex w-80 shrink-0 items-center justify-center border-l border-slate-200 bg-white text-sm text-slate-400">
      {t('Cargando…')}
    </aside>
  ) : null
}

const defaultData = {
  step: (nodes) => ({ label: nextStepLabel(nodes), actions: [] }),
  transition: (nodes) => ({ condition: nextTransitionLabel(nodes) }),
  note: () => ({ text: '', color: 'yellow' }),
  frame: () => ({ kind: 'grafcet' }),
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
  // Nombre del proyecto: da nombre a los archivos guardados y exportados y al pie del PDF.
  const [projectName, setProjectNameState] = useState(restored?.name ?? '')
  const projectNameRef = useRef(projectName)
  useEffect(() => {
    projectNameRef.current = projectName
    setProjectName(projectName)
    document.title = projectName ? `${projectName} · Grafcet Editor` : 'Grafcet Editor'
  }, [projectName])
  useAutosave(nodes, edges, plc, projectName)
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useHistory({ get: () => plcRef.current, set: setPlc })

  // --- Estado de la interfaz -----------------------------------------------------------------
  const [editingId, setEditingId] = useState(null)
  // Transición desde la que se está creando un bucle (herramienta Bucle activa) o null.
  const [loopSourceId, setLoopSourceId] = useState(null)
  const [variablesOpen, setVariablesOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  // Visita guiada (lib/tours.js): la de bienvenida se ofrece la primera vez.
  const [tour, setTour] = useState(null)
  const [offerTour, setOfferTour] = useState(() => !tourSeen())
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [ladderOpen, setLadderOpen] = useState(false)
  // Escena de la planta durante la simulación: null | 'split' (junto al grafcet) | 'full'.
  const [sceneView, setSceneView] = useState(null)
  // Historial de la escena en modo Editar: entonces deshacer / rehacer (botones y atajos) van a ella.
  const [sceneHistory, setSceneHistory] = useState(null)
  // Elemento del grafcet cuyos segmentos se resaltan en el ladder («Ver en el ladder»).
  const [ladderFocus, setLadderFocus] = useState(null)
  const [gemmaOpen, setGemmaOpen] = useState(false)
  const [pneumaticOpen, setPneumaticOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  // Hojas (lib/sheets.js): la activa es la que se dibuja.
  const [currentSheet, setCurrentSheet] = useState(() => sheetsOf(restored?.plc ?? EMPTY_PLC)[0].id)
  const [exportFormat, setExportFormat] = useState(null) // diálogo de exportación abierto en ese formato
  // Modo simulación: la edición queda bloqueada y el lienzo muestra la evolución.
  const [simulating, setSimulating] = useState(false)
  // Esquema eléctrico (components/elec): panel junto al lienzo, también sin simular.
  const [elecView, setElecView] = useState(null) // null | 'split' | 'full'
  const [elecHistory, setElecHistory] = useState(null)
  // Panel que se tocó por última vez: a él van deshacer/rehacer/copiar/pegar de la barra.
  const [lastPanel, setLastPanel] = useState(null)
  // Cajetín del esquema eléctrico: los mismos datos que el del PDF (la fecha, la de hoy si no hay).
  const [today] = useState(() => new Date().toLocaleDateString('es-ES'))
  const elecTitle = useMemo(
    () => ({
      project: projectName,
      author: plc.titleBlock?.author ?? '',
      company: plc.titleBlock?.company ?? '',
      date: plc.titleBlock?.date || today,
    }),
    [projectName, plc.titleBlock, today],
  )
  const activeSceneHistory = lastPanel === 'elec' && elecView && elecHistory ? elecHistory : simulating && sceneView ? sceneHistory : null
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
  const {
    screenToFlowPosition,
    flowToScreenPosition,
    updateNodeData,
    toObject,
    setViewport,
    setCenter,
    getZoom,
    fitView,
    getNode,
    getNodes,
    getEdges,
    deleteElements,
  } = useReactFlow()
  const wrapperRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastNudgeRef = useRef(0)

  // --- Piezas ----------------------------------------------------------------------------------
  const simulation = useSimulation(nodes, edges, plc, simulating)
  // «¿Por qué no avanza?»: función estable que lee el estado más reciente (la tarjeta se refresca sola).
  const simulationRef = useRef(simulation)
  useEffect(() => {
    simulationRef.current = simulation
  })
  const explainNow = useCallback((id) => {
    const { compiled, sim } = simulationRef.current
    return compiled && sim ? explainTransition(compiled, sim, id) : null
  }, [])
  const { fitDrawn, fitWhenReady } = useFitDrawn(wrapperRef)

  // Ejemplos (data.autoPlace = 'spread' en su tabla de variables): primero se separan las columnas
  // si algún texto pisa lo que tiene a su derecha (depende de la letra y el tamaño; lib/spread).
  const nodesInitialized = useNodesInitialized()
  useEffect(() => {
    if (!nodesInitialized) return
    const table = nodes.find((n) => n.data?.autoPlace === 'spread')
    if (!table) return
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const boxes = measureBoxes(nodes, screenToFlowPosition, wrapperRef.current ?? document)
        const factor = spreadFactor(boxes)
        setNodes((nds) =>
          spreadNodes(nds, boxes, factor).map((n) => (n.id === table.id ? { ...n, data: { ...n.data, autoPlace: 'left' } } : n)),
        )
      }),
    )
    return () => cancelAnimationFrame(frame)
  }, [nodesInitialized, nodes, setNodes, screenToFlowPosition])

  // Tabla de variables de los ejemplos (data.autoPlace = 'left'): se coloca a la izquierda de todo
  // lo dibujado una vez medida, con su ancho real (depende de la letra, el tamaño y los comentarios)
  // y contando los bucles de retorno, que se dibujan a la izquierda de las etapas.
  useEffect(() => {
    if (!nodesInitialized) return
    const table = nodes.find((n) => n.data?.autoPlace === 'left' && n.measured?.width)
    if (!table) return
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const others = nodes.filter((n) => n.id !== table.id && !n.hidden)
        let left = Math.min(...others.map((n) => n.position.x))
        const top = Math.min(...others.filter((n) => n.type !== 'note').map((n) => n.position.y))
        // Los enlaces (bucles incluidos), en coordenadas del lienzo.
        for (const path of wrapperRef.current?.querySelectorAll('.react-flow__edge path') ?? []) {
          try {
            left = Math.min(left, path.getBBox().x)
          } catch {
            /* sin medida */
          }
        }
        const x = Math.round(left - 50 - table.measured.width)
        setNodes((nds) => nds.map((n) => (n.id === table.id ? { ...n, position: { x, y: Number.isFinite(top) ? top : n.position.y }, data: { ...n.data, autoPlace: undefined } } : n)))
        fitWhenReady(0)
      }),
    )
    return () => cancelAnimationFrame(frame)
  }, [nodesInitialized, nodes, setNodes, fitWhenReady])
  const openVariables = useCallback(() => setVariablesOpen(true), [])
  const { symbols, stepNodes, plcIssues, changePlc, tableShown, toggleTable, plcTable, plcView, exportCsv, highlight, setHighlight } =
    usePlcTable({ nodes, plc, setPlc, plcRef, takeSnapshot, onOpenDialog: openVariables })
  const { issues, issueCounts, markedIssues } = useVerification({ nodes, edges, plc, plcIssues, verifyOpen })
  const { copy, paste, duplicate } = useClipboard(takeSnapshot)
  const { menu, setMenu, closeMenu, onNodeContextMenu, onSelectionContextMenu, onPaneContextMenu, onEdgeContextMenu } =
    useCanvasContextMenu()
  const clearHighlight = useCallback(() => setHighlight(null), [setHighlight])
  const sheetsForExport = useMemo(() => ({ list: sheetsOf(plc), current: currentSheet, show: setCurrentSheet }), [plc, currentSheet])
  const exportSource = useImageExport(clearHighlight, projectName.trim() || 'Grafcet (IEC 60848)', sheetsForExport)
  // Pantallas táctiles: pulsación larga = menú contextual; doble toque = editar.
  const { isDoubleTap } = useTouchGestures(wrapperRef)

  // Doble clic (o doble toque) sobre un nodo: editarlo según su tipo.
  const openNodeEditor = (node) => {
    if (loopSourceId || readOnly) return
    if (node.type === 'variables') setVariablesOpen(true)
    else if (node.type === 'note') setEditingNoteId(node.id)
    else setEditingId(node.id)
  }
  // PNG y SVG se descargan directamente; PDF abre el diálogo con opciones y vista previa.
  const onExport = useCallback((format) => setExportFormat(format), [])
  // Cajetín del PDF: sus datos van en el proyecto (lib/titleBlock.js); lo comparten los diálogos
  // de exportación del grafcet, del ladder y del cronograma.
  const titleBlockProps = {
    titleBlock: plc.titleBlock ?? {},
    onTitleBlockChange: (titleBlock) => setPlc((p) => ({ ...p, titleBlock })),
    projectName,
  }

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

  // Vocabulario para autocompletar en el panel: variables y etapas (X3). `here`: la variable solo
  // aparece en el elemento que se edita (puede ser lo que se está escribiendo ahora mismo).
  const vocabulary = useMemo(() => {
    if (!editingId) return []
    const vars = [...symbols].map(([name, found]) => ({
      name,
      type: plc.variables[name]?.type ?? found.type,
      here: ![...found.uses].some((id) => id !== editingId) && !plc.variables[name],
    }))
    const steps = nodes.filter((n) => n.type === 'step' && n.data.label).map((n) => ({ name: `X${t(n.data.label)}`, type: 'step' }))
    return [...vars, ...steps]
  }, [editingId, symbols, plc.variables, nodes])

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
  // Renombrar una variable en todo el diagrama (renameVar, más abajo), para la tabla del lienzo.
  const renameVarRef = useRef(null)
  const renameEverywhere = useCallback((from, to) => renameVarRef.current?.(from, to) ?? null, [])
  const editorApi = useMemo(
    () => ({
      takeSnapshot,
      renameEverywhere,
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
      explainTransition: simulating ? explainNow : null,
    }),
    [takeSnapshot, renameEverywhere, markedIssues, plcView, plcTable, highlight, setHighlight, toggleTable, simulating, readOnly, connecting, editingNoteId, simulation.view, explainNow],
  )

  // --- Edición -----------------------------------------------------------------------------------
  // Añade un nodo en `at` (coordenadas del lienzo) o, si no se indica, en el centro de la vista.
  const addNode = useCallback(
    (type, extra = {}, at) => {
      takeSnapshot()
      const rect = wrapperRef.current.getBoundingClientRect()
      const position = at ?? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      const id = crypto.randomUUID()
      setNodes((nds) => {
        const data = { ...defaultData[type](nds), ...extra }
        // Marco: sin buscar hueco (rodea a otros nodos), con nombre libre y detrás de todo.
        if (type === 'frame') {
          return [...nds, { id, type, position, data: { ...data, name: nextFrameName(data.kind, nds) }, ...FRAME_SIZE, zIndex: -1 }]
        }
        return [...nds, { id, type, position: findFreePosition(position, type, nds), data, ...(type === 'note' ? NOTE_SIZE : {}) }]
      })
      // Una nota nueva se abre directamente para escribir.
      if (type === 'note') setEditingNoteId(id)
    },
    [takeSnapshot, screenToFlowPosition, setNodes],
  )

  // --- Hojas ----------------------------------------------------------------------------------
  const sheets = sheetsOf(plc)
  const shownNodes = useMemo(() => visibleNodes(nodes, currentSheet), [nodes, currentSheet])
  const shownEdges = useMemo(() => visibleEdges(edges, nodes, currentSheet), [edges, nodes, currentSheet])
  const sheetRefs = useMemo(() => crossSheetRefs(nodes, edges, plc, currentSheet), [nodes, edges, plc, currentSheet])
  const sheetCounts = useMemo(() => {
    const counts = new Map()
    for (const n of nodes) counts.set(sheetOf(n, currentSheet), (counts.get(sheetOf(n, currentSheet)) ?? 0) + 1)
    return counts
  }, [nodes, currentSheet])
  // Lo recién creado, pegado o abierto sin hoja pasa a la hoja activa.
  useEffect(() => {
    if (nodes.some((n) => !n.data?.sheet)) setNodes((nds) => nds.map((n) => (n.data?.sheet ? n : { ...n, data: { ...n.data, sheet: currentSheet } })))
  }, [nodes, currentSheet, setNodes])
  const selectSheet = useCallback(
    (id) => {
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, selected: false } : n)))
      setEditingId(null)
      setCurrentSheet(id)
      fitWhenReady(200)
    },
    [setNodes, fitWhenReady],
  )
  const addSheet = useCallback(() => {
    const list = sheetsOf(plcRef.current)
    let n = list.length + 1
    while (list.some((s) => s.name === t('Hoja {n}', { n }))) n++
    const sheet = { id: crypto.randomUUID(), name: t('Hoja {n}', { n }) }
    setPlc((p) => ({ ...p, sheets: [...sheetsOf(p), sheet] }))
    selectSheet(sheet.id)
  }, [setPlc, selectSheet])
  const deleteSheet = useCallback(
    (id) => {
      const inside = getNodes().filter((n) => n.data?.sheet === id)
      const name = sheetsOf(plcRef.current).find((s) => s.id === id)?.name
      if (inside.length && !window.confirm(t('¿Borrar «{nombre}» y sus {n} elementos?', { nombre: name, n: inside.length }))) return
      takeSnapshot()
      const gone = new Set(inside.map((n) => n.id))
      setNodes((nds) => nds.filter((n) => !gone.has(n.id)))
      setEdges((eds) => eds.filter((e) => !gone.has(e.source) && !gone.has(e.target)))
      const rest = sheetsOf(plcRef.current).filter((s) => s.id !== id)
      setPlc((p) => ({ ...p, sheets: rest }))
      if (id === currentSheet) selectSheet(rest[0].id)
    },
    [getNodes, takeSnapshot, setNodes, setEdges, setPlc, currentSheet, selectSheet],
  )
  // Mover la selección a otra hoja (sus enlaces con lo que se queda pasan a ser referencias).
  const moveToSheet = useCallback(
    (nodeIds, sheet) => {
      const ids = new Set(nodeIds)
      takeSnapshot()
      setNodes((nds) => nds.map((n) => (ids.has(n.id) ? { ...n, selected: false, data: { ...n.data, sheet } } : n)))
    },
    [takeSnapshot, setNodes],
  )

  // --- GEMMA ----------------------------------------------------------------------------------
  // Genera (o sustituye) el grafcet de conducción en la hoja «GEMMA», dentro de un marco «GC».
  const generateGemma = useCallback(() => {
    const gemma = plcRef.current.gemma ?? EMPTY_GEMMA
    takeSnapshot()
    let list = sheetsOf(plcRef.current)
    let sheet = list.find((s) => s.name === 'GEMMA')
    if (!sheet) {
      sheet = { id: crypto.randomUUID(), name: 'GEMMA' }
      list = [...list, sheet]
    }
    const generated = generateConduction(gemma, { sheet: sheet.id })
    // Margen a la derecha para las cajas de acción (órdenes de forzado), que el marco no mide.
    const box = frameAround(generated.nodes)
    const frame = { id: 'gemma-frame', type: 'frame', ...box, width: box.width + 140, zIndex: -1, data: { kind: 'grafcet', name: 'GC', sheet: sheet.id } }
    const isGemma = (id) => id.startsWith('gemma-')
    setNodes((nds) => [...nds.filter((n) => !isGemma(n.id)), ...generated.nodes, frame])
    setEdges((eds) => [...eds.filter((e) => !isGemma(e.source) && !isGemma(e.target)), ...generated.edges])
    setPlc((p) => {
      const steps = Object.fromEntries(Object.entries(p.steps).filter(([id]) => !isGemma(id)))
      for (const [id, comment] of Object.entries(generated.comments)) steps[id] = { ...steps[id], comment }
      return { ...p, sheets: list, steps }
    })
    setGemmaOpen(false)
    selectSheet(sheet.id)
  }, [takeSnapshot, setNodes, setEdges, setPlc, selectSheet])

  // Renumerar una etapa: al terminar de editar su número (o al cerrar el panel) se actualizan
  // las referencias a ella (X5, 5s/X5, F/G2{5}). Se compara con el número que tenía al empezar.
  const labelAtStart = useRef(new Map())
  const commitRenumber = useCallback(
    (id) => {
      const node = id && getNode(id)
      if (node?.type !== 'step' || !labelAtStart.current.has(id)) return
      const from = String(labelAtStart.current.get(id) ?? '').trim()
      const to = String(node.data.label ?? '').trim()
      labelAtStart.current.set(id, to)
      if (!from || !to || from === to) return
      takeSnapshot()
      const frames = getNodes().filter((n) => n.type === 'frame')
      const grafcetOf = (n) => frameOf(n, frames, 'grafcet')?.data.name?.toUpperCase() ?? null
      setNodes((nds) => renumberStep(nds, id, from, to, grafcetOf))
    },
    [getNode, getNodes, setNodes, takeSnapshot],
  )
  const previousEditing = useRef(null)
  useEffect(() => {
    if (previousEditing.current && previousEditing.current !== editingId) commitRenumber(previousEditing.current)
    previousEditing.current = editingId
    const node = editingId && getNode(editingId)
    if (node?.type === 'step') labelAtStart.current.set(editingId, node.data.label)
  }, [editingId, commitRenumber, getNode])

  // Renombrar una variable en todo el diagrama (desde la tabla de variables). Devuelve un error o null.
  const renameVar = useCallback(
    (from, to) => {
      to = to.trim()
      if (to === from) return null
      if (!isValidName(to)) return t('Nombre no válido: letras, cifras y _ (sin empezar por cifra ni espacios).')
      if (symbols.has(to)) return t('Ya existe una variable «{nombre}».', { nombre: to })
      takeSnapshot()
      const result = renameVariable(getNodes(), plcRef.current, from, to)
      setNodes(result.nodes)
      setPlc(result.plc)
      return null
    },
    [symbols, takeSnapshot, getNodes, setNodes, setPlc, plcRef],
  )
  renameVarRef.current = renameVar

  // Encierra unos nodos en un marco nuevo (grafcet parcial o expansión de macroetapa).
  const frameAroundNodes = useCallback(
    (nodeIds, kind) => {
      const ids = new Set(nodeIds)
      const inner = getNodes().filter((n) => ids.has(n.id) && n.type !== 'variables')
      if (!inner.length) return
      takeSnapshot()
      setNodes((nds) => [
        ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
        { id: crypto.randomUUID(), type: 'frame', ...frameAround(inner), data: { kind, name: nextFrameName(kind, nds) }, zIndex: -1, selected: true },
      ])
    },
    [getNodes, takeSnapshot, setNodes],
  )

  // Al arrastrar un marco se mueve con su contenido (los marcos no son grupos de React Flow).
  const frameDragRef = useRef(null)
  const onNodeDragStart = useCallback(
    (_, node, dragged) => {
      takeSnapshot()
      frameDragRef.current = null
      if (node.type !== 'frame') return
      const draggedIds = new Set(dragged.map((n) => n.id))
      const members = membersOf(node, getNodes()).filter((m) => !draggedIds.has(m.id))
      frameDragRef.current = { id: node.id, start: { ...node.position }, members: new Map(members.map((m) => [m.id, { ...m.position }])) }
    },
    [takeSnapshot, getNodes],
  )
  const onNodeDrag = useCallback(
    (_, node) => {
      const drag = frameDragRef.current
      if (!drag || node.id !== drag.id || !drag.members.size) return
      const dx = node.position.x - drag.start.x
      const dy = node.position.y - drag.start.y
      setNodes((nds) =>
        nds.map((n) => {
          const p = drag.members.get(n.id)
          return p ? { ...n, position: { x: p.x + dx, y: p.y + dy } } : n
        }),
      )
    },
    [setNodes],
  )

  // Añade una acción a la etapa seleccionada y abre su panel para editarla.
  const addAction = useCallback(() => {
    if (!selectedStep) return
    takeSnapshot()
    updateNodeData(selectedStep.id, { actions: [...(selectedStep.data.actions ?? []), normalizeAction(t('Acción'))] })
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
    pushRecent({ nodes: getNodes(), edges: getEdges(), plc: plcRef.current, name: projectNameRef.current }, t('Antes de limpiar el lienzo'))
    takeSnapshot()
    setNodes([])
    setEdges([])
    setEditingId(null)
  }, [nodes.length, edges.length, getNodes, getEdges, takeSnapshot, setNodes, setEdges])

  // --- Archivos ----------------------------------------------------------------------------------
  const save = useCallback(() => saveProject({ ...toObject(), plc, name: projectName }), [toObject, plc, projectName])

  // Proyecto que llega en el enlace (lib/share.js): se ofrece abrirlo (lo de ahora va a «Trabajos
  // anteriores»).
  const [incoming, setIncoming] = useState(null) // { project } | { error }
  useEffect(() => {
    const check = () => {
      const data = sharedData()
      if (!data) return
      decodeProject(data)
        .then((project) => setIncoming({ project }))
        .catch((error) => setIncoming({ error: error.message }))
    }
    check()
    // También al pegar un enlace compartido en la pestaña del editor ya abierto (solo cambia el «#»).
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])
  const closeIncoming = () => {
    setIncoming(null)
    clearSharedHash()
  }

  // Sustituye el diagrama (abrir archivo, ejemplo o trabajo anterior). Lo que había se guarda
  // antes como trabajo anterior (lib/recent.js) y además se puede deshacer con Ctrl+Z.
  const replaceProject = useCallback(
    (project, reason) => {
      pushRecent({ nodes: getNodes(), edges: getEdges(), plc: plcRef.current, name: projectNameRef.current }, reason)
      takeSnapshot()
      // Cada elemento con su hoja desde el principio (los proyectos antiguos no la llevan): así no
      // hay un segundo ciclo de dibujo al asignarla después.
      const firstSheet = sheetsOf(project.plc ?? EMPTY_PLC)[0].id
      setNodes(project.nodes.map((n) => (n.data?.sheet ? n : { ...n, data: { ...n.data, sheet: firstSheet } })))
      setEdges(project.edges)
      setPlc(project.plc ?? EMPTY_PLC)
      setCurrentSheet(sheetsOf(project.plc ?? EMPTY_PLC)[0].id)
      setProjectNameState(project.name ?? '')
      setEditingId(null)
      if (project.viewport) setViewport(project.viewport)
      else fitWhenReady(0)
    },
    [getNodes, getEdges, takeSnapshot, setNodes, setEdges, setViewport, fitWhenReady],
  )

  const load = useCallback(
    async (file) => {
      try {
        const project = await loadProject(file)
        // Proyectos guardados sin nombre: el del archivo, sin la extensión.
        replaceProject({ ...project, name: project.name ?? file.name.replace(/\.json$/i, '') }, t('Antes de abrir «{archivo}»', { archivo: file.name }))
      } catch (err) {
        alert(err.message)
      }
    },
    [replaceProject],
  )

  const [projectsTab, setProjectsTab] = useState(null) // 'examples' | 'recent' | null
  const openExample = useCallback(
    (example) => {
      replaceProject({ ...normalizeProject(example.build()), name: example.title }, t('Antes de abrir el ejemplo «{ejemplo}»', { ejemplo: t(example.title) }))
      setProjectsTab(null)
    },
    [replaceProject],
  )
  const restoreRecent = useCallback(
    (entry) => {
      replaceProject(normalizeProject(entry.project), t('Antes de recuperar un trabajo anterior'))
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
    // Con planta montada, la escena se ve junto al grafcet desde el principio.
    if (plc.scene?.elements?.length) setSceneView((v) => v ?? 'split')
  }, [setNodes, setMenu, simulation, plc.scene])

  // --- Atajos ------------------------------------------------------------------------------------
  // En solo lectura (simulando o con la edición bloqueada) los atajos de edición no hacen nada.
  const selectedIds = () => getNodes().filter((n) => n.selected).map((n) => ({ id: n.id }))
  useEditorShortcuts({
    undo: () => (activeSceneHistory ? activeSceneHistory.undo() : !readOnly && undo()),
    redo: () => (activeSceneHistory ? activeSceneHistory.redo() : !readOnly && redo()),
    // Editando la escena de la planta, los atajos de edición de siempre actúan sobre ella.
    copy: () => (activeSceneHistory ? activeSceneHistory.copy() : copy()),
    cut: () => (activeSceneHistory ? activeSceneHistory.cut() : !readOnly && copy() && deleteElements({ nodes: selectedIds() })),
    paste: () => (activeSceneHistory ? activeSceneHistory.paste() : !readOnly && paste()),
    duplicate: () => (activeSceneHistory ? activeSceneHistory.duplicate() : !readOnly && duplicate()),
    selectAll: () =>
      activeSceneHistory ? activeSceneHistory.selectAll() : !readOnly && setNodes((nds) => nds.map((n) => ({ ...n, selected: true }))),
    // Supr en el lienzo lo atiende React Flow; fuera de él, solo la escena.
    remove: activeSceneHistory?.remove,
    save,
    open: () => fileInputRef.current?.click(),
    help: () => setHelpOpen(true),
    find: () => setSearchOpen(true),
    move: (dx, dy) => {
      if (readOnly || !getNodes().some((n) => n.selected)) return
      // Una ráfaga de pulsaciones seguidas es un solo paso de deshacer.
      const now = Date.now()
      if (now - lastNudgeRef.current > 800) takeSnapshot()
      lastNudgeRef.current = now
      setNodes((nds) => nds.map((n) => (n.selected ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n)))
    },
    navigate: (dir) => {
      const all = getNodes()
      const selected = all.filter((n) => n.selected)
      const target = neighbor(all, getEdges(), selected.length === 1 ? selected[0] : null, dir)
      if (!target) return
      setNodes((nds) => nds.map((n) => (n.selected === (n.id === target.id) ? n : { ...n, selected: n.id === target.id })))
      // Si queda fuera de la vista, se centra en él.
      const w = target.measured?.width ?? 0
      const h = target.measured?.height ?? 0
      const rect = wrapperRef.current?.getBoundingClientRect()
      const a = flowToScreenPosition(target.position)
      const b = flowToScreenPosition({ x: target.position.x + w, y: target.position.y + h })
      if (rect && (a.x < rect.left || a.y < rect.top || b.x > rect.right || b.y > rect.bottom))
        setCenter(target.position.x + w / 2, target.position.y + h / 2, { zoom: getZoom(), duration: 200 })
    },
    edit: () => {
      const selected = getNodes().filter((n) => n.selected)
      if (selected.length === 1) openNodeEditor(selected[0])
    },
    escape: () => {
      setLoopSourceId(null)
      setEditingId(null)
      setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds))
    },
  })

  const loopSource = loopSourceId ? nodes.find((n) => n.id === loopSourceId) : null
  const initialSteps = nodes.filter((n) => n.type === 'step' && n.data.initial)
  const modalOpen = settingsOpen || helpOpen || variablesOpen || ladderOpen || gemmaOpen || pneumaticOpen || newOpen || !!exportFormat || !!projectsTab || !!menu
  // En solo lectura el clic derecho no abre menús de edición (ni el del navegador).
  const blockMenu = (handler) => (readOnly ? (e) => e.preventDefault() : handler)
  // En solo lectura (simulando), el clic derecho en una etapa o transición permite ver su ladder.
  const readOnlyNodeMenu = (e, node) => {
    e.preventDefault()
    if (node.type === 'step' || node.type === 'transition') setMenu({ x: e.clientX, y: e.clientY, kind: 'readonly', nodeIds: [node.id] })
  }

  return (
    <EditorProvider value={editorApi}>
      <div className="flex h-full flex-col">
        <Toolbar
          projectName={projectName}
          onRenameProject={setProjectNameState}
          onAdd={addNode}
          onAddAction={addAction}
          canAddAction={!!selectedStep}
          onUndo={activeSceneHistory ? activeSceneHistory.undo : undo}
          onRedo={activeSceneHistory ? activeSceneHistory.redo : redo}
          canUndo={activeSceneHistory ? activeSceneHistory.canUndo : canUndo}
          canRedo={activeSceneHistory ? activeSceneHistory.canRedo : canRedo}
          historyUnlocked={Boolean(activeSceneHistory)}
          onExport={onExport}
          onSave={save}
          onOpen={() => fileInputRef.current?.click()}
          onOpenExamples={() => setProjectsTab('examples')}
          onOpenRecent={() => setProjectsTab('recent')}
          onOpenPneumatic={() => setPneumaticOpen(true)}
          onClear={clear}
          onOpenSettings={() => setSettingsOpen(true)}
          onToggleVerify={() => setVerifyOpen((v) => !v)}
          onSearch={() => setSearchOpen(true)}
          electricalOpen={Boolean(elecView)}
          onToggleElectrical={() => setElecView((v) => (v ? null : 'split'))}
          onNew={() => setNewOpen(true)}
          verifyOpen={verifyOpen}
          issueCounts={issueCounts}
          onHelp={() => setHelpOpen(true)}
          onOpenVariables={() => setVariablesOpen(true)}
          simulating={simulating}
          readOnly={readOnly}
          onToggleSimulation={() => (simulating ? setSimulating(false) : startSimulation())}
          onOpenLadder={() => {
            setLadderFocus(null)
            setLadderOpen(true)
          }}
          onOpenGemma={() => setGemmaOpen(true)}
        />
        {ladderOpen && (
          <Suspense fallback={<Loading />}>
            <LadderView
              nodes={nodes}
              edges={edges}
              plc={plc}
              grafcetErrors={issueCounts.errors}
              exportProps={titleBlockProps}
              onClose={() => setLadderOpen(false)}
              simulation={simulating ? simulation : null}
              highlightNodeId={ladderFocus}
              onShowInGrafcet={(id) => {
                setLadderOpen(false)
                setHighlight(new Set([id]))
                focusNode(id)
              }}
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
              onRenameVariable={renameVar}
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
        {exportFormat === 'dossier' && (
          <Suspense fallback={<Loading />}>
            <DossierDialog
              nodes={nodes}
              edges={edges}
              plc={plc}
              issues={issues}
              projectName={projectName}
              source={exportSource}
              onChange={(dossier) => setPlc((p) => ({ ...p, dossier }))}
              onClose={() => setExportFormat(null)}
            />
          </Suspense>
        )}
        {exportFormat === 'share' && (
          <Suspense fallback={<Loading />}>
            <ShareDialog
              project={{ name: projectName, ...stripForShare(toObject()), plc }}
              onDownload={save}
              onClose={() => setExportFormat(null)}
            />
          </Suspense>
        )}
        {exportFormat && exportFormat !== 'dossier' && exportFormat !== 'share' && (
          <Suspense fallback={<Loading />}>
            <ExportDialog
              source={exportSource}
              initialFormat={exportFormat}
              fileName={(ext) => fileName(ext)}
              {...titleBlockProps}
              onClose={() => setExportFormat(null)}
            />
          </Suspense>
        )}
        {incoming && (
          <div role="alertdialog" aria-label={t('Proyecto compartido')} className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
            {incoming.error ? (
              <span>{incoming.error}</span>
            ) : (
              <>
                <span>
                  {t('Proyecto compartido:')}{' '}<strong>«{incoming.project.name || t('sin nombre')}»</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const project = normalizeProject(incoming.project)
                    if (project) replaceProject({ ...project, name: incoming.project.name ?? '' }, t('Antes de abrir un proyecto compartido'))
                    closeIncoming()
                  }}
                  className="rounded-md bg-blue-600 px-2.5 py-1 font-medium hover:bg-blue-700"
                >
                  {t('Abrir')}
                </button>
                <span className="text-xs text-slate-300">{t('(lo de ahora queda en «Trabajos anteriores»)')}</span>
              </>
            )}
            <button type="button" onClick={closeIncoming} className="rounded-md px-2 py-1 text-slate-300 hover:text-white">
              {incoming.error ? t('Cerrar') : t('Descartar')}
            </button>
          </div>
        )}
        {newOpen && (
          <Suspense fallback={<Loading />}>
            <NewProjectDialog
              onCreate={(project) => {
                setNewOpen(false)
                replaceProject(normalizeProject(project), t('Antes de crear un proyecto nuevo'))
              }}
              onClose={() => setNewOpen(false)}
            />
          </Suspense>
        )}
        {pneumaticOpen && (
          <Suspense fallback={<Loading />}>
            <PneumaticDialog
              onCreate={(project) => {
                setPneumaticOpen(false)
                replaceProject({ ...normalizeProject(project), name: project.name }, t('Antes de generar una secuencia neumática'))
              }}
              onClose={() => setPneumaticOpen(false)}
            />
          </Suspense>
        )}
        {gemmaOpen && (
          <Suspense fallback={<Loading />}>
            <GemmaDialog
              gemma={plc.gemma ?? EMPTY_GEMMA}
              onChange={(gemma) => setPlc((p) => ({ ...p, gemma }))}
              grafcets={nodes.filter((n) => n.type === 'frame' && n.data.kind === 'grafcet').map((n) => String(n.data.name).toUpperCase())}
              onGenerate={generateGemma}
              onClose={() => setGemmaOpen(false)}
            />
          </Suspense>
        )}
        {helpOpen && (
          <Suspense fallback={<Loading />}>
            <HelpDialog
              onClose={() => setHelpOpen(false)}
              onTour={() => {
                setHelpOpen(false)
                setTour(FIRST_TOUR)
              }}
            />
          </Suspense>
        )}
        {tour && (
          <Suspense fallback={null}>
            <Tour
              tour={tour}
              onClose={() => {
                markTourSeen()
                setTour(null)
              }}
            />
          </Suspense>
        )}
        {offerTour && !tour && (
          <div role="status" className="fixed top-16 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-xl">
            <Compass size={18} className="shrink-0 text-blue-600" />
            <span>{t('¿Es la primera vez? Una visita guiada te enseña lo principal en un par de minutos.')}</span>
            <button
              type="button"
              onClick={() => {
                setOfferTour(false)
                setTour(FIRST_TOUR)
              }}
              className="rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
            >
              {t('Empezar')}
            </button>
            <button
              type="button"
              onClick={() => {
                markTourSeen()
                setOfferTour(false)
              }}
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
            >
              {t('Ahora no')}
            </button>
          </div>
        )}
        <div className="relative flex min-h-0 flex-1">
          <div
            ref={wrapperRef}
            onPointerDownCapture={() => setLastPanel(null)}
            data-tour="lienzo"
            className={`relative min-w-[160px] flex-1 ${loopSource ? 'loop-picking' : ''} ${readOnly ? 'read-only' : ''}`}
          >
            {editLocked && !simulating && (
              <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 shadow">
                <Lock size={14} />{' '}{t('Edición bloqueada: solo puedes desplazarte y hacer zoom')}
                <button
                  type="button"
                  onClick={() => setEditLocked(false)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-amber-100"
                >
                  {t('Desbloquear')}
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
            {searchOpen && (
              <SearchBar
                nodes={nodes}
                onFocus={(id) => {
                  setNodes((nds) => nds.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })))
                  focusNode(id)
                }}
                onClose={() => setSearchOpen(false)}
              />
            )}
            <ReactFlow
              nodes={shownNodes}
              edges={shownEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onConnectStart={(_, { nodeId, handleType }) => setConnecting({ nodeId, handleType })}
              onConnectEnd={() => setConnecting(null)}
              onNodeDragStart={onNodeDragStart}
              onNodeDrag={onNodeDrag}
              onSelectionDragStart={() => takeSnapshot()}
              onBeforeDelete={async () => {
                takeSnapshot()
                return true
              }}
              onNodeContextMenu={readOnly ? readOnlyNodeMenu : onNodeContextMenu}
              onSelectionContextMenu={blockMenu(onSelectionContextMenu)}
              onPaneContextMenu={blockMenu(onPaneContextMenu)}
              onEdgeContextMenu={blockMenu(onEdgeContextMenu)}
              onMoveStart={closeMenu}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              elementsSelectable={!readOnly}
              onNodeClick={(e, node) => {
                if (loopSource) return node.type === 'step' && finishLoop(node.id)
                if (isDoubleTap(e, node.id)) openNodeEditor(node)
              }}
              onNodeDoubleClick={(_, node) => openNodeEditor(node)}
              onPaneClick={() => {
                setEditingId(null)
                setLoopSourceId(null)
              }}
              zoomOnDoubleClick={false}
              snapToGrid
              disableKeyboardA11y
              snapGrid={[10, 10]}
              // Con un diálogo o menú abierto, Supr/Retroceso no deben borrar nodos del lienzo de fondo.
              deleteKeyCode={modalOpen || readOnly ? null : ['Delete', 'Backspace']}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
              <SheetRefs refs={sheetRefs} nodes={shownNodes} />
              <SheetTabs
                sheets={sheets}
                current={currentSheet}
                counts={sheetCounts}
                readOnly={readOnly}
                renameLocked={editLocked}
                onSelect={selectSheet}
                onAdd={addSheet}
                onRename={(id, name) => {
                  takeSnapshot()
                  setPlc((p) => ({ ...p, sheets: sheetsOf(p).map((s) => (s.id === id ? { ...s, name } : s)) }))
                }}
                onDelete={deleteSheet}
              />
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
              <GrafcetContextMenu
                menu={menu}
                onClose={closeMenu}
                onEdit={setEditingId}
                onAddNodeAt={addNode}
                onFrameAround={frameAroundNodes}
                sheets={sheets.length > 1 ? sheets.filter((s) => s.id !== currentSheet) : []}
                onMoveToSheet={moveToSheet}
                onShowInLadder={(id) => {
                  setLadderFocus(id)
                  setLadderOpen(true)
                }}
              />
            )}
          </div>
          {elecView && (
            <Suspense fallback={<Loading panel />}>
              <ElectricalView
                schematic={plc.electrical}
                onChange={(electrical) => setPlc((p) => ({ ...p, electrical }))}
                elecState={simulating ? (simulation.sim?.world?.elec ?? null) : null}
                onAction={simulation.elecDo}
                variables={[...symbols].map(([name, found]) => ({ name, type: plc.variables?.[name]?.type ?? found.type }))}
                buildVariables={() => buildPlcModel(nodes, edges, plc).variables}
                scene={plc.scene}
                simulating={simulating}
                titleInfo={elecTitle}
                exportProps={titleBlockProps}
                onHistory={setElecHistory}
                onActivate={() => setLastPanel('elec')}
                maximized={elecView === 'full'}
                onToggleMaximize={() => setElecView((v) => (v === 'full' ? 'split' : 'full'))}
                onClose={() => {
                  setElecView(null)
                  setLastPanel(null)
                }}
              />
            </Suspense>
          )}
          {simulating && sceneView && simulation.sim && (
            <Suspense fallback={<Loading panel />}>
              {/* contents: no cambia el diseño; solo marca la planta como el último panel tocado. */}
              <div className="contents" onPointerDownCapture={() => setLastPanel('scene')}>
              <SceneView
                scene={plc.scene}
                onChange={(scene) => setPlc((p) => ({ ...p, scene }))}
                worldState={simulation.sim.world}
                values={{ ...simulation.sim.state.values, ...simulation.sim.inputs }}
                time={simulation.sim.state.time}
                variables={simulation.compiled.variables}
                onAction={simulation.sceneDo}
                onHistory={setSceneHistory}
                onCreateVariable={(name, type) =>
                  setPlc((p) => ({ ...p, variables: { ...p.variables, [name]: { ...(p.variables?.[name] ?? {}), type } } }))
                }
                maximized={sceneView === 'full'}
                onToggleMaximize={() => setSceneView((v) => (v === 'full' ? 'split' : 'full'))}
                onClose={() => setSceneView(null)}
              />
              </div>
            </Suspense>
          )}
          {simulating ? (
            <Suspense fallback={<Loading panel />}>
              <SimulationPanel
                sceneOpen={Boolean(sceneView)}
                onToggleScene={() => {
                  setSceneView((v) => (v ? null : 'split'))
                  setLastPanel('scene')
                }}
                elecOpen={Boolean(elecView)}
                onToggleElec={() => setElecView((v) => (v ? null : 'split'))}
                simulation={simulation}
                scenarios={plc.scenarios}
                onScenariosChange={(update) => setPlc((p) => ({ ...p, scenarios: update(p.scenarios ?? []) }))}
                cpuConfig={plc.cpu}
                onCpuChange={(cpu) => setPlc((p) => ({ ...p, cpu }))}
                onApplySymbols={(symbols) => setPlc((p) => ({ ...p, variables: applySymbols(p.variables, symbols) }))}
                exportProps={titleBlockProps}
                onFocusNode={focusNode}
                onClose={() => setSimulating(false)}
              />
            </Suspense>
          ) : (
            <>
              <PropertiesPanel
                node={editingNode}
                onChange={editNode}
                onCommitLabel={() => commitRenumber(editingId)}
                vocabulary={vocabulary}
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
