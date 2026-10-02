import { useEffect, useState } from 'react'
import { setDiagramFontSize } from './layout'

// Fuentes instaladas en local (@fontsource): funcionan sin conexión y se incluyen en las exportaciones.
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/lexend/400.css'
import '@fontsource/lexend/600.css'
import '@fontsource/opendyslexic/400.css'
import '@fontsource/opendyslexic/700.css'

export const FONTS = [
  { id: 'inter', label: 'Inter (predeterminada)', stack: "'Inter', system-ui, sans-serif" },
  {
    id: 'atkinson',
    label: 'Atkinson Hyperlegible',
    hint: 'Diseñada para baja visión',
    stack: "'Atkinson Hyperlegible', system-ui, sans-serif",
  },
  { id: 'lexend', label: 'Lexend', hint: 'Mejora la fluidez lectora', stack: "'Lexend', system-ui, sans-serif" },
  { id: 'opendyslexic', label: 'OpenDyslexic', hint: 'Pensada para dislexia', stack: "'OpenDyslexic', sans-serif" },
  { id: 'system', label: 'Fuente del sistema', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { id: 'serif', label: 'Con serifa', stack: "Georgia, 'Times New Roman', serif" },
  { id: 'mono', label: 'Monoespaciada', stack: "ui-monospace, Consolas, 'Courier New', monospace" },
]

export const UI_SCALES = [90, 100, 115, 130, 150] // % del tamaño base de la interfaz
export const DIAGRAM_FONT = { min: 12, max: 24, step: 1 } // px

export const THEMES = [
  { id: 'auto', label: 'Automático' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
]

export const DEFAULT_SETTINGS = { fontId: 'inter', uiScale: 100, diagramFontSize: 14, theme: 'auto' }

const darkQuery = () => globalThis.matchMedia?.('(prefers-color-scheme: dark)')
const resolveTheme = (theme) => (theme === 'auto' ? (darkQuery()?.matches ? 'dark' : 'light') : theme)

const STORAGE_KEY = 'grafcet-editor:settings'

function readStored() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { ...DEFAULT_SETTINGS, ...stored }
  } catch {
    return DEFAULT_SETTINGS
  }
}

// Aplica los ajustes como variables CSS en <html>.
// El tamaño de la interfaz escala la fuente raíz (todo lo medido en rem); el diagrama
// usa px fijos y solo cambia su texto a través de --diagram-font-size.
function apply({ fontId, uiScale, diagramFontSize, theme }) {
  const root = document.documentElement
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0]
  root.style.setProperty('--app-font', font.stack)
  root.style.setProperty('--diagram-font-size', `${diagramFontSize}px`)
  setDiagramFontSize(diagramFontSize)
  root.style.fontSize = `${uiScale}%`
  // Tema de la interfaz (la hoja del dibujo siempre es blanca; ver index.css).
  root.dataset.theme = resolveTheme(theme)
}

// Preferencias de accesibilidad del usuario, guardadas en este navegador.
export function useSettings() {
  const [settings, setSettings] = useState(readStored)

  useEffect(() => {
    apply(settings)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Sin almacenamiento (modo privado, bloqueado...): los ajustes duran solo esta sesión.
    }
  }, [settings])

  // En automático se sigue el tema del sistema también si cambia con el editor abierto.
  useEffect(() => {
    const query = darkQuery()
    if (settings.theme !== 'auto' || !query) return
    const onChange = () => apply(settings)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [settings])

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }))
  const reset = () => setSettings(DEFAULT_SETTINGS)
  return { settings, update, reset }
}
