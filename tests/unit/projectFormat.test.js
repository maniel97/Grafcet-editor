// Formato del archivo de proyecto (docs/formato-proyecto.md, lib/projectFormat.js).
//
// - Proyectos de referencia en tests/fixtures/formato/: uno por versión del editor (lo guarda
//   `npm run formato:guardar` al sacar una versión) y los de formatos antiguos. Cada uno tiene que
//   seguir abriéndose igual: mismo contenido (su .resumen.json), conforme a la norma y simulable.
// - Todo lo que se guarda está documentado: los campos de los proyectos (referencia, ejemplos,
//   ejercicios, guiones y los de las pruebas) tienen que estar en la lista del documento.
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { keyPaths } from './formatKeys'
import { FORMAT_VERSION, MIGRATIONS, checkFormat, formatVersion } from '../../src/lib/projectFormat'
import { loadProjects, normalizeProject, projectJson } from '../../src/lib/projectFile'
import { EXAMPLES } from '../../src/lib/examples'
import { EXERCISES, exerciseForStudent } from '../../src/lib/exercises'
import { PRACTICE_GUIDES } from '../../src/lib/practiceGuides'
import { DEFAULT_DOSSIER } from '../../src/lib/dossier'
import { TYPICAL_GEMMA } from '../../src/lib/gemma'
import { validateGrafcet } from '../../src/lib/validation'
import { buildPlcModel } from '../../src/lib/plcModel'
import { compile } from '../../src/lib/sim/engine'
import { generateLadder } from '../../src/lib/ladder/generate'
import { VERSION } from '../../src/lib/about'

const DIR = 'tests/fixtures/formato'
const DOC = 'docs/formato-proyecto.md'

// Proyecto de referencia: una práctica completa (grafcet, tabla, planta, esquema eléctrico,
// escenarios, ejercicio) con todo lo demás que puede llevar un proyecto (hojas, notas, la tabla en
// el lienzo, cajetín, dosier, guion, GEMMA, autómata, secuencia esperada).
function referenceProject() {
  const practice = PRACTICE_GUIDES[0].practices.find((p) => p.id === 'p4')
  const base = normalizeProject(practice.teacher())
  const nodes = base.nodes.map((n) => ({ ...n, data: { ...n.data, sheet: 'h1' } }))
  nodes.push(
    { id: 'nota-1', type: 'note', position: { x: 0, y: 0 }, width: 220, height: 110, data: { text: '# Notas\n- Paro de emergencia: `Emergencia`', color: 'yellow', sheet: 'h2' } },
  )
  // La tabla de variables en el lienzo (la práctica ya la trae; si no, se añade).
  if (!nodes.some((n) => n.type === 'variables')) nodes.push({ id: 'variables-table', type: 'variables', position: { x: 600, y: 0 }, deletable: false, data: { showComments: true, sheet: 'h1' } })
  return {
    name: 'Proyecto de referencia del formato',
    nodes,
    edges: base.edges,
    viewport: { x: 0, y: 0, zoom: 1 },
    plc: {
      ...base.plc,
      showAddresses: true,
      stepPrefix: 'M',
      sequence: 'A+ A-',
      sheets: [
        { id: 'h1', name: 'Hoja 1' },
        { id: 'h2', name: 'Notas' },
      ],
      titleBlock: { company: 'IES de prueba', project: 'Cinta', author: 'Profesorado', revision: 'A', date: '2026-10-12', drawing: 'P-01' },
      dossier: { ...DEFAULT_DOSSIER, cover: { student: 'Alumno', group: '1º' }, statement: 'Enunciado.' },
      guide: { title: 'Guion de prueba', sheet: { subject: 'Automatismos', course: '', cycle: '', center: '', teacher: '' }, rules: 'Normas.', practices: [{ id: 'current' }], currentGuided: false },
      gemma: TYPICAL_GEMMA,
      cpu: { enabled: false, source: 'generated', text: '', name: '' },
    },
  }
}

// Lo que no puede perderse al abrir: contenido del grafcet, variables y secciones del proyecto.
function summary(project) {
  const { nodes, edges, plc } = project
  const types = {}
  for (const n of nodes) types[n.type] = (types[n.type] ?? 0) + 1
  const steps = nodes.filter((n) => n.type === 'step')
  return {
    nodes: types,
    edges: edges.length,
    steps: steps.map((n) => `${n.data.label}${n.data.initial ? '*' : ''}`).sort(),
    actions: steps.flatMap((n) => (n.data.actions ?? []).map((a) => (typeof a === 'string' ? a : `${a.kind}:${a.text}${a.condition ? `[${a.condition}]` : ''}`))).sort(),
    conditions: nodes
      .filter((n) => n.type === 'transition')
      .map((n) => n.data.condition)
      .sort(),
    variables: Object.entries(plc.variables ?? {})
      .map(([name, v]) => `${name}:${v.type ?? ''}:${v.address ?? ''}`)
      .sort(),
    plc: Object.keys(plc).sort(),
    scene: plc.scene?.elements?.length ?? 0,
    electrical: [plc.electrical?.components?.length ?? 0, plc.electrical?.wires?.length ?? 0],
    scenarios: (plc.scenarios ?? []).map((s) => s.name),
    exercise: plc.exercise?.title ?? null,
    sheets: (plc.sheets ?? []).map((s) => s.id),
  }
}

const fixtures = () => (existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.endsWith('.resumen.json')) : [])
const read = (file) => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8'))

describe('formato del proyecto', () => {
  // npm run formato:guardar (al sacar una versión): el proyecto de referencia, guardado como lo
  // guarda el editor, y su resumen.
  it.runIf(process.env.FORMATO_GUARDAR)('guarda el proyecto de referencia de esta versión', () => {
    mkdirSync(DIR, { recursive: true })
    const project = referenceProject()
    writeFileSync(`${DIR}/${VERSION}.json`, projectJson(project) + '\n')
    writeFileSync(`${DIR}/${VERSION}.resumen.json`, JSON.stringify(summary(normalizeProject(project)), null, 2) + '\n')
  })

  it('el proyecto de referencia es conforme, se simula y pasa a ladder', () => {
    const project = normalizeProject(referenceProject())
    expect(validateGrafcet(project.nodes, project.edges).filter((i) => i.severity === 'error')).toEqual([])
    expect(compile(buildPlcModel(project.nodes, project.edges, project.plc)).errors).toEqual([])
    expect(() => generateLadder(project.nodes, project.edges, project.plc)).not.toThrow()
  })

  it('hay proyectos de referencia guardados (de esta versión y de formatos antiguos)', () => {
    expect(fixtures().length).toBeGreaterThan(1)
  })

  for (const file of fixtures()) {
    it(`${file} se sigue abriendo igual`, () => {
      const raw = read(file)
      expect(() => checkFormat(raw)).not.toThrow()
      const project = normalizeProject(raw)
      expect(project).not.toBeNull()
      expect(summary(project)).toEqual(read(file.replace(/\.json$/, '.resumen.json')))
      expect(validateGrafcet(project.nodes, project.edges).filter((i) => i.severity === 'error')).toEqual([])
      expect(compile(buildPlcModel(project.nodes, project.edges, project.plc)).errors).toEqual([])
      expect(() => generateLadder(project.nodes, project.edges, project.plc)).not.toThrow()
    })
  }

  it('una migración por cada versión del formato anterior a la actual', () => {
    expect(MIGRATIONS).toHaveLength(FORMAT_VERSION - 1)
  })

  it('sin número de versión es el formato 1; uno más nuevo se rechaza con un aviso claro', async () => {
    expect(formatVersion({ nodes: [], edges: [] })).toBe(1)
    expect(formatVersion({ version: 'x' })).toBe(1)
    const newer = { format: 'grafcet-editor', version: FORMAT_VERSION + 1, nodes: [], edges: [] }
    expect(() => checkFormat(newer)).toThrow(/versión más nueva del editor/)
    const file = new File([JSON.stringify(newer)], 'nuevo.json', { type: 'application/json' })
    await expect(loadProjects(file)).rejects.toThrow(/versión más nueva del editor/)
  })

  it('el archivo guardado lleva el formato, su versión y la del editor', () => {
    const saved = JSON.parse(projectJson(referenceProject()))
    expect(saved).toMatchObject({ format: 'grafcet-editor', version: FORMAT_VERSION, app: VERSION })
  })

  it('todo lo que se guarda está documentado en docs/formato-proyecto.md', () => {
    const doc = readFileSync(DOC, 'utf8')
    const block = /```campos\n([\s\S]*?)```/.exec(doc)
    expect(block, 'el documento lleva la lista de campos en un bloque ```campos').not.toBeNull()
    const documented = new Set(block[1].split('\n').map((l) => l.trim()).filter(Boolean))
    const found = new Set()
    const add = (p) => p && keyPaths(p).forEach((k) => found.add(k))
    add(JSON.parse(projectJson(referenceProject())))
    for (const file of fixtures()) add(read(file))
    for (const ex of EXAMPLES) add(normalizeProject(ex.build()))
    for (const ex of EXERCISES) {
      add(ex.teacher())
      add(exerciseForStudent(ex))
    }
    for (const guide of PRACTICE_GUIDES) for (const p of guide.practices) add(p.teacher())
    for (const f of readdirSync('tests/e2e/fixtures')) if (f.endsWith('.json')) add(JSON.parse(readFileSync(`tests/e2e/fixtures/${f}`, 'utf8')))
    expect([...found].filter((k) => !documented.has(k)).sort()).toEqual([])
    // Construye todos los ejemplos, ejercicios y guiones: aquí tarda unos 3 s, en GitHub más de 5.
  }, 30_000)
})
