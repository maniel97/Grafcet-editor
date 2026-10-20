// Guardado y carga de proyectos como .json local, sin servidor.

import { EMPTY_PLC } from './addressing'
import { fileName } from './fileNames'
import { t } from './i18n'
import { attachmentsOf, isPdf } from './pdfAttach'
import { FORMAT, FORMAT_VERSION, checkFormat, migrateProject } from './projectFormat'
import { importPcSimu, isPcSimu } from './pcsimuImport'
import { VERSION as APP_VERSION } from './about'

export function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.download = filename
  a.href = url
  a.click()
  URL.revokeObjectURL(url)
}

// Formato del archivo: docs/formato-proyecto.md (y lib/projectFormat.js). `app`: versión del editor
// que lo guardó (informativa; para abrirlo cuenta `version`, la del formato).
export const projectJson = ({ nodes, edges, viewport, plc, name }) =>
  JSON.stringify({ format: FORMAT, version: FORMAT_VERSION, app: APP_VERSION, savedAt: new Date().toISOString(), name, nodes, edges, viewport, plc }, null, 2)

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
  // Un panel o una planta de PC_SIMU: la planta virtual, con su tabla de variables (lib/pcsimuImport.js).
  if (isPcSimu(bytes)) {
    const { project, warnings, skipped } = importPcSimu(new TextDecoder('windows-1252').decode(bytes))
    return [{ file: file.name, project: normalizeProject(project), pcsimu: { warnings, skipped } }]
  }
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
  for (const r of raw) checkFormat(r.project)
  const found = raw.map((r) => ({ file: r.file, project: normalizeProject(r.project) })).filter((r) => r.project)
  if (!found.length) throw new Error('El archivo no contiene un proyecto Grafcet.')
  return found.sort((a, b) => a.file.localeCompare(b.file))
}

// Valida y adapta al formato actual un proyecto leído (de archivo, del autoguardado, de un enlace
// o de un ejemplo). Devuelve null si no tiene forma de proyecto. Las migraciones de formatos
// anteriores están en lib/projectFormat.js.
export function normalizeProject(project) {
  if (!project || !Array.isArray(project.nodes) || !Array.isArray(project.edges)) return null
  const { nodes, edges, plc } = migrateProject(project)
  return {
    nodes: nodes.map((n) => ({ ...n, selected: false })),
    edges: edges.map((e) => ({ ...e, selected: false })),
    viewport: project.viewport,
    name: typeof project.name === 'string' ? project.name : undefined,
    plc: plc ? { ...EMPTY_PLC, ...plc } : EMPTY_PLC,
  }
}
