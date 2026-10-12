// Formato del archivo de proyecto (.json) y sus migraciones. Documentado en docs/formato-proyecto.md.
//
// Un proyecto guardado con una versión del editor tiene que seguir abriéndose en las posteriores
// (desde la 1.0, es un compromiso; las pruebas de tests/unit/projectFormat.test.js abren los
// proyectos de referencia de cada versión, en tests/fixtures/formato/).
//
// Cuándo se sube FORMAT_VERSION: cuando un cambio hace que un editor anterior no entienda bien lo
// que guarda el nuevo (un campo que cambia de significado o de forma, algo que se mueve de sitio).
// Añadir un campo opcional nuevo NO sube la versión: los editores anteriores lo ignoran. Al subirla,
// se añade a MIGRATIONS la función que pasa un proyecto de la versión anterior a la nueva.
import { fixAssignmentKind } from './actions'
import { sceneFromPlant } from './sim/scene'
import { t } from './i18n'

export const FORMAT = 'grafcet-editor'
export const FORMAT_VERSION = 1

// MIGRATIONS[n - 1]: proyecto en formato n -> formato n + 1. Funciones puras: reciben el proyecto
// (ya con las adaptaciones del formato 1 antiguo) y devuelven uno nuevo.
export const MIGRATIONS = []

// Versión del formato de un proyecto leído. Sin versión (el autoguardado y los trabajos anteriores
// de editores antiguos, archivos hechos a mano): formato 1.
export const formatVersion = (raw) => (Number.isInteger(raw?.version) && raw.version > 0 ? raw.version : 1)

// Un proyecto de un editor más nuevo no se abre a medias sin avisar: error con un mensaje claro.
export function checkFormat(raw) {
  const version = formatVersion(raw)
  if (version > FORMAT_VERSION) {
    throw new Error(t('Este proyecto se guardó con una versión más nueva del editor (formato {n}). Recarga la página para usar la última versión y vuelve a abrirlo.', { n: version }))
  }
}

// Pasa un proyecto leído (con nodes y edges) al formato actual: primero las adaptaciones del
// formato 1 antiguo y después, por orden, las migraciones desde su versión.
export function migrateProject(raw) {
  let project = legacyFormat1(raw)
  for (let v = formatVersion(raw); v < FORMAT_VERSION; v++) project = MIGRATIONS[v - 1](project)
  return { ...project, version: FORMAT_VERSION }
}

// --- Formato 1 antiguo ---------------------------------------------------------------------------
// Las primeras versiones guardaban algunas cosas de otra manera sin cambiar el número de formato;
// se reconocen por su forma y se adaptan siempre (no hacen nada en un proyecto ya actual).
function legacyFormat1(raw) {
  const { nodes, edges } = actionNodesToActions(raw.nodes, raw.edges)
  return {
    ...raw,
    nodes: nodes.map((n) => (n.type === 'step' ? { ...n, data: { ...n.data, actions: (n.data?.actions ?? []).map(fixAssignmentKind) } } : n)),
    // El enlace genérico «step» de React Flow: ahora todos son «grafcet».
    edges: edges.map((e) => ({ ...e, type: 'grafcet' })),
    plc: raw.plc ? plantToScene(raw.plc) : raw.plc,
  }
}

// Acciones guardadas como nodos sueltos (type 'action') unidos a su etapa -> acciones de la etapa.
function actionNodesToActions(nodes, edges) {
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
      .map((n) => (actionsByStep[n.id] ? { ...n, data: { ...n.data, actions: [...(n.data?.actions ?? []), ...actionsByStep[n.id]] } } : n)),
    edges: edges.filter((e) => !actionIds.has(e.source) && !actionIds.has(e.target)),
  }
}

// Planta por modelos fijos (plc.plant: cilindros, cinta, depósito) -> escena de elementos libres
// (plc.scene), si el proyecto aún no tenía escena.
function plantToScene(plc) {
  if (!plc.plant) return plc
  const { plant, ...rest } = plc
  return plant.length && !rest.scene?.elements?.length ? { ...rest, scene: sceneFromPlant(plant) } : rest
}
