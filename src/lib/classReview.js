// Corregir las entregas de una clase (ejercicios, fase 4). Puro: se prueba sin navegador.
//
// Cada entrega es el proyecto del alumno (dentro del PDF de su dossier, o un .json). Se vuelve a
// corregir con las comprobaciones del ejercicio del profesor (si lo tiene abierto), no con las que
// trae el archivo: así no cuenta si alguien las ha tocado. Además se buscan grafcets
// sospechosamente parecidos entre sí (mismo dibujo, mismas posiciones) para que el profesor los
// mire: es un aviso, no una prueba.
import { t } from './i18n'
import { isStudent, runChecks, studentProject } from './exercise'
import { gradeOf } from './requirements'
import { normalizeAction } from './actions'

// Nombre del alumno: el de la portada del dossier, el del cajetín o, si no, el del archivo.
export const studentName = (project, file = '') =>
  project.plc?.dossier?.cover?.student?.trim() || project.plc?.titleBlock?.author?.trim() || file.replace(/\.(json|pdf)$/i, '').replace(/[-_]+/g, ' ')

// Proyecto del profesor con su ejercicio -> la versión sellada de sus comprobaciones (para
// corregir con ellas), o null si no hay ejercicio del profesor abierto.
export function teacherSealed(project) {
  if (!project?.plc?.exercise || isStudent(project.plc)) return null
  return studentProject(project).plc.exercise
}

// Una entrega -> fila de la tabla. teacher: lo que da teacherSealed (o null: sus propias
// comprobaciones, avisándolo).
export function reviewSubmission(project, file, teacher) {
  const own = project.plc?.exercise
  if (!own) return { file, name: studentName(project, file), error: t('No es un ejercicio: no se puede corregir.') }
  const exercise = teacher ? { ...own, sealed: teacher.sealed, grade: teacher.grade, title: teacher.title } : own
  const plc = { ...project.plc, exercise: { ...exercise, student: true } }
  const results = runChecks({ ...project, plc })
  const passed = results.filter((r) => r.ok).length
  const hintsShown = Number(own.hintsShown) || 0
  return {
    file,
    name: studentName(project, file),
    // Otro ejercicio (otro título): se corrige igual, pero se avisa.
    otherExercise: Boolean(teacher && own.title && teacher.title && own.title !== teacher.title),
    ownChecks: !teacher,
    results,
    passed,
    total: results.length,
    hintsShown,
    grade: exercise.grade?.enabled ? gradeOf(results, exercise.grade, hintsShown) : null,
    process: own.processData ? own.process ?? {} : null,
    features: featuresOf(project),
  }
}

// --- Parecidos ----------------------------------------------------------------------------------

const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
// Rasgos del grafcet: receptividades, acciones (con su tipo) y la posición de cada etapa y
// transición en el lienzo. Dos trabajos hechos por separado suelen coincidir en lo primero (el
// ejercicio es el mismo) pero casi nunca en lo último: un dibujo copiado, sí.
export function featuresOf(project) {
  const nodes = (project.nodes ?? []).filter((n) => n.type === 'step' || n.type === 'transition')
  const logic = new Set()
  const places = new Set()
  for (const n of nodes) {
    if (n.type === 'transition') logic.add(`t:${norm(n.data?.condition)}`)
    else for (const a of (n.data?.actions ?? []).map(normalizeAction)) logic.add(`a:${a.kind}:${norm(a.text)}:${norm(a.condition)}`)
    places.add(`${n.type}@${Math.round(n.position?.x ?? 0)},${Math.round(n.position?.y ?? 0)}`)
  }
  return { logic: [...logic], places: [...places], size: nodes.length }
}

const jaccard = (a, b) => {
  if (!a.length && !b.length) return 0
  const sb = new Set(b)
  const both = a.filter((x) => sb.has(x)).length
  return both / (a.length + b.length - both)
}

// Parejas sospechosas: el mismo dibujo (posiciones casi iguales) con la misma lógica.
// -> [{ a, b (índices), places, logic }] de más a menos parecidas.
export function similarPairs(rows, { places = 0.8, logic = 0.8 } = {}) {
  const pairs = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const fa = rows[i].features
      const fb = rows[j].features
      if (!fa || !fb || fa.size < 3 || fb.size < 3) continue
      const p = jaccard(fa.places, fb.places)
      const l = jaccard(fa.logic, fb.logic)
      if (p >= places && l >= logic) pairs.push({ a: i, b: j, places: p, logic: l })
    }
  }
  return pairs.sort((x, y) => y.places + y.logic - (x.places + x.logic))
}

// --- CSV ----------------------------------------------------------------------------------------

// Tabla -> CSV para una hoja de cálculo (punto y coma y BOM: Excel en español lo abre bien).
export function classCsv(rows, pairs = []) {
  const titles = []
  for (const r of rows) for (const c of r.results ?? []) if (!titles.includes(c.title)) titles.push(c.title)
  const hasGrade = rows.some((r) => r.grade != null)
  const hasProcess = rows.some((r) => r.process)
  const head = [t('Alumno/a'), t('Archivo'), t('Correctas'), t('Total'), ...titles, t('Pistas vistas')]
  if (hasGrade) head.push(t('Nota'))
  if (hasProcess) head.push(t('Comprobaciones'), t('Minutos activos'), t('Simulaciones'))
  head.push(t('Parecido a'), t('Avisos'))
  const num = (v) => String(v).replace('.', ',')
  const lines = rows.map((r, i) => {
    const similar = pairs.filter((p) => p.a === i || p.b === i).map((p) => rows[p.a === i ? p.b : p.a].name)
    const notes = [r.error, r.otherExercise && t('Es de otro ejercicio'), r.ownChecks && t('Corregido con sus propias comprobaciones')].filter(Boolean)
    const cells = [r.name, r.file, r.error ? '' : r.passed, r.error ? '' : r.total]
    for (const title of titles) {
      const c = r.results?.find((x) => x.title === title)
      cells.push(c ? (c.ok ? t('sí') : t('no')) : '')
    }
    cells.push(r.hintsShown ?? '')
    if (hasGrade) cells.push(r.grade == null ? '' : num(r.grade))
    if (hasProcess) cells.push(r.process?.checks ?? '', r.process?.minutes ?? '', r.process?.simulations ?? '')
    cells.push(similar.join(', '), notes.join('; '))
    return cells
  })
  const cell = (v) => {
    const s = String(v ?? '')
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return `﻿${[head, ...lines].map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`
}
