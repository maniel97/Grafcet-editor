import { useEffect, useRef } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { DIAGRAM_FONT, FONTS, UI_SCALES, THEMES } from '../lib/settings'
import { LANGUAGES, t } from '../lib/i18n'

const sectionTitle = 'text-xs font-medium uppercase tracking-wide text-slate-500'

// Opciones de accesibilidad: tipo de letra, tamaño de la interfaz y del texto del diagrama.
export default function SettingsDialog({ settings, onChange, onReset, onClose }) {
  const dialogRef = useRef(null)

  // Al desmontarse, el <dialog> sale del DOM y se cierra solo; llamar a close() en la limpieza
  // dispararía onClose y, con el doble montaje de StrictMode, lo cerraría nada más abrirlo.
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="settings-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="settings-title" className="text-base font-semibold">
          Opciones
        </h2>
        <button type="button" onClick={onClose} title={t('Cerrar (Esc)')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-4">
        <fieldset className="space-y-2">
          <legend className={sectionTitle}>{t('Tipo de letra')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FONTS.map((font) => {
              const active = settings.fontId === font.id
              return (
                <label
                  key={font.id}
                  className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 ${
                    active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="font"
                    value={font.id}
                    checked={active}
                    onChange={() => onChange({ fontId: font.id })}
                    className="sr-only"
                  />
                  <span style={{ fontFamily: font.stack }} className="text-base">
                    {font.label}
                  </span>
                  {font.hint && <span className="text-xs text-slate-500">{font.hint}</span>}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={sectionTitle}>{t('Idioma')}</legend>
          <select
            aria-label="Idioma"
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={settings.lang ?? 'es'}
            onChange={(e) => onChange({ lang: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            {settings.lang && settings.lang !== 'es'
              ? 'Translation in progress: some texts are still in Spanish. / Traduction en cours. / Tradução em curso.'
              : 'La barra, los menús y las opciones; el resto se irá traduciendo.'}
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={sectionTitle}>{t('Tema')}</legend>
          <div className="flex flex-wrap gap-1">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                aria-pressed={settings.theme === theme.id}
                onClick={() => onChange({ theme: theme.id })}
                className={`rounded-md border px-3 py-1 text-sm ${
                  settings.theme === theme.id
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {t(theme.label)}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Automático sigue al sistema. La hoja del diagrama sigue blanca, como se exporta.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={sectionTitle}>{t('Tamaño de la interfaz')}</legend>
          <div className="flex flex-wrap gap-1">
            {UI_SCALES.map((scale) => (
              <button
                key={scale}
                type="button"
                aria-pressed={settings.uiScale === scale}
                onClick={() => onChange({ uiScale: scale })}
                className={`rounded-md border px-3 py-1 text-sm ${
                  settings.uiScale === scale
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {scale}%
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">Barra de herramientas, paneles y avisos.</p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className={sectionTitle}>{t('Texto del diagrama')}</legend>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={DIAGRAM_FONT.min}
              max={DIAGRAM_FONT.max}
              step={DIAGRAM_FONT.step}
              value={settings.diagramFontSize}
              onChange={(e) => onChange({ diagramFontSize: Number(e.target.value) })}
              aria-label={t('Tamaño del texto del diagrama')}
              className="flex-1 accent-blue-600"
            />
            <span className="w-12 text-right text-sm tabular-nums">{settings.diagramFontSize}px</span>
          </div>
          <div className="rounded-md border border-dashed border-slate-300 px-3 py-2">
            <span className="diagram-text">
              Motor ON · a AND <span className="overline decoration-1">b</span>
            </span>
          </div>
          <p className="text-xs text-slate-500">Acciones y receptividades; también se aplica al exportar.</p>
        </fieldset>
      </div>

      <div className="flex justify-between border-t border-slate-200 px-5 py-3">
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          <RotateCcw size={16} /> {t('Restablecer')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Listo
        </button>
      </div>
    </dialog>
  )
}
