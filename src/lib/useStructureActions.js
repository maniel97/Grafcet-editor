import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { findFreePosition, nextStepLabel, nextTransitionLabel, yBelow } from './layout'
import { useEditor } from './editorContext'
import { defaultEdgeOptions } from './initialDiagram'
import { normalizeAction } from './actions'
import { alignColumn, spaceSequence } from './align'
import { measureBoxes, spreadFactor, spreadNodes } from './spread'
import { nextFrameName } from './frames'

const link = (source, target) => ({ ...defaultEdgeOptions, id: `e-${source}-${target}`, source, target })

const newNode = (type, position, nodes) => ({
  id: crypto.randomUUID(),
  type,
  position,
  data: type === 'step' ? { label: nextStepLabel(nodes), actions: [] } : { condition: nextTransitionLabel(nodes) },
})

// Operaciones de estructura Grafcet (ramificaciones y convergencias en O / en Y).
// Todas se registran como un solo paso de deshacer y dejan seleccionado lo que crean.
export function useStructureActions() {
  const { getNode, getNodes, getEdges, setNodes, setEdges, updateNodeData, deleteElements, screenToFlowPosition } = useReactFlow()
  const { takeSnapshot } = useEditor()

  const insert = useCallback(
    (created, edges) => {
      takeSnapshot()
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...created.map((n) => ({ ...n, selected: true }))])
      setEdges((eds) => [...eds, ...edges])
    },
    [takeSnapshot, setNodes, setEdges],
  )

  // Ramas que salen hacia abajo del nodo (los bucles hacia arriba no cuentan).
  const branchesOf = useCallback(
    (node) =>
      getEdges()
        .filter((e) => e.source === node.id)
        .map((e) => getNode(e.target))
        .filter((n) => n && n.position.y > node.position.y),
    [getEdges, getNode],
  )

  // Divergencia en Y desde una transición (ramas = etapas simultáneas). Si aún no hay
  // ramificación crea dos ramas; si ya la hay, añade una a la derecha.
  const addBranch = useCallback(
    (nodeId) => {
      const source = getNode(nodeId)
      if (!source) return
      const type = source.type === 'step' ? 'transition' : 'step'
      const branches = branchesOf(source)
      const working = [...getNodes()]
      const created = []
      const y = branches.length ? Math.min(...branches.map((b) => b.position.y)) : yBelow(source)
      let x = branches.length ? Math.max(...branches.map((b) => b.position.x)) : source.position.x

      for (let i = 0; i < (branches.length ? 1 : 2); i++) {
        const node = newNode(type, findFreePosition({ x, y }, type, working), working)
        working.push(node)
        created.push(node)
        x = node.position.x
      }
      insert(
        created,
        created.map((n) => link(nodeId, n.id)),
      )
    },
    [getNode, getNodes, branchesOf, insert],
  )

  // Etapas que preceden a la transición (sin contar bucles que llegan desde abajo).
  const predecessorsOf = useCallback(
    (node) =>
      getEdges()
        .filter((e) => e.target === node.id)
        .map((e) => getNode(e.source))
        .filter((n) => n && n.position.y < node.position.y),
    [getEdges, getNode],
  )

  // Divergencia en O desde la propia transición: crea una transición alternativa a su derecha,
  // a la misma altura y colgando de la misma etapa anterior.
  const addAlternative = useCallback(
    (transitionId) => {
      const transition = getNode(transitionId)
      const [step] = transition ? predecessorsOf(transition) : []
      if (!step) return
      const nodes = getNodes()
      const node = newNode('transition', findFreePosition(transition.position, 'transition', nodes), nodes)
      insert([node], [link(step.id, node.id)])
    },
    [getNode, getNodes, predecessorsOf, insert],
  )

  // Convergencia: varias etapas hacia una transición común (en Y) o varias transiciones hacia
  // una etapa común (en O). El nodo nuevo va bajo la rama más baja, alineado con la de más a la izquierda.
  const converge = useCallback(
    (nodeIds, fromType) => {
      const sources = nodeIds.map(getNode).filter((n) => n?.type === fromType)
      if (sources.length < 2) return
      const type = fromType === 'step' ? 'transition' : 'step'
      const lowest = sources.reduce((a, b) => (b.position.y > a.position.y ? b : a))
      const nodes = getNodes()
      const position = findFreePosition(
        { x: Math.min(...sources.map((s) => s.position.x)), y: yBelow(lowest) },
        type,
        nodes,
      )
      const node = newNode(type, position, nodes)
      insert(
        [node],
        sources.map((s) => link(s.id, node.id)),
      )
    },
    [getNode, getNodes, insert],
  )

  // Inicial y macroetapa son excluyentes (una macroetapa no puede ser inicial).
  const toggleInitial = useCallback(
    (stepId) => {
      const step = getNode(stepId)
      if (!step) return
      takeSnapshot()
      updateNodeData(stepId, step.data.initial ? { initial: false } : { initial: true, macro: false })
    },
    [getNode, takeSnapshot, updateNodeData],
  )

  const toggleMacro = useCallback(
    (stepId) => {
      const step = getNode(stepId)
      if (!step) return
      takeSnapshot()
      updateNodeData(stepId, step.data.macro ? { macro: false } : { macro: true, initial: false, encapsulating: false })
    },
    [getNode, takeSnapshot, updateNodeData],
  )

  // Etapa encapsulante (IEC 60848). Al convertirla, si aún no tiene su grafcet encapsulado, se
  // crea a su derecha un marco «G5» con una primera etapa con enlace de activación (*).
  const toggleEncapsulating = useCallback(
    (stepId) => {
      const step = getNode(stepId)
      if (!step) return
      takeSnapshot()
      if (step.data.encapsulating) {
        updateNodeData(stepId, { encapsulating: false })
        return
      }
      const nodes = getNodes()
      const label = String(step.data.label)
      const hasFrame = nodes.some((n) => n.type === 'frame' && n.data.kind === 'encapsulation' && String(n.data.step) === label)
      const created = []
      if (!hasFrame) {
        const size = { width: 240, height: 200 }
        // A la derecha de la etapa y de sus acciones, donde no pise otros elementos.
        const rects = nodes
          .filter((n) => n.type !== 'frame')
          .map((n) => ({ x: n.position.x, y: n.position.y, w: n.measured?.width ?? 56, h: n.measured?.height ?? 56 }))
        const at = { x: step.position.x + (step.measured?.width ?? 56) + 80, y: step.position.y - 40 }
        const hits = () => rects.some((r) => r.x < at.x + size.width && at.x < r.x + r.w && r.y < at.y + size.height && at.y < r.y + r.h)
        for (let i = 0; i < 40 && hits(); i++) at.x += 80
        const names = new Set(nodes.filter((n) => n.type === 'frame').map((n) => String(n.data.name).toUpperCase()))
        const name = names.has(`G${label}`.toUpperCase()) ? nextFrameName('encapsulation', nodes) : `G${label}`
        created.push(
          { id: crypto.randomUUID(), type: 'frame', position: at, ...size, zIndex: -1, data: { kind: 'encapsulation', step: label, name } },
          {
            id: crypto.randomUUID(),
            type: 'step',
            position: { x: at.x + 60, y: at.y + 50 },
            data: { label: nextStepLabel(nodes), actions: [], activationLink: true },
          },
        )
      }
      setNodes((nds) => [...nds.map((n) => (n.id === stepId ? { ...n, data: { ...n.data, encapsulating: true, macro: false } } : n)), ...created])
    },
    [getNode, getNodes, setNodes, takeSnapshot, updateNodeData],
  )

  const toggleActivationLink = useCallback(
    (stepId) => {
      const step = getNode(stepId)
      if (!step) return
      takeSnapshot()
      updateNodeData(stepId, { activationLink: !step.data.activationLink })
    },
    [getNode, takeSnapshot, updateNodeData],
  )

  const addAction = useCallback(
    (stepId) => {
      const step = getNode(stepId)
      if (!step) return
      takeSnapshot()
      updateNodeData(stepId, { actions: [...(step.data.actions ?? []), normalizeAction('Acción')] })
    },
    [getNode, takeSnapshot, updateNodeData],
  )

  // El borrado pasa por onBeforeDelete, que ya guarda la instantánea para deshacer.
  // Ordenar la selección (lib/align.js): un solo paso de deshacer.
  const arrange = useCallback(
    (nodeIds, how) => {
      const ids = new Set(nodeIds)
      const moves = (how === 'column' ? alignColumn : spaceSequence)(getNodes().filter((n) => ids.has(n.id)))
      if (!moves.size) return
      takeSnapshot()
      setNodes((nds) => nds.map((n) => (moves.has(n.id) ? { ...n, position: moves.get(n.id) } : n)))
    },
    [getNodes, takeSnapshot, setNodes],
  )

  // Separar columnas (lib/spread.js) para que ningún texto pise lo que tiene a su derecha: de la
  // selección o, sin ella, de todo lo visible. Devuelve false si no hacía falta.
  const spread = useCallback(
    (nodeIds = null) => {
      const all = getNodes()
      const ids = new Set(nodeIds ?? all.filter((n) => !n.hidden).map((n) => n.id))
      const boxes = measureBoxes(all.filter((n) => ids.has(n.id)), screenToFlowPosition)
      const next = spreadNodes(all, boxes, spreadFactor(boxes), ids)
      if (next.every((n, i) => n.position.x === all[i].position.x && n.width === all[i].width)) return false
      takeSnapshot()
      setNodes(next)
      return true
    },
    [getNodes, screenToFlowPosition, takeSnapshot, setNodes],
  )

  const remove = useCallback((nodeIds) => deleteElements({ nodes: nodeIds.map((id) => ({ id })) }), [deleteElements])

  return {
    arrange,
    spread,
    addBranch,
    branchesOf,
    predecessorsOf,
    addAlternative,
    converge,
    toggleInitial,
    toggleMacro,
    toggleEncapsulating,
    toggleActivationLink,
    addAction,
    remove,
  }
}
