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
  return list
}

// Escenarios de prueba que aparecen en los criterios (sin repetir).
export function sheetScenarios(checks) {
  const all = [checks.sequence ? checks.scenario : null, ...(checks.behaviour ?? []).map((b) => b.scenario)].filter(Boolean)
  return all.filter((s, i) => all.findIndex((x) => x.id === s.id) === i)
}

const PART_LABELS = { variables: () => t('Tabla de variables'), plant: () => t('Planta virtual'), electrical: () => t('Esquema eléctrico') }
const MODE_LABELS = { none: () => t('no se da'), given: () => t('se da (se puede cambiar)'), locked: () => t('se da y no se puede cambiar') }

// content: { title, sheet: { subject, course, teacher }, statement, parts, variables: [[...]],
//   figures: { plant, electrical: [fig] }, checks (desselladas), attachment (nombre), print (huella) }
export function buildExerciseSheet(content, measure) {
  const w = pageWriter(measure)
  const { text, paragraph, richText, bullet, subheading, table, figure } = w
  let number = 0
  const section = (title) => {
    number++
    w.ensure(30)
    w.y += 4
    text(`${number}. ${title}`, M.left, w.y + 5, 13.5, 'bold')
    w.rule(w.y + 8, 0.35)
    w.y += 13
  }

  // Cabecera: tipo de documento, asignatura y curso; título; datos para rellenar a mano.
  w.newPage()
  const right = w.size.w - M.right
  text(t('HOJA DE PRÁCTICAS · GRAFCET (IEC 60848)'), M.left, w.y + 3, 8.5, 'bold', { color: MUTED })
  const top = [content.sheet?.subject, content.sheet?.course].filter((v) => v?.trim()).join(' · ')
  if (top) text(fit(top, w.width() * 0.5, 8.5, 'normal', measure), right, w.y + 3, 8.5, 'normal', { color: MUTED, align: 'right' })
  w.y += 7
  for (const line of wrapTitle(content.title || t('Ejercicio'), w.width(), measure)) {
    text(line, M.left, w.y + 7, 19, 'bold')
    w.y += 9
  }
  if (content.sheet?.teacher?.trim()) {
    text(t('Profesor/a: {nombre}', { nombre: content.sheet.teacher.trim() }), M.left, w.y + 4, 10, 'normal', { color: MUTED })
    w.y += 6
  }
  w.y += 2
  // Recuadro: Alumno/a, Grupo y Fecha, con líneas para escribir.
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

  if (content.statement?.trim()) {
    section(t('Enunciado'))
    richText(content.statement)
  }

  section(t('Material que se da'))
  for (const part of ['variables', 'plant', 'electrical']) {
    const mode = content.parts?.[part] ?? 'given'
    bullet([{ text: `${PART_LABELS[part]()}: `, bold: true }, { text: MODE_LABELS[mode]() }])
  }
  bullet([{ text: `${t('Grafcet')}: `, bold: true }, { text: t('lo haces tú.') }])
  if (content.variables?.length) {
    subheading(t('Tabla de variables'), 11)
    table(
      [
        { label: t('Símbolo'), width: 0.22 },
        { label: t('Tipo'), width: 0.2 },
        { label: t('Dirección'), width: 0.14 },
        { label: t('Comentario'), width: 0.44 },
      ],
      content.variables,
      { mono: [0, 2] },
    )
  }
  // Cada figura, con su título en la misma página.
  const plant = { maxHeight: 120, minScale: 0.3 }
  if (content.figures?.plant) {
    subheading(t('Planta virtual'), 11, w.figureHeight(content.figures.plant, plant))
    figure(content.figures.plant, plant)
  }
  const electrical = content.figures?.electrical ?? []
  for (const [i, fig] of electrical.entries()) {
    if (i === 0) subheading(t('Esquema eléctrico'), 11, w.figureHeight(fig, { minScale: 0.3 }) + (electrical.length > 1 ? 7 : 0))
    figure(fig, { caption: electrical.length > 1 ? fig.name : undefined, minScale: 0.3 })
  }

  section(t('Criterios de evaluación'))
  paragraph([{ text: t('El ejercicio está bien cuando se cumple todo esto (el editor lo comprueba con el botón «Comprobar»):') }], 10)
  w.y += 1.5
  for (const c of sheetCriteria(content.checks)) bullet([{ text: c }], 10)

  const scenarios = sheetScenarios(content.checks)
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

  section(t('Cómo se hace'))
  for (const line of [
    t('Abre este PDF en el editor de Grafcet (Abrir > Abrir archivo): el ejercicio va dentro, como archivo adjunto «{archivo}».', { archivo: content.attachment }),
    t('Dibuja el grafcet; pruébalo en la simulación.'),
    t('Pulsa «Comprobar» cuantas veces quieras: cada criterio sale en verde o en rojo, con lo que falla.'),
  ]) {
    bullet([{ text: line }], 10)
  }

  w.footer(
    `${content.title || t('Ejercicio')} · ${t('Huella del ejercicio: {huella}', { huella: content.print })}`,
    (i, total) => t('página {n} de {total}', { n: i, total }),
  )
  return { pages: w.pages }
}

// Título en una o dos líneas (si no cabe en dos, la segunda se recorta).
function wrapTitle(title, width, measure) {
  const words = title.split(/\s+/)
  const lines = ['']
  for (const word of words) {
    const next = lines.at(-1) ? `${lines.at(-1)} ${word}` : word
    if (measure(next, 19, 'bold') > width && lines.at(-1) && lines.length < 2) lines.push(word)
    else lines[lines.length - 1] = next
  }
  return lines.map((l) => fit(l, width, 19, 'bold', measure))
}
