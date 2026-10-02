import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  addEdge,
  getNodesBounds,
  useNodesInitialized,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import Toolbar from './Toolbar'
import PropertiesPanel from './PropertiesPanel'
import VerifyPanel from './VerifyPanel'
import LoopPickerBanner from './LoopPickerBanner'
import SettingsDialog from './SettingsDialog'
import HelpDialog from './HelpDialog'
import GrafcetContextMenu from './GrafcetContextMenu'
import GhostPreview from './GhostPreview'
import CanvasControls from './CanvasControls'
import { Lock } from 'lucide-react'
import SimulationPanel from './SimulationPanel'
import LadderView from './LadderView'
import { useSimulation } from '../lib/sim/useSimulation'
import { useSettings } from '../lib/settings'
import { nodeTypes, VARIABLES_TABLE_ID } from '../nodes'
import { edgeTypes } from '../edges'
import { initialNodes, initialEdges, defaultEdgeOptions } from '../lib/initialDiagram'
import { exportDiagram, exportPdf, drawnBounds } from '../lib/exportImage'
import { saveProject, loadProject, downloadFile } from '../lib/projectFile'
import {
  EMPTY_PLC,
  addVariable,
  autoAssign,
  changeVariableType,
  deleteVariable,
  renameVariable,
  validatePlc,
  plcToCsv,
} from '../lib/addressing'
import { projectVariables } from '../lib/symbols'
import VariablesDialog from './VariablesDialog'
import { nextStepLabel, nextTransitionLabel, findFreePosition } from '../lib/layout'
import { useHistory } from '../lib/history'
import { EditorProvider } from '../lib/editorContext'
import { isValidGrafcetConnection } from '../lib/grafcetRules'
import { validateGrafcet, issuesByNode } from '../lib/validation'
import { copySelection, prepareClipboard, PASTE_OFFSET } from '../lib/clipboard'
import { loadAutosave, useAutosave } from '../lib/autosave'
import { useEditorShortcuts } from '../lib/shortcuts'
import { normalizeAction } from '../lib/actions'

const defaultData = {
  step: (nodes) => ({ label: nextStepLabel(nodes), actions: [] }),
  transition: (nodes) => ({ condition: nextTransitionLabel(nodes) }),
}

export default function GrafcetCanvas() {
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
  const [variablesOpen, setVariablesOpen] = useState(false)

  const [editingId, setEditingId] = useState(null)
  // Transición desde la que se está creando un bucle (herramienta Bucle activa) o null.
  const [loopSourceId, setLoopSourceId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  // Modo simulación: la edición queda bloqueada y el lienzo muestra la evolución.
  const [simulating, setSimulating] = useState(false)
  // Bloqueo de edición (candado de los controles): solo mirar, desplazar y hacer zoom.
  const [editLocked, setEditLocked] = useState(false)
  // Solo lectura: al simular o con la edición bloqueada.
  const readOnly = simulating || editLocked
  const [ladderOpen, setLadderOpen] = useState(false)
  const simulation = useSimulation(nodes, edges, plc, simulating)
  const { settings, update: updateSettings, reset: resetSettings } = useSettings()
  const {
    screenToFlowPosition,
    updateNodeData,
    toObject,
    setViewport,
    getViewport,
    fitView,
    getNode,
    getNodes,
    getEdges,
    deleteElements,
  } = useReactFlow()
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useHistory({ get: () => plcRef.current, set: setPlc })
  const wrapperRef = useRef(null)

  // Encuadra todo lo dibujado (no solo las cajas de los nodos: también receptividades, bucles,
  // saltos y la tabla), con margen. Sustituye al encuadre de React Flow, que lo recortaba.
  const fitDrawn = useCallback(
    (duration = 300) => {
      const wrapper = wrapperRef.current
      const viewportEl = wrapper?.querySelector('.react-flow__viewport')
      const bounds = viewportEl && drawnBounds(viewportEl, getViewport())
      if (!bounds) return
      const { width, height } = wrapper.getBoundingClientRect()
      const pad = 48
      const w = bounds.maxX - bounds.minX
      const h = bounds.maxY - bounds.minY
      const zoom = Math.min(1.5, Math.max(0.1, Math.min((width - pad * 2) / w, (height - pad * 2) / h)))
      setViewport(
        { x: (width - w * zoom) / 2 - bounds.minX * zoom, y: (height - h * zoom) / 2 - bounds.minY * zoom, zoom },
        { duration },
      )
    },
    [getViewport, setViewport],
  )

  // Encuadre inicial, en cuanto React Flow ha medido los nodos.
  const nodesInitialized = useNodesInitialized()
  const didInitialFit = useRef(false)
  useEffect(() => {
    if (!nodesInitialized || didInitialFit.current) return
    didInitialFit.current = true
    requestAnimationFrame(() => fitDrawn(0))
  }, [nodesInitialized, fitDrawn])
  const fileInputRef = useRef(null)
  const clipboardRef = useRef(null)

  const editingNode = nodes.find((n) => n.id === editingId)
  const selectedStep = nodes.find((n) => n.selected && n.type === 'step')

  // Variables detectadas en el diagrama y etapas, para la tabla de variables.
  // Incluye las variables añadidas a mano en la tabla aunque aún no se usen en el diagrama.
  const symbols = useMemo(() => projectVariables(nodes, plc.variables), [nodes, plc.variables])
  const stepNodes = useMemo(() => nodes.filter((n) => n.type === 'step'), [nodes])
  const plcIssues = useMemo(() => validatePlc(plc, stepNodes, symbols), [plc, stepNodes, symbols])

  const changePlc = useCallback(
    (updater, coalesceKey) => {
      takeSnapshot(coalesceKey && `plc:${coalesceKey}`)
      setPlc(updater)
    },
    [takeSnapshot],
  )

  // Tabla de variables dibujada en el lienzo (nodo único, ver nodes/VariablesTableNode.jsx).
  const tableShown = nodes.some((n) => n.id === VARIABLES_TABLE_ID)
  const toggleTable = useCallback(
    (at) => {
      takeSnapshot()
      setNodes((nds) => {
        if (nds.some((n) => n.id === VARIABLES_TABLE_ID)) return nds.filter((n) => n.id !== VARIABLES_TABLE_ID)
        // Por defecto, a la derecha del grafcet y alineada con su parte superior.
        const diagram = nds.filter((n) => n.type === 'step' || n.type === 'transition')
        const bounds = diagram.length ? getNodesBounds(diagram) : null
        const position = at ?? (bounds ? { x: bounds.x + bounds.width + 160, y: bounds.y } : { x: 0, y: 0 })
        return [
          ...nds,
          { id: VARIABLES_TABLE_ID, type: 'variables', position, data: { showComments: true }, deletable: false },
        ]
      })
    },
    [takeSnapshot, setNodes],
  )

  // Nodos resaltados al pasar el ratón por una fila de la tabla del lienzo.
  const [highlight, setHighlight] = useState(null)
  // Última variable añadida a mano: su nombre se abre para editar nada más crearla.
  const [lastAdded, setLastAdded] = useState(null)

  const plcTable = useMemo(
    () => ({
      plc,
      symbols,
      stepNodes,
      changePlc,
      lastAdded,
      // reveal: si la tabla no está en el lienzo, se muestra para ver la variable nueva.
      addVariable: (type, { reveal = true } = {}) => {
        const { plc: next, name } = addVariable(plcRef.current, type, stepNodes, symbols)
        changePlc(next)
        setLastAdded(name)
        if (reveal && !getNode(VARIABLES_TABLE_ID)) toggleTable()
      },
      // Devuelve false si el nombre no es válido o ya existe.
      renameVariable: (oldName, newName) => {
        const next = renameVariable(plcRef.current, oldName, newName, symbols)
        if (!next) return false
        changePlc(next)
        return true
      },
      deleteVariable: (name) => changePlc((p) => deleteVariable(p, name)),
      setVariableType: (name, type) => changePlc((p) => changeVariableType(p, name, type, stepNodes, symbols)),
      autoFill: () => changePlc((p) => autoAssign(p, stepNodes, symbols)),
      openDialog: () => setVariablesOpen(true),
      hideTable: () => toggleTable(),
      toggleComments: (id) => {
        takeSnapshot()
        updateNodeData(id, (n) => ({ showComments: !(n.data.showComments ?? true) }))
      },
    }),
    [plc, symbols, stepNodes, changePlc, lastAdded, getNode, toggleTable, takeSnapshot, updateNodeData],
  )

  // Direcciones a mostrar en el diagrama (si está activada la opción en la tabla).
  const plcView = useMemo(() => {
    if (!plc.showAddresses) return null
    const stepByLabel = new Map(stepNodes.map((s) => [String(s.data.label), s.id]))
    return {
      stepAddress: (id) => plc.steps[id]?.address,
      lookup: {
        symbol: (name) => plc.variables[name]?.address,
        step: (label) => plc.steps[stepByLabel.get(label)]?.address,
      },
    }
  }, [plc, stepNodes])

  // Verificación de conformidad en vivo; los nodos solo se marcan con el panel abierto.
  const issues = useMemo(() => [...validateGrafcet(nodes, edges), ...plcIssues], [nodes, edges, plcIssues])
  const issueCounts = useMemo(
    () => ({
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    }),
    [issues],
  )
  const markedIssues = useMemo(() => (verifyOpen ? issuesByNode(issues) : null), [verifyOpen, issues])

  const focusIssue = useCallback(
    (issue) => {
      const ids = new Set(issue.nodeIds)
      setNodes((nds) => nds.map((n) => ({ ...n, selected: ids.has(n.id) })))
      fitView({ nodes: issue.nodeIds.map((id) => ({ id })), duration: 400, maxZoom: 1.5, padding: 0.5 })
    },
    [setNodes, fitView],
  )

  // Etapas inmediatamente anteriores a la transición en edición (para sugerir "5s/Xn").
  const previousSteps = useMemo(() => {
    if (editingNode?.type !== 'transition') return []
    return edges
      .filter((e) => e.target === editingId)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter((n) => n?.type === 'step' && n.data.label)
      .map((n) => n.data.label)
  }, [editingNode, editingId, edges, nodes])

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

  // Vista previa de lo que añadiría el "+" flotante bajo el ratón (ver GhostPreview).
  const [preview, setPreview] = useState(null)

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
      sim: simulating ? simulation.view : null,
    }),
    [takeSnapshot, markedIssues, plcView, plcTable, highlight, toggleTable, simulating, readOnly, simulation.view],
  )

  // Menú contextual (clic derecho): { x, y, kind: 'node' | 'selection' | 'pane', nodeIds, flowPosition }
  const [menu, setMenu] = useState(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const onNodeContextMenu = useCallback(
    (e, node) => {
      e.preventDefault()
      const selected = nodes.filter((n) => n.selected)
      // Clic derecho sobre un nodo de una selección múltiple: el menú actúa sobre toda la selección.
      if (node.selected && selected.length > 1) {
        setMenu({ x: e.clientX, y: e.clientY, kind: 'selection', nodeIds: selected.map((n) => n.id) })
        return
      }
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })))
      setMenu({ x: e.clientX, y: e.clientY, kind: 'node', nodeIds: [node.id] })
    },
    [nodes, setNodes],
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

  // Añade un nodo en `at` (coordenadas del lienzo) o, si no se indica, en el centro de la vista.
  const addNode = useCallback(
    (type, extra = {}, at) => {
      takeSnapshot()
      const rect = wrapperRef.current.getBoundingClientRect()
      const position =
        at ?? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      setNodes((nds) => [
        ...nds,
        {
          id: crypto.randomUUID(),
          type,
          position: findFreePosition(position, type, nds),
          data: { ...defaultData[type](nds), ...extra },
        },
      ])
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

  // Inserta nodos y enlaces nuevos (pegar / duplicar) dejándolos seleccionados.
  const insertClip = useCallback(
    (clip) => {
      const { nodes: added, edges: addedEdges } = prepareClipboard(clip, getNodes())
      takeSnapshot()
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...added])
      setEdges((eds) => [...eds.map((e) => ({ ...e, selected: false })), ...addedEdges])
    },
    [getNodes, takeSnapshot, setNodes, setEdges],
  )

  const copy = useCallback(() => {
    const clip = copySelection(getNodes(), getEdges())
    if (clip) clipboardRef.current = clip
    return clip
  }, [getNodes, getEdges])

  const paste = useCallback(() => {
    const clip = clipboardRef.current
    if (!clip) return
    insertClip(clip)
    // Cada pegado sucesivo cae un poco más abajo y a la derecha, en cascada.
    clipboardRef.current = {
      ...clip,
      nodes: clip.nodes.map((n) => ({ ...n, position: { x: n.position.x + PASTE_OFFSET, y: n.position.y + PASTE_OFFSET } })),
    }
  }, [insertClip])

  const save = useCallback(() => saveProject({ ...toObject(), plc }), [toObject, plc])

  // Exporta sin la selección (se dibuja en azul) ni el resaltado; después la restaura.
  const exportImage = useCallback(
    async (format) => {
      const selectedNodes = new Set(getNodes().filter((n) => n.selected).map((n) => n.id))
      const selectedEdges = new Set(getEdges().filter((e) => e.selected).map((e) => e.id))
      const hadSelection = selectedNodes.size || selectedEdges.size
      if (hadSelection) {
        setNodes((nds) => nds.map((n) => ({ ...n, selected: false })))
        setEdges((eds) => eds.map((e) => ({ ...e, selected: false })))
      }
      setHighlight(null)
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
    [getNodes, getEdges, setNodes, setEdges, getViewport],
  )

  const exportCsv = useCallback(
    // BOM inicial para que Excel reconozca UTF-8 (acentos, ñ).
    () => downloadFile(`﻿${plcToCsv(plc, stepNodes, symbols)}`, 'variables.csv', 'text/csv;charset=utf-8'),
    [plc, stepNodes, symbols],
  )

  const load = useCallback(
    async (file) => {
      try {
        const project = await loadProject(file)
        takeSnapshot()
        setNodes(project.nodes)
        setEdges(project.edges)
        setPlc(project.plc)
        setEditingId(null)
        if (project.viewport) setViewport(project.viewport)
        else requestAnimationFrame(() => requestAnimationFrame(() => fitDrawn(0)))
      } catch (err) {
        alert(err.message)
      }
    },
    [takeSnapshot, setNodes, setEdges, setViewport, fitDrawn],
  )

  const clear = useCallback(() => {
    if (!nodes.length && !edges.length) return
    takeSnapshot()
    setNodes([])
    setEdges([])
    setEditingId(null)
  }, [nodes.length, edges.length, takeSnapshot, setNodes, setEdges])

  const selectedIds = () => getNodes().filter((n) => n.selected).map((n) => ({ id: n.id }))

  // Entrar en simulación: se cierran paneles y menús de edición y se arranca en marcha.
  const startSimulation = useCallback(() => {
    setEditingId(null)
    setLoopSourceId(null)
    setMenu(null)
    setPreview(null)
    setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => ({ ...n, selected: false })) : nds))
    setSimulating(true)
    simulation.setPlaying(true)
  }, [setNodes, simulation])

  const focusNode = useCallback(
    (id) => fitView({ nodes: [{ id }], duration: 400, maxZoom: 1.5, padding: 0.6 }),
    [fitView],
  )

  // En solo lectura (simulando o con la edición bloqueada) los atajos de edición no hacen nada.
  useEditorShortcuts({
    undo: () => !readOnly && undo(),
    redo: () => !readOnly && redo(),
    copy,
    cut: () => !readOnly && copy() && deleteElements({ nodes: selectedIds() }),
    paste: () => !readOnly && paste(),
    duplicate: () => {
      if (readOnly) return
      const clip = copySelection(getNodes(), getEdges())
      if (clip) insertClip(clip)
    },
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
  const modalOpen = settingsOpen || helpOpen || variablesOpen || ladderOpen || !!menu
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
          onExport={exportImage}
          onSave={save}
          onOpen={() => fileInputRef.current?.click()}
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
          <LadderView
            nodes={nodes}
            edges={edges}
            plc={plc}
            grafcetErrors={issueCounts.errors}
            onClose={() => setLadderOpen(false)}
          />
        )}
        {variablesOpen && (
          <VariablesDialog
            plc={plc}
            stepNodes={stepNodes}
            symbols={symbols}
            issues={plcIssues}
            onChange={changePlc}
            onAutoAssign={(overwrite) => changePlc((p) => autoAssign(p, stepNodes, symbols, { overwrite }))}
            onExportCsv={exportCsv}
            tableShown={tableShown}
            onToggleTable={() => toggleTable()}
            onAddVariable={(type) => plcTable.addVariable(type, { reveal: false })}
            onClose={() => setVariablesOpen(false)}
          />
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
          <SettingsDialog
            settings={settings}
            onChange={updateSettings}
            onReset={resetSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
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
            <SimulationPanel simulation={simulation} onFocusNode={focusNode} onClose={() => setSimulating(false)} />
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
