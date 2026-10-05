// Hoja de prácticas en PDF de un ejercicio: lo que vería el alumnado en una hoja de prácticas de
// siempre (cabecera para rellenar, enunciado, material que se da, criterios de evaluación y
// escenarios de prueba) y, dentro del mismo PDF, el archivo del ejercicio como adjunto
// (lib/pdfAttach.js) para abrirlo en el editor. Así cualquiera puede leer y evaluar el ejercicio
// sin conocer el programa, y el papel y el archivo son lo mismo: la huella (fingerprint) que sale
// en cada página identifica el archivo adjunto.
//
// Puro: se prueba sin navegador. La medida del texto la da quien llama (como en lib/dossier.js).
import { language, t } from './i18n'
import { INK, M, MUTED, RULE, fit, pageWriter } from './pageWriter'
import { requirementLabel } from './requirements'

// Huella corta y estable de un texto (FNV-1a de 32 bits, dos semillas): «a1b2-c3d4-e5f6».
export function fingerprint(text) {
  const fnv = (seed) => {
    let h = seed >>> 0
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i)
      h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
  }
  const hex = fnv(0x811c9dc5) + fnv(0x9747b28c)
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`
}

// Segundos con la coma o el punto del idioma elegido.
const fmt = (s) => (Math.round(s * 100) / 100).toLocaleString(language(), { maximumFractionDigits: 2 })

// Comprobaciones (las selladas en el archivo) -> criterios de evaluación en palabras.
export function sheetCriteria(checks) {
  const list = [t('Hay un grafcet: etapa inicial y transiciones.')]
  list.push(
    checks.warnings
      ? t('Cumple la norma IEC 60848: la verificación del editor no da errores ni avisos.')
      : t('Cumple la norma IEC 60848: la verificación del editor no da errores.'),
  )
  if (checks.tableNames) list.push(t('Usa solo las variables de la tabla que se da.'))
  if (checks.sequence && checks.scenario) {
    list.push(t('Con el escenario «{escenario}», los cilindros hacen la secuencia {secuencia}.', { escenario: checks.scenario.name, secuencia: checks.sequence }))
  }
  for (const test of checks.behaviour ?? []) {
    const outputs = Object.keys(test.expected.outputs)
    const counts = Object.keys(test.expected.counts ?? {}).length > 0
    list.push(
      t('Con el escenario «{escenario}», la máquina responde como la solución del profesor: {salidas} se encienden y se apagan en los mismos momentos (margen de ±{margen} s){piezas}.', {
        escenario: test.scenario.name,
        salidas: outputs.join(', '),
        margen: fmt(test.tolerance),
        piezas: counts ? t(' y llegan las mismas piezas a cada recogida') : '',
      }),
    )
  }
  // Requisitos: lo que el grafcet tiene que usar.
  for (const r of checks.requirements ?? []) list.push(t('Requisito: {requisito}.', { requisito: requirementLabel(r) }))
  return list
}

// Escenarios de prueba que aparecen en los criterios (sin repetir).
export function sheetScenarios(checks) {
  const all = [checks.sequence ? checks.scenario : null, ...(checks.behaviour ?? []).map((b) => b.scenario)].filter(Boolean)
  return all.filter((s, i) => all.findIndex((x) => x.id === s.id) === i)
}

const PART_LABELS = { variables: () => t('Tabla de variables'), plant: () => t('Planta virtual'), electrical: () => t('Esquema eléctrico') }
const MODE_LABELS = { none: () => t('no se da'), given: () => t('se da (se puede cambiar)'), locked: () => t('se da y no se puede cambiar') }
const VARIABLE_COLUMNS = () => [
  { label: t('Símbolo'), width: 0.22 },
  { label: t('Tipo'), width: 0.2 },
  { label: t('Dirección'), width: 0.14 },
  { label: t('Comentario'), width: 0.44 },
]

// Cabecera y pie en todas las páginas, como en un guion de prácticas de siempre: asignatura y
// curso a la izquierda y ciclo a la derecha; abajo, centro y profesor/a, y el número de página.
function decorate(w, sheet, footLeft, measure) {
  const top = [sheet?.subject, sheet?.course].filter((v) => v?.trim()).join(' · ')
  const cycle = sheet?.cycle?.trim() ?? ''
  const total = w.pages.length
  w.pages.forEach((p, i) => {
    const room = p.w - M.left - M.right
    if (top || cycle) {
      if (top) p.items.push({ t: 'text', x: M.left, y: 10, text: fit(top, room * (cycle ? 0.6 : 1), 8, 'normal', measure), size: 8, style: 'normal', font: 'helvetica', color: MUTED })
      if (cycle) p.items.push({ t: 'text', x: p.w - M.right, y: 10, text: fit(cycle, room * 0.38, 8, 'normal', measure), size: 8, style: 'normal', font: 'helvetica', color: MUTED, align: 'right' })
      p.items.push({ t: 'line', x1: M.left, y1: 12, x2: p.w - M.right, y2: 12, width: 0.15, color: RULE })
    }
    p.items.push({ t: 'line', x1: M.left, y1: p.h - 13, x2: p.w - M.right, y2: p.h - 13, width: 0.15, color: RULE })
    if (footLeft) p.items.push({ t: 'text', x: M.left, y: p.h - 9, text: fit(footLeft, room - 35, 8, 'normal', measure), size: 8, style: 'normal', font: 'helvetica', color: MUTED })
    p.items.push({ t: 'text', x: p.w - M.right, y: p.h - 9, text: t('página {n} de {total}', { n: i + 1, total }), size: 8, style: 'normal', font: 'helvetica', color: MUTED, align: 'right' })
  })
}

// Título grande (una o dos líneas), quién lo pone y el recuadro para rellenar a mano.
function titleBlock(w, { kind, title, teacher }, measure) {
  const { text } = w
  if (kind) {
    text(kind, M.left, w.y + 3, 8.5, 'bold', { color: MUTED })
    w.y += 7
  }
  for (const line of wrapTitle(title, w.width(), measure)) {
    text(line, M.left, w.y + 7, 19, 'bold')
    w.y += 9
  }
  if (teacher?.trim()) {
    text(t('Profesor/a: {nombre}', { nombre: teacher.trim() }), M.left, w.y + 4, 10, 'normal', { color: MUTED })
    w.y += 6
  }
  w.y += 2
  const boxH = 17
  w.push({ t: 'rect', x: M.left, y: w.y, w: w.width(), h: boxH, stroke: RULE })
  const fields = [
    [t('Alumno/a'), 0, 0.6],
    [t('Grupo'), 0.62, 0.79],
    [t('Fecha'), 0.81, 1],
  ]
  for (const [label, from, to] of fields) {
    const x1 = M.left + 3 + from * (w.width() - 6)
    const x2 = M.left + 3 + to * (w.width() - 6)
    text(label, x1, w.y + 5.5, 8, 'bold', { color: MUTED })
    w.push({ t: 'line', x1, y1: w.y + 13, x2, y2: w.y + 13, width: 0.2, color: INK })
  }
  w.y += boxH + 2
}

// Lo de una práctica: enunciado, material (o, si es guiada, la solución), criterios y escenarios.
// section(título) abre cada apartado (numerado en la hoja suelta, con subtítulo en el guion).
function practiceBody(w, c, section) {
  const { paragraph, richText, bullet, subheading, table, figure } = w
  if (c.statement?.trim()) {
    section(t('Enunciado'))
    richText(c.statement)
  }
  const plantFit = { maxHeight: 120, minScale: 0.3 }
  const withTitle = (title, fig, opts) => {
    subheading(title, 11, w.figureHeight(fig, opts))
    figure(fig, opts)
  }
  if (c.solution) {
    // Práctica guiada: así se resuelve (como modelo de lo que hay que entregar).
    section(t('Solución (práctica guiada)'))
    paragraph([{ text: t('Esta práctica se hace en clase como ejemplo de cómo se resuelve y se presenta. El proyecto resuelto va dentro de este PDF.') }], 10)
    // El grafcet, en lo que queda de página si cabe a una escala legible (si no, en la siguiente).
    for (const [i, fig] of (c.solution.grafcet ?? []).entries()) withTitle(i === 0 ? t('Grafcet') : fig.name ?? t('Grafcet'), fig, { minScale: 0.3, maxHeight: Math.max(110, w.bottom() - w.y - 18) })
    for (const [i, fig] of (c.figures?.electrical ?? []).entries()) withTitle(i === 0 ? t('Conexionado de los elementos') : fig.name, fig, { minScale: 0.3 })
    // El programa, más pequeño que 1:1 (un ladder entero ocuparía muchas páginas).
    if (c.solution.ladder) withTitle(t('Programa (ladder)'), c.solution.ladder, { minScale: 0.3, maxScale: 0.62 })
    if (c.solution.variables?.length) {
      subheading(t('Tabla de variables'), 11)
      table(VARIABLE_COLUMNS(), c.solution.variables, { mono: [0, 2] })
    }
    if (c.figures?.plant) withTitle(t('Simulación (planta virtual)'), c.figures.plant, plantFit)
  } else {
    section(t('Material que se da'))
    for (const part of ['variables', 'plant', 'electrical']) {
      const mode = c.parts?.[part] ?? 'given'
      bullet([{ text: `${PART_LABELS[part]()}: `, bold: true }, { text: MODE_LABELS[mode]() }])
    }
    bullet([{ text: `${t('Grafcet')}: `, bold: true }, { text: t('lo haces tú.') }])
    if (c.variables?.length) {
      subheading(t('Tabla de variables'), 11)
      table(VARIABLE_COLUMNS(), c.variables, { mono: [0, 2] })
    }
    // Cada figura, con su título en la misma página.
    if (c.figures?.plant) withTitle(t('Planta virtual'), c.figures.plant, plantFit)
    const electrical = c.figures?.electrical ?? []
    for (const [i, fig] of electrical.entries()) {
      if (i === 0) subheading(t('Esquema eléctrico'), 11, w.figureHeight(fig, { minScale: 0.3 }) + (electrical.length > 1 ? 7 : 0))
      figure(fig, { caption: electrical.length > 1 ? fig.name : undefined, minScale: 0.3 })
    }
  }

  section(t('Criterios de evaluación'))
  paragraph([{ text: t('El ejercicio está bien cuando se cumple todo esto (el editor lo comprueba con el botón «Comprobar»):') }], 10)
  w.y += 1.5
  for (const line of sheetCriteria(c.checks)) bullet([{ text: line }], 10)
  // Pistas y nota, si el profesor las ha puesto.
  const hints = c.checks.hints?.length ?? 0
  if (hints) paragraph([{ text: t('El editor ofrece {n} pistas, de una en una; queda anotado cuántas se han visto.', { n: hints }) }], 9.5)
  if (c.grade?.enabled) {
    const max = fmt(Number(c.grade.max) || 10)
    const penalty = Number(c.grade.hintPenalty) || 0
    paragraph([{ text: penalty && hints ? t('Nota orientativa: la parte de criterios cumplidos sobre {max}; cada pista vista resta {puntos}.', { max, puntos: fmt(penalty) }) : t('Nota orientativa: la parte de criterios cumplidos sobre {max}.', { max }) }], 9.5)
  }

  const scenarios = sheetScenarios(c.checks)
  if (scenarios.length) {
    w.y += 2
    paragraph([{ text: t('Escenarios de prueba: qué entradas cambian y cuándo, desde la situación inicial. Las demás conservan su valor de reposo (un pulsador NC vale 1 sin pulsar).') }], 9.5)
    for (const s of scenarios) {
      subheading(t('Escenario «{escenario}» · {duracion} s', { escenario: s.name, duracion: fmt(s.duration ?? (s.events.at(-1)?.t ?? 0) + 1) }), 10.5)
      table(
        [
          { label: t('Instante (s)'), width: 0.2 },
          { label: t('Entrada'), width: 0.4 },
          { label: t('Pasa a valer'), width: 0.4 },
        ],
        // Solo el valor: si 0 es «pulsado» o «soltado» depende del contacto (NA o NC).
        s.events.map((e) => [fmt(e.t), e.name, e.value ? '1' : '0']),
        { mono: [1] },
      )
    }
  }
}

// --- Hoja de un ejercicio ---------------------------------------------------------------------

// content: { title, sheet: { subject, course, cycle, center, teacher }, statement, parts,
//   variables: [[...]], figures: { plant, electrical: [fig] }, checks (desselladas), attachment
//   (nombre del adjunto), print (huella) }
export function buildExerciseSheet(content, measure) {
  const w = pageWriter(measure)
  let number = 0
  const section = (title) => {
    number++
    w.ensure(30)
    w.y += 4
    w.text(`${number}. ${title}`, M.left, w.y + 5, 13.5, 'bold')
    w.rule(w.y + 8, 0.35)
    w.y += 13
  }
  w.newPage()
  titleBlock(w, { kind: t('HOJA DE PRÁCTICAS · GRAFCET (IEC 60848)'), title: content.title || t('Ejercicio'), teacher: content.sheet?.teacher }, measure)
  practiceBody(w, content, section)
  section(t('Cómo se hace'))
  for (const line of [
    t('Abre este PDF en el editor de Grafcet (Abrir > Abrir archivo): el ejercicio va dentro, como archivo adjunto «{archivo}».', { archivo: content.attachment }),
    t('Dibuja el grafcet; pruébalo en la simulación.'),
    t('Pulsa «Comprobar» cuantas veces quieras: cada criterio sale en verde o en rojo, con lo que falla.'),
  ]) {
    w.bullet([{ text: line }], 10)
  }
  const foot = [content.sheet?.center, content.title || t('Ejercicio'), t('Huella del ejercicio: {huella}', { huella: content.print })]
  decorate(w, content.sheet, foot.filter((v) => v?.trim()).join(' · '), measure)
  return { pages: w.pages }
}

// --- Guion de prácticas -----------------------------------------------------------------------

// content: { title, sheet: { subject, course, cycle, center, teacher }, rules (texto con formato),
//   practices: [contenido de buildExerciseSheet + { solution?: { grafcet: [fig], ladder, variables } }] }
// Una portada con las normas generales y, después, cada práctica en su página («PRÁCTICA Nº n»).
export function buildGuide(content, measure) {
  const w = pageWriter(measure)
  w.newPage()
  titleBlock(w, { kind: t('GUION DE PRÁCTICAS · GRAFCET (IEC 60848)'), title: content.title || t('Guion de prácticas'), teacher: content.sheet?.teacher }, measure)
  if (content.rules?.trim()) {
    w.y += 3
    w.richText(content.rules)
  }
  // Índice de prácticas, con la página de cada una (se rellena al final).
  w.subheading(t('Prácticas'), 12)
  const index = content.practices.map((p, i) => {
    w.ensure(6)
    const at = { page: w.page, y: w.y + 4.2 }
    w.text(fit(t('Práctica nº {n}. {titulo}', { n: i + 1, titulo: practiceTitle(p) }), w.width() - 25, 10, 'normal', measure), M.left, at.y, 10)
    w.y += 6
    return at
  })
  const starts = []
  content.practices.forEach((p, i) => {
    w.newPage()
    starts.push(w.pages.length)
    w.text(t('PRÁCTICA Nº {n}', { n: i + 1 }), M.left, w.y + 5, 14, 'bold')
    if (p.solution) w.text(t('Práctica guiada'), w.size.w - M.right, w.y + 5, 9, 'bold', { color: [29, 78, 216], align: 'right' })
    w.y += 8
    for (const line of wrapTitle(practiceTitle(p), w.width(), measure, 14)) {
      w.text(line, M.left, w.y + 5, 14, 'bold')
      w.y += 6.5
    }
    w.text(t('Archivo adjunto: {archivo} · Huella: {huella}', { archivo: p.attachment, huella: p.print }), M.left, w.y + 3.5, 8.5, 'normal', { color: MUTED })
    w.rule(w.y + 6, 0.35)
    w.y += 11
    practiceBody(w, p, (title) => w.subheading(title, 12))
  })
  index.forEach((at, i) => at.page.items.push({ t: 'text', x: w.size.w - M.right, y: at.y, text: String(starts[i]), size: 10, style: 'normal', font: 'helvetica', color: INK, align: 'right' }))

  // Cómo se hace y qué hay dentro del PDF (para quien revise el guion sin el programa).
  w.newPage()
  w.subheading(t('Cómo se hace'), 12)
  for (const line of [
    t('Abre este PDF en el editor de Grafcet (Abrir > Abrir archivo) y elige la práctica: cada una va dentro, como archivo adjunto.'),
    t('Dibuja el grafcet; pruébalo en la simulación.'),
    t('Pulsa «Comprobar» cuantas veces quieras: cada criterio sale en verde o en rojo, con lo que falla.'),
  ]) {
    w.bullet([{ text: line }], 10)
  }
  w.subheading(t('Archivos adjuntos'), 12)
  w.paragraph([{ text: t('Cada práctica va dentro de este PDF; la huella identifica el archivo (la misma versión da siempre la misma huella).') }], 9.5)
  w.y += 1
  w.table(
    [
      { label: t('Práctica'), width: 0.42 },
      { label: t('Archivo'), width: 0.38 },
      { label: t('Huella'), width: 0.2 },
    ],
    content.practices.flatMap((p, i) => [
      [`${i + 1}. ${practiceTitle(p)}`, p.attachment, p.print],
      ...(p.solutionAttachment ? [[`${i + 1}. ${t('(solución)')}`, p.solutionAttachment, p.solutionPrint]] : []),
    ]),
    { mono: [1, 2] },
  )
  decorate(w, content.sheet, [content.sheet?.center, content.sheet?.teacher].filter((v) => v?.trim()).join(' · ') || content.title, measure)
  return { pages: w.pages, starts }
}

// «Práctica 4. Cinta…» -> «Cinta…»: el número ya lo pone el guion.
export const practiceTitle = (p) => (p.title || t('Ejercicio')).replace(/^(Práctica|Practice|Pratique|Prática)\s*(nº\s*)?\d+\s*(\([^)]*\))?\s*[.:-]\s*/i, '')

// Título en una o dos líneas (si no cabe en dos, la segunda se recorta).
function wrapTitle(title, width, measure, size = 19) {
  const words = title.split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word
    if (measure(next, size, 'bold') > width && lines.at(-1) && lines.length < 2) lines.push(word)
    else lines[lines.length - 1] = next
  }
  return lines.map((l) => fit(l, width, size, 'bold', measure))
}
