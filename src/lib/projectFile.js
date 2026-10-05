// Guardado y carga de proyectos como .json local, sin servidor.

import { EMPTY_PLC } from './addressing'
import { fixAssignmentKind } from './actions'
import { fileName } from './fileNames'
import { sceneFromPlant } from './sim/scene'
import { t } from './i18n'
import { attachmentsOf, isPdf } from './pdfAttach'

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
export const projectJson = ({ nodes, edges, viewport, plc, name }) =>
  JSON.stringify({ format: FORMAT, version: VERSION, savedAt: new Date().toISOString(), name, nodes, edges, viewport, plc }, null, 2)

export function saveProject(project, filename = fileName('json')) {
  downloadFile(projectJson(project), filename, 'application/json')
}

// Un .json, o un PDF que lleve un proyecto adjunto (la hoja de un ejercicio: lib/exerciseSheet.js).
// Si el archivo trae varios (un guion de prácticas), el primero; para elegir, loadProjects.
export async function loadProject(file) {
  return (await loadProjects(file))[0].project
}

// Todos los proyectos de un archivo: [{ file (nombre del adjunto), project }] (un .json da uno).
export async function loadProjects(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let raw
  if (isPdf(bytes)) {
    raw = attachmentsOf(bytes)
      .filter((a) => a.name.toLowerCase().endsWith('.json'))
      .map((a) => {
        try {
          return { file: a.name, project: JSON.parse(new TextDecoder().decode(a.data)) }
        } catch {
          return null
        }
      })
      .filter(Boolean)
    if (!raw.length) throw new Error(t('Este PDF no lleva dentro ningún proyecto ni ejercicio de Grafcet.'))
  } else {
    try {
      raw = [{ file: file.name, project: JSON.parse(new TextDecoder().decode(bytes)) }]
    } catch {
      throw new Error('El archivo no es un JSON válido.')
    }
  }
  const found = raw.map((r) => ({ file: r.file, project: normalizeProject(r.project) })).filter((r) => r.project)
  if (!found.length) throw new Error('El archivo no contiene un proyecto Grafcet.')
  return found.sort((a, b) => a.file.localeCompare(b.file))
}

// Valida y adapta al formato actual un proyecto leído (de archivo o del autoguardado).
// Devuelve null si no tiene forma de proyecto.
// Planta por elementos de versiones anteriores (plc.plant) -> escena (plc.scene).
function migratePlant(plc) {
  if (!plc.plant) return plc
  const { plant, ...rest } = plc
  return plant.length && !rest.scene?.elements?.length ? { ...rest, scene: sceneFromPlant(plant) } : rest
}

export function normalizeProject(project) {
  if (!project || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) return null
  const { nodes, edges } = migrateActionNodes(project.nodes, project.edges)
  return {
    nodes: nodes.map(normalizeNode),
    edges: edges.map(normalizeEdge),
    viewport: project.viewport,
    name: typeof project.name === 'string' ? project.name : undefined,
    plc: project.plc ? migratePlant({ ...EMPTY_PLC, ...project.plc }) : EMPTY_PLC,
  }
}

// Versiones anteriores usaban el enlace genérico "step" de React Flow; ahora todos son Grafcet.
function normalizeEdge(edge) {
  return { ...edge, type: 'grafcet', selected: false }
}

function normalizeNode(node) {
  const n = { ...node, selected: false }
  // Asignaciones guardadas como continuas (no hacían nada): memorizadas al activar.
  if (n.type === 'step') n.data = { ...n.data, actions: (n.data?.actions ?? []).map(fixAssignmentKind) }
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
