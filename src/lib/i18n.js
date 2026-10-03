// Idiomas de la interfaz. Los textos se escriben en español en el código y se traducen al
// mostrarlos con t(texto): los diccionarios (lib/locales/*.js) van del texto en español a la
// traducción, así que añadir un idioma es añadir un archivo. Lo que no está traducido se muestra
// en español. Por defecto, español (se cambia en Opciones).
import en from './locales/en'
import fr from './locales/fr'
import pt from './locales/pt'

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

// Textos con una parte variable: «Mover a Hoja 2» -> plantilla «Mover a {}».
const TEMPLATES = ['Mover a {}', 'Etapa {}', 'Borrar {}']

export function t(text) {
  if (current === 'es' || typeof text !== 'string') return text
  const dict = DICTIONARIES[current]
  if (dict[text]) return dict[text]
  for (const template of TEMPLATES) {
    const [before, after] = template.split('{}')
    if (text.startsWith(before) && text.endsWith(after) && dict[template]) {
      return dict[template].replace('{}', text.slice(before.length, text.length - after.length))
    }
  }
  return text
}
