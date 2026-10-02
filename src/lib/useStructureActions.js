import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { findFreePosition, nextStepLabel, nextTransitionLabel, yBelow } from './layout'
import { useEditor } from './editorContext'
import { defaultEdgeOptions } from './initialDiagram'
import { normalizeAction } from './actions'

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
  const { getNode, getNodes, getEdges, setNodes, setEdges, updateNodeData, deleteElements } = useReactFlow()
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
      updateNodeData(stepId, step.data.macro ? { macro: false } : { macro: true, initial: false })
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
  const remove = useCallback((nodeIds) => deleteElements({ nodes: nodeIds.map((id) => ({ id })) }), [deleteElements])

  return {
    addBranch,
    branchesOf,
    predecessorsOf,
    addAlternative,
    converge,
    toggleInitial,
    toggleMacro,
    addAction,
    remove,
  }
}
