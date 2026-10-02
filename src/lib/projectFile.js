// Guardado y carga de proyectos como .json local, sin servidor.

import { EMPTY_PLC } from './addressing'
import { fileName } from './fileNames'

const FORMAT = 'grafcet-editor'
const VERSION = 1

export function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.download = filename
  a.href = url
  a.click()
  URL.revokeObjectURL(url)
}

// `plc` es la tabla de variables (lib/addressing.js); viaja dentro del mismo proyecto.
export function saveProject({ nodes, edges, viewport, plc, name }, filename = fileName('json')) {
  const project = { format: FORMAT, version: VERSION, savedAt: new Date().toISOString(), name, nodes, edges, viewport, plc }
  downloadFile(JSON.stringify(project, null, 2), filename, 'application/json')
}

export async function loadProject(file) {
  let project
  try {
    project = JSON.parse(await file.text())
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  const normalized = normalizeProject(project)
  if (!normalized) throw new Error('El archivo no contiene un proyecto Grafcet.')
  return normalized
}

// Valida y adapta al formato actual un proyecto leído (de archivo o del autoguardado).
// Devuelve null si no tiene forma de proyecto.
export function normalizeProject(project) {
  if (!project || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) return null
  const { nodes, edges } = migrateActionNodes(project.nodes, project.edges)
  return {
    nodes: nodes.map(normalizeNode),
    edges: edges.map(normalizeEdge),
    viewport: project.viewport,
    name: typeof project.name === 'string' ? project.name : undefined,
    plc: project.plc ? { ...EMPTY_PLC, ...project.plc } : EMPTY_PLC,
  }
}

// Versiones anteriores usaban el enlace genérico "step" de React Flow; ahora todos son Grafcet.
function normalizeEdge(edge) {
  return { ...edge, type: 'grafcet', selected: false }
}

function normalizeNode(node) {
  const n = { ...node, selected: false }
  if (n.type === 'step') n.data = { ...n.data, actions: n.data?.actions ?? [] }
  return n
}

// Proyectos de la primera versión guardaban las acciones como nodos sueltos
// unidos a la etapa; se convierten en acciones de esa etapa.
function migrateActionNodes(nodes, edges) {
  const actionIds = new Set(nodes.filter((n) => n.type === 'action').map((n) => n.id))
  if (actionIds.size === 0) return { nodes, edges }

  const actionsByStep = {}
  for (const e of edges) {
    if (actionIds.has(e.target)) {
      const action = nodes.find((n) => n.id === e.target)
      ;(actionsByStep[e.source] ??= []).push(action.data?.label ?? '')
    }
  }

  return {
    nodes: nodes
      .filter((n) => !actionIds.has(n.id))
      .map((n) =>
        actionsByStep[n.id]
          ? { ...n, data: { ...n.data, actions: [...(n.data?.actions ?? []), ...actionsByStep[n.id]] } }
          : n,
      ),
    edges: edges.filter((e) => !actionIds.has(e.source) && !actionIds.has(e.target)),
  }
}
