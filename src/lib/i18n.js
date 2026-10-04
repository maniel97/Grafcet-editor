// Idiomas de la interfaz. Los textos se escriben en español en el código y se traducen al
// mostrarlos con t(texto): los catálogos (src/locales/<idioma>.json) van del texto en español a la
// traducción, así que añadir un idioma es añadir un archivo JSON (guía: src/locales/LEEME.md).
// Lo que no está traducido (o está vacío) se muestra en español. Por defecto, español (se cambia
// en Opciones).
//
// Partes variables, con nombre: t('Mover a {hoja}', { hoja: 'Hoja 2' }); el traductor mueve el
// marcador donde lo pida su idioma, sin cambiarle el nombre. Un texto que se define en un sitio y
// se traduce en otro (p. ej. las etiquetas de un menú) se marca con N_('…') para que el extractor
// (npm run i18n) lo encuentre.
import en from '../locales/en.json' with { type: 'json' }
import fr from '../locales/fr.json' with { type: 'json' }
import pt from '../locales/pt.json' with { type: 'json' }

export const LANGUAGES = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'pt', label: 'Português' },
]
const DICTIONARIES = { en, fr, pt }

let current = 'es'
export const language = () => current
export function setLanguage(id) {
  current = LANGUAGES.some((l) => l.id === id) ? id : 'es'
  if (typeof document !== 'undefined') document.documentElement.lang = current
}

// Marca un texto como traducible sin traducirlo aún (se traduce después con t(variable)).
export const N_ = (text) => text

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all)) : text)

export function t(text, vars) {
  if (typeof text !== 'string') return text
  const translated = current === 'es' ? text : DICTIONARIES[current]?.[text] || text
  return fill(translated, vars)
}
