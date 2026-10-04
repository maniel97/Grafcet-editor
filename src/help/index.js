// Wiki de la ayuda: secciones y artículos. Cada artículo es un archivo Markdown por idioma,
// src/help/<idioma>/<id>.md (formato en help/Markdown.jsx); si falta en un idioma, se muestra el
// español. El título es su primera línea («# …»). Para traducir: copiar la carpeta es/ a la del
// idioma y traducir los archivos (guía: src/locales/LEEME.md).
import { N_, language } from '../lib/i18n'

const FILES = import.meta.glob('./*/*.md', { query: '?raw', import: 'default', eager: true })

export const SECTIONS = [
  { title: N_('Primeros pasos'), articles: ['que-es-grafcet', 'primer-grafcet'] },
  { title: N_('El grafcet (IEC 60848)'), articles: ['etapas', 'transiciones', 'acciones', 'temporizaciones', 'divergencias', 'bucles'] },
  { title: N_('Estructurar'), articles: ['macroetapas', 'grafcets-parciales', 'encapsulacion', 'gemma', 'hojas'] },
  { title: N_('Comprobar y simular'), articles: ['verificar', 'simular', 'planta', 'esquema-electrico'] },
  { title: N_('Al autómata'), articles: ['variables', 'ladder'] },
]

// Texto del artículo en el idioma elegido (o en español).
export function articleSource(id, lang = language()) {
  return FILES[`./${lang}/${id}.md`] ?? FILES[`./es/${id}.md`] ?? null
}
export const articleTitle = (id, lang) => /^#\s+(.*)$/m.exec(articleSource(id, lang) ?? '')?.[1] ?? id

// Los artículos que existen, en el orden del índice.
export const ARTICLES = SECTIONS.flatMap((s) => s.articles).filter((id) => articleSource(id, 'es'))
