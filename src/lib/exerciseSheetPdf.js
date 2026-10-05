// Hoja de prácticas del ejercicio en PDF (lib/exerciseSheet.js), con el archivo del ejercicio
// adjunto (lib/pdfAttach.js). Se hace a partir de lo que recibe el alumnado (studentProject):
// tabla, planta y esquema del papel son los del archivo de dentro.
import { t } from './i18n'
import { studentProject, unseal } from './exercise'
import { buildPlcModel } from './plcModel'
import { dossierData, partFigures } from './dossierContent'
import { loadPdf, makeMeasure, renderDossierPdf } from './dossierPdf'
import { buildExerciseSheet, fingerprint } from './exerciseSheet'
import { attachFile } from './pdfAttach'
import { projectJson } from './projectFile'
import { slugify } from './fileNames'

// Proyecto del profesor (con su solución y el ejercicio preparado) -> PDF (bytes).
export async function exerciseSheetPdf(project) {
  const student = studentProject(project)
  const exercise = student.plc.exercise
  const model = buildPlcModel(student.nodes, student.edges, student.plc)
  const variables = exercise.parts.variables === 'none' ? [] : dossierData({ ...student, issues: [], options: {} }).tables.variables
  const figures = await partFigures(student.plc, model)
  const jsPDF = await loadPdf()
  const json = projectJson(student)
  const attachment = `${slugify(exercise.title || student.name) || 'ejercicio'}.json`
  const { pages } = buildExerciseSheet(
    {
      title: exercise.title,
      sheet: exercise.sheet,
      statement: exercise.statement,
      parts: exercise.parts,
      variables,
      figures,
      checks: unseal(exercise.sealed),
      attachment,
      // Sin la fecha de guardado: la misma versión del ejercicio da siempre la misma huella.
      print: fingerprint(JSON.stringify({ nodes: student.nodes, edges: student.edges, plc: student.plc })),
    },
    makeMeasure(jsPDF),
  )
  const pdf = renderDossierPdf(jsPDF, pages)
  pdf.setProperties({ title: exercise.title || t('Ejercicio'), subject: t('Hoja de prácticas'), creator: 'Grafcet Editor' })
  return attachFile(new Uint8Array(pdf.output('arraybuffer')), {
    name: attachment,
    data: new TextEncoder().encode(json),
    mime: 'application/json',
    description: t('Ejercicio para abrir en el editor de Grafcet'),
  })
}
