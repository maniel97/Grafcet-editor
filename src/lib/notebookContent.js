// Una práctica del cuaderno (lib/notebook.js) a partir de su proyecto, sin abrirlo en el editor:
// el contenido de su dossier (con sus opciones guardadas), sus figuras y el resumen
// (autocorrección y verificación). El grafcet lo dibuja components/OffscreenGrafcet.jsx.
import { dossierOptions } from './dossier'
import { dossierData, dossierFigures } from './dossierContent'
import { validateGrafcet } from './validation'
import { validatePlc } from './addressing'
import { projectVariables } from './symbols'
import { exerciseConfig, runChecks } from './exercise'
import { normalizeProject, projectJson } from './projectFile'
import { slugify } from './fileNames'

// Título de la práctica: el del ejercicio, el nombre del proyecto o el de su archivo.
export const practiceTitleOf = (project, file = '') =>
  exerciseConfig(project.plc)?.title?.trim() || project.name?.trim() || file.replace(/\.(json|pdf)$/i, '').replace(/[-_]+/g, ' ').trim() || 'Práctica'

// Verificación como en el lienzo (hooks/useVerification.js), sin los consejos.
export function practiceIssues({ nodes, edges, plc }) {
  const steps = nodes.filter((n) => n.type === 'step')
  return [...validateGrafcet(nodes, edges), ...validatePlc(plc, steps, projectVariables(nodes, plc.variables))]
}

// Resumen para la hoja del principio: criterios del ejercicio que se cumplen ahora (total 0 si no
// es un ejercicio) y errores y avisos de la verificación.
export function practiceSummary(project, issues = practiceIssues(project)) {
  const results = exerciseConfig(project.plc) ? runChecks(project) : []
  return {
    passed: results.filter((r) => r.ok).length,
    total: results.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
  }
}

// Las figuras de su dossier (ladder, planta, esquema, cronograma, espacio-fase), con su escenario.
export async function practiceFigures(project) {
  const options = dossierOptions(project.plc.dossier)
  const issues = practiceIssues(project)
  const data = dossierData({ nodes: project.nodes, edges: project.edges, plc: project.plc, issues, options })
  return dossierFigures({ nodes: project.nodes, edges: project.edges, plc: project.plc, scenarioId: options.scenario, model: data.model })
}

// Práctica lista para buildNotebook. grafcet: las figuras de sus hojas; figures: practiceFigures.
export function practiceEntry(project, { grafcet, figures, file = '', today }) {
  const { nodes, edges, plc } = project
  const options = dossierOptions(plc.dossier)
  const issues = practiceIssues(project)
  const data = dossierData({ nodes, edges, plc, issues, options })
  const title = practiceTitleOf(project, file)
  return {
    title,
    summary: practiceSummary(project, issues),
    options,
    content: {
      title,
      today,
      cover: options.cover,
      statement: options.statement,
      theory: options.theory,
      improvements: options.improvements,
      problems: options.problems,
      figures: { ...figures, grafcet },
      tables: data.tables,
      issues: data.issues,
      listing: data.listing,
      notes: data.notes,
      process: plc.exercise?.student && plc.exercise.processData
        ? { ...plc.exercise.process, title: plc.exercise.title, hintsShown: plc.exercise.hintsShown ?? 0, hintsTotal: plc.exercise.hints?.count ?? 0 }
        : null,
    },
  }
}

// Proyecto guardado (archivo, trabajo anterior o el abierto) -> el del cuaderno, normalizado.
export const notebookProject = (project) => normalizeProject(project)
// El proyecto que va dentro del PDF, con lo que falte en la portada de su dossier tomado de la del
// cuaderno (el nombre del alumno, sobre todo: así «Corregir entregas» sabe de quién es).
export function withNotebookCover(project, cover) {
  const own = project.plc.dossier?.cover ?? {}
  const merged = { ...own }
  for (const [k, v] of Object.entries(cover)) if (!own[k]?.trim() && v?.trim()) merged[k] = v
  return { ...project, plc: { ...project.plc, dossier: { ...project.plc.dossier, cover: merged } } }
}

// Su adjunto en el PDF: 01-semaforo.json…
export function practiceAttachment(project, index, title) {
  const slug = slugify(title).slice(0, 40) || 'practica'
  return {
    name: `${String(index + 1).padStart(2, '0')}-${slug}.json`,
    data: new TextEncoder().encode(projectJson(project)),
    mime: 'application/json',
    description: `Práctica nº ${index + 1}: ${title} (se abre en el editor de Grafcet)`,
  }
}
