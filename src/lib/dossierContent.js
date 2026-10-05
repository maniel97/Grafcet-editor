// Contenido del dossier (lib/dossier.js) a partir del proyecto: tablas, verificación, listados y
// figuras. Las figuras SVG (ladder, planta, cronograma) se dibujan fuera de la pantalla para
// capturar su escena vectorial y una imagen para la vista previa.
import { createElement } from 'react'
import LadderDiagram from '../components/LadderDiagram'
import Chronogram from '../components/Chronogram'
import SpacePhase from '../components/SpacePhase'
import { compareSpacePhase, theoreticalSpacePhase } from './sim/spacePhase'
import { scenarioMotion } from './sim/scenarioMotion'
import { parseSequence } from './pneumatic'
import { SceneStatic } from '../components/SceneView'
import ElecStatic from '../components/elec/ElecStatic'
import { elecSheetsOf, sheetOfComponent } from './elec/sheet'
import { buildPlcModel } from './plcModel'
import { describeRange } from './analog'
import { generateLadder } from './ladder/generate'
import { toAWL, toStructuredText } from './ladder/exportText'
import { toS7200 } from './ladder/exportS7200'
import { SCENE_TYPES, sceneIO } from './sim/scene'
import { compile, evolve, initialState } from './sim/engine'
import { advanceWithEvents } from './sim/scenario'
import { sampleOf } from './sim/useSimulation'
import { captureSvgScene } from './vectorPdf'
import { rasterize, svgText } from './svgExport'

// Figura a partir del marcado de un SVG: se monta fuera de la pantalla, se captura y se quita.
export async function figureFromMarkup(markup, name) {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-30000px;top:0;pointer-events:none'
  host.innerHTML = markup
  document.body.appendChild(host)
  try {
    const svg = host.querySelector('svg')
    if (!svg) return null
    const width = Number(svg.getAttribute('width'))
    const height = Number(svg.getAttribute('height'))
    const scene = captureSvgScene(svg)
    const blocks = [...svg.querySelectorAll('[data-block-top]')].map((g) => ({ top: Number(g.dataset.blockTop), bottom: Number(g.dataset.blockBottom) }))
    const dataUrl = await rasterize(svgText(svg), width, height, 2)
    return { dataUrl, width, height, scene, blocks: blocks.length ? blocks : undefined, name }
  } finally {
    host.remove()
  }
}

// Muestras del cronograma de un escenario (como las de la simulación en tiempo real).
export function scenarioSamples(compiled, scenario, dt = 0.05) {
  const inputs = {}
  for (const v of compiled.variables) {
    if (v.type === 'input') inputs[v.name] = 0
    if (v.type === 'analogIn') inputs[v.name] = v.analog?.min ?? 0
  }
  let state = evolve(compiled, initialState(compiled), inputs, 0).state
  let current = inputs
  let next = 0
  const samples = [{ t: 0, values: sampleOf(compiled, state) }]
  const end = scenario.duration ?? (scenario.events.at(-1)?.t ?? 0) + 1
  for (let t = dt; t <= end + 1e-9; t = Math.round((t + dt) * 1e6) / 1e6) {
    const r = advanceWithEvents(compiled, state, current, t, scenario, next)
    ;({ state, next } = r)
    current = r.inputs
    const sample = sampleOf(compiled, state)
    const last = samples.at(-1).values
    if (Object.keys(sample).some((k) => sample[k] !== last[k])) samples.push({ t, values: sample })
  }
  return { samples, duration: end }
}

const LISTING_TITLES = { st: 'Texto estructurado (ST)', awl: 'AWL / STL (S7)', s7200: 'STL S7-200 (Micro/WIN)' }

// Todo lo que no es el dibujo del grafcet (que lo captura el lienzo): rápido, sin figuras.
export function dossierData({ nodes, edges, plc, issues, options }) {
  const model = buildPlcModel(nodes, edges, plc)
  const variables = model.variables.map((v) => [
    v.name,
    v.typeLabel,
    v.address || '—',
    [v.comment, v.analog ? describeRange(plc.variables?.[v.name]) : ''].filter(Boolean).join(' · '),
  ])
  const steps = model.steps.map((s) => [`${s.variable}${s.initial ? ' (inicial)' : ''}`, s.address || '—', plc.steps?.[s.id]?.comment ?? ''])
  const scene = plc.scene
  const plantIO = scene?.elements?.length
    ? sceneIO(scene, model.variables).signals.map((sig) => [
        sig.name,
        sig.address || '—',
        sig.dir === 'out' ? 'salida → planta' : 'entrada ← planta',
        sig.elements
          .map((id) => {
            const e = scene.elements.find((x) => x.id === id)
            return e ? `${SCENE_TYPES[e.type]?.label ?? e.type} ${e.text || ''}`.trim() : id
          })
          .join(', '),
      ])
    : []
  let listing = null
  if (options.ladderListing) {
    const ladder = generateLadder(nodes, edges, plc)
    const text =
      options.ladderListing === 'st'
        ? toStructuredText(ladder, plc)
        : options.ladderListing === 'awl'
          ? toAWL(ladder, { mnemonic: 'de', useAddresses: true })
          : toS7200(ladder, plc, { title: '' }).text
    listing = { title: LISTING_TITLES[options.ladderListing], lines: text.split(/\r?\n/) }
  }
  const notes = nodes.filter((n) => n.type === 'note' && n.data?.text?.trim()).map((n) => n.data.text)
  return { model, tables: { variables, steps, plantIO }, issues, listing, notes }
}

// Figuras de la planta ({ plant }) y del esquema eléctrico ({ electrical: [una por hoja con algo
// dibujado] }); también para la hoja del ejercicio (lib/exerciseSheetPdf.js).
export async function partFigures(plc, model) {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const figures = {}
  if (plc.scene?.elements?.length) {
    figures.plant = await figureFromMarkup(renderToStaticMarkup(createElement(SceneStatic, { scene: plc.scene, variables: model.variables })))
  }
  const elec = plc.electrical
  if (elec?.components?.length) {
    const info = { project: plc.titleBlock?.project || '', author: plc.titleBlock?.author ?? '', company: plc.titleBlock?.company ?? '', date: plc.titleBlock?.date ?? '' }
    figures.electrical = []
    for (const s of elecSheetsOf(elec)) {
      if (!elec.components.some((c) => sheetOfComponent(elec, c) === s.id)) continue
      const fig = await figureFromMarkup(renderToStaticMarkup(createElement(ElecStatic, { schematic: elec, sheetId: s.id, info })), s.name)
      if (fig) figures.electrical.push(fig)
    }
  }
  return figures
}

// Figuras SVG: ladder, planta y cronograma (el del escenario elegido).
export async function dossierFigures({ nodes, edges, plc, scenarioId, model }) {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const figures = {}
  const ladder = generateLadder(nodes, edges, plc)
  figures.ladder = await figureFromMarkup(renderToStaticMarkup(createElement(LadderDiagram, { ladder, mode: 'both' })))
  Object.assign(figures, await partFigures(plc, model))
  const scenarios = plc.scenarios ?? []
  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0]
  if (scenario) {
    const compiled = compile(model)
    const { samples, duration } = scenarioSamples(compiled, scenario)
    const signals = [
      ...compiled.steps.map((s) => ({ name: s.variable, color: '#0f172a' })),
      ...compiled.variables.filter((v) => v.type === 'input').map((v) => ({ name: v.name, color: '#2563eb' })),
      ...compiled.variables.filter((v) => v.type === 'output').map((v) => ({ name: v.name, color: '#16a34a' })),
    ]
    const span = Math.max(duration, 1)
    const width = Math.round(Math.min(1400, Math.max(600, 72 + span * 30)))
    const markup = renderToStaticMarkup(createElement(Chronogram, { samples, signals, now: span, window: span, width, standalone: true }))
    figures.chronogram = await figureFromMarkup(markup, scenario.name)
  }
  Object.assign(figures, await spacePhaseFigures(plc, scenario, model, renderToStaticMarkup))
  return figures
}

// Figuras del diagrama espacio-fase para el dossier: el esperado (plc.sequence) y el de la planta
// con el escenario elegido, más el resultado de compararlos.
async function spacePhaseFigures(plc, scenario, model, renderToStaticMarkup) {
  const parsed = plc.sequence?.trim() ? parseSequence(plc.sequence) : null
  const expected = parsed && !parsed.errors.length ? theoreticalSpacePhase(parsed.groups) : null
  const recorded = scenarioMotion(plc, scenario, model)
  const figs = []
  const draw = async (diagram, name, extra = {}) => {
    const width = Math.round(Math.min(1400, Math.max(480, 64 + diagram.phases.length * 70)))
    const markup = renderToStaticMarkup(createElement(SpacePhase, { diagram, width, standalone: true, signals: true, ...extra }))
    const fig = await figureFromMarkup(markup, name)
    if (fig) figs.push(fig)
  }
  if (expected) await draw(expected, `Esperado: ${plc.sequence.trim()}`)
  if (recorded) await draw(recorded, `Con la planta (escenario «${scenario.name}»)`, { expected })
  if (!figs.length) return {}
  const result = compareSpacePhase(recorded, expected)
  const text = !result
    ? null
    : result.ok
      ? 'Lo que hace la planta coincide con la secuencia esperada.'
      : result.got
        ? `Fase ${result.phase}: se esperaba ${result.expected.join(' ')} y la planta ha hecho ${result.got.join(' ')}.`
        : `Fase ${result.phase}: se esperaba ${result.expected.join(' ')} y el escenario acaba antes.`
  return { spacePhase: figs, spacePhaseResult: text }
}

export { scenarioMotion }
