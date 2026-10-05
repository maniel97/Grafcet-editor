// Hoja de prácticas de un ejercicio, o guion con varias prácticas, en PDF (lib/exerciseSheet.js),
// con los archivos de los ejercicios adjuntos (lib/pdfAttach.js). Se hacen a partir de lo que
// recibe el alumnado (studentProject): tabla, planta y esquema del papel son los del archivo de
// dentro. Una práctica guiada lleva además su solución (grafcet, conexionado, ladder y tabla) y el
// proyecto resuelto adjunto.
import { t } from './i18n'
import { isStudent, studentProject, unseal } from './exercise'
import { buildPlcModel } from './plcModel'
import { dossierData, ladderFigure, partFigures } from './dossierContent'
import { loadPdf, makeMeasure, renderDossierPdf } from './dossierPdf'
import { buildExerciseSheet, buildGuide, fingerprint, practiceTitle } from './exerciseSheet'
import { attachFiles } from './pdfAttach'
import { projectJson } from './projectFile'
import { slugify } from './fileNames'

const json = (project) => new TextEncoder().encode(projectJson(project))
// Sin la fecha de guardado: la misma versión del ejercicio da siempre la misma huella.
const printOf = (project) => fingerprint(JSON.stringify({ nodes: project.nodes, edges: project.edges, plc: project.plc }))

// Proyecto (del profesor, con su ejercicio; o ya el del alumnado) -> contenido de la hoja.
// options: { guided, grafcet: [figuras del grafcet capturadas del lienzo], prefix (del adjunto) }
async function practiceContent(project, { guided = false, grafcet = [], prefix = '' } = {}) {
  const student = isStudent(project.plc) ? project : studentProject(project)
  const exercise = student.plc.exercise
  const model = buildPlcModel(student.nodes, student.edges, student.plc)
  const variables = exercise.parts.variables === 'none' ? [] : dossierData({ ...student, issues: [], options: {} }).tables.variables
  // En un guion, sin «Práctica n.»: el número ya va delante («01-posicionador-de-cajas.json»).
  const base = `${prefix}${slugify(prefix ? practiceTitle({ title: exercise.title || student.name }) : exercise.title || student.name) || 'ejercicio'}`
  const content = {
    title: exercise.title,
    sheet: exercise.sheet,
    statement: exercise.statement,
    parts: exercise.parts,
    variables,
    figures: await partFigures(student.plc, model),
    checks: unseal(exercise.sealed),
    attachment: `${base}.json`,
    print: printOf(student),
    grade: exercise.grade,
  }
  const files = [{ name: content.attachment, data: json(student), mime: 'application/json', description: exercise.title || t('Ejercicio') }]
  // Guiada: la solución, en el papel y adjunta (sin la preparación del ejercicio: un proyecto normal).
  if (guided && !isStudent(project.plc)) {
    const { exercise: _omit, ...plc } = project.plc
    const solved = { ...project, plc }
    const teacherModel = buildPlcModel(project.nodes, project.edges, project.plc)
    const tables = dossierData({ ...project, issues: [], options: {} }).tables
    content.solution = {
      grafcet,
      ladder: await ladderFigure(project.nodes, project.edges, project.plc),
      // Como en la tabla del autómata: las variables y, después, las etapas con su marca.
      variables: [...tables.variables, ...tables.steps.map(([name, address, comment]) => [name, t('Etapa'), address, comment])],
    }
    content.figures = await partFigures(project.plc, teacherModel)
    content.solutionAttachment = `${base}-solucion.json`
    content.solutionPrint = printOf(solved)
    files.push({ name: content.solutionAttachment, data: json(solved), mime: 'application/json', description: `${exercise.title || t('Ejercicio')} (${t('solución')})` })
  }
  return { content, files }
}

const finish = (jsPDF, pages, files, properties) => {
  const pdf = renderDossierPdf(jsPDF, pages)
  pdf.setProperties({ creator: 'Grafcet Editor', ...properties })
  return attachFiles(new Uint8Array(pdf.output('arraybuffer')), files)
}

// Proyecto del profesor (con su solución y el ejercicio preparado) -> PDF (bytes).
export async function exerciseSheetPdf(project) {
  const jsPDF = await loadPdf()
  const { content, files } = await practiceContent(project)
  const { pages } = buildExerciseSheet(content, makeMeasure(jsPDF))
  return finish(jsPDF, pages, files, { title: content.title || t('Ejercicio'), subject: t('Hoja de prácticas') })
}

// Guion: { title, sheet, rules, practices: [{ project, guided, grafcet }] } -> PDF (bytes).
export async function guidePdf({ title, sheet, rules, practices }) {
  const jsPDF = await loadPdf()
  const built = []
  for (const [i, p] of practices.entries()) built.push(await practiceContent(p.project, { guided: p.guided, grafcet: p.grafcet, prefix: `${String(i + 1).padStart(2, '0')}-` }))
  const { pages } = buildGuide({ title, sheet, rules, practices: built.map((b) => b.content) }, makeMeasure(jsPDF))
  return finish(
    jsPDF,
    pages,
    built.flatMap((b) => b.files),
    { title: title || t('Guion de prácticas'), subject: t('Guion de prácticas') },
  )
}
