// Proyecto nuevo (Abrir > Nuevo…): título, autómata, cómo empezar y la tabla de variables en el
// lienzo. Las elecciones (salvo el título y el enunciado) se recuerdan para la próxima vez.

import { EMPTY_PLC } from './addressing'
import { NOTE_SIZE } from './notes'
import { STEP_PREFIXES, preferredStepPrefix } from './stepNames'
import { initialEdges, initialNodes } from './initialDiagram'

const STORAGE_KEY = 'grafcet-editor:new-project'
const TABLE_ID = 'variables-table' // el mismo que nodes/VARIABLES_TABLE_ID

// Autómata: decide el formato de las direcciones (lib/addressing.js, «scheme»).
export const PLATFORMS = [
  { id: 'siemens', label: 'Siemens S7-300 / 400 / 1200 / 1500', hint: 'I0.0, Q0.0, M0.0, T1' },
  { id: 's7200', label: 'Siemens S7-200 (STEP 7-Micro/WIN)', hint: 'I0.0, Q0.0, V0.0, T37 · exporta .awl' },
  { id: 'iec', label: 'Genérico IEC 61131-3 (CODESYS, Schneider, Omron…)', hint: '%IX0.0, %QX0.0, %MX0.0' },
]

export const STARTS = [
  { id: 'initial', label: 'Solo la etapa inicial', hint: 'La etapa 0, lista para encadenar con el «+»' },
  { id: 'cycle', label: 'Un ciclo básico', hint: '0 → Marcha → 1 → Paro → vuelta a 0, para modificarlo' },
  { id: 'empty', label: 'Lienzo vacío', hint: 'Sin nada dibujado' },
]

export const DEFAULT_NEW_PROJECT = {
  name: '',
  platform: 'siemens',
  cpu: '', // S7-200: '' = decidir más tarde (la tabla de variables sugiere una según lo que se use)
  stepPrefix: 'X',
  start: 'initial',
  table: true,
  showAddresses: false,
  author: '',
  company: '',
  statement: '', // enunciado: va en una nota junto al grafcet
}

const REMEMBERED = ['platform', 'cpu', 'start', 'table', 'showAddresses', 'author', 'company']

export function loadNewProjectOptions() {
  let saved = {}
  try {
    saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}') ?? {}
  } catch {
    /* sin preferencias guardadas */
  }
  const options = { ...DEFAULT_NEW_PROJECT, stepPrefix: preferredStepPrefix() ?? DEFAULT_NEW_PROJECT.stepPrefix }
  for (const key of REMEMBERED) if (typeof saved[key] === typeof DEFAULT_NEW_PROJECT[key]) options[key] = saved[key]
  if (!PLATFORMS.some((p) => p.id === options.platform)) options.platform = DEFAULT_NEW_PROJECT.platform
  if (!STARTS.some((s) => s.id === options.start)) options.start = DEFAULT_NEW_PROJECT.start
  return options
}

export function saveNewProjectOptions(options) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(REMEMBERED.map((k) => [k, options[k]]))))
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

// Opciones -> { name, nodes, edges, plc } listo para abrir en el editor.
export function buildNewProject(options) {
  const o = { ...DEFAULT_NEW_PROJECT, ...options }
  const name = o.name.trim()
  const nodes =
    o.start === 'cycle'
      ? structuredClone(initialNodes)
      : o.start === 'initial'
        ? [{ id: 's0', type: 'step', position: { x: 200, y: 40 }, data: { label: '0', initial: true, actions: [] } }]
        : []
  const edges = o.start === 'cycle' ? structuredClone(initialEdges) : []

  const statement = o.statement.trim()
  if (statement) {
    // A la derecha del grafcet (o arriba a la izquierda si el lienzo empieza vacío).
    const text = name ? `# ${name}\n${statement}` : statement
    nodes.push({ id: 'enunciado', type: 'note', position: nodes.length ? { x: 520, y: 40 } : { x: 0, y: 0 }, data: { text, color: 'yellow' }, ...NOTE_SIZE, width: 320, height: 200 })
  }

  if (o.table) {
    // Con algo dibujado, el editor la coloca a su izquierda según su ancho real (autoPlace).
    const drawn = nodes.some((n) => n.type === 'step')
    nodes.push({
      id: TABLE_ID,
      type: 'variables',
      position: drawn ? { x: -300, y: 40 } : { x: 0, y: statement ? 260 : 0 },
      data: { showComments: true, ...(drawn ? { autoPlace: 'left' } : {}) },
      deletable: false,
    })
  }

  const titleBlock = Object.fromEntries(
    [
      ['author', o.author.trim()],
      ['company', o.company.trim()],
    ].filter(([, v]) => v),
  )
  const plc = {
    ...EMPTY_PLC,
    scheme: PLATFORMS.some((p) => p.id === o.platform) ? o.platform : 'siemens',
    stepPrefix: STEP_PREFIXES.some((p) => p.id === o.stepPrefix) ? o.stepPrefix : 'X',
    showAddresses: Boolean(o.showAddresses),
    ...(o.platform === 's7200' && o.cpu ? { s7200: { cpu: o.cpu, modules: [] } } : {}),
    ...(Object.keys(titleBlock).length ? { titleBlock } : {}),
  }
  return { name, nodes, edges, plc }
}
