import { useState } from 'react'
import { AlertTriangle, BookOpen, CircleCheck, CircleX, Lightbulb, X } from 'lucide-react'
import { t } from '../lib/i18n'

function IssueItem({ issue, onFocus, onHelp }) {
  const [open, setOpen] = useState(false)
  const Icon = issue.severity === 'error' ? CircleX : issue.severity === 'tip' ? Lightbulb : AlertTriangle
  const color = issue.severity === 'error' ? 'text-red-600' : issue.severity === 'tip' ? 'text-blue-500' : 'text-amber-500'
  return (
    <li>
      <button
        type="button"
        onClick={() => onFocus(issue)}
        disabled={!issue.nodeIds.length}
        className="flex w-full items-start gap-2 rounded-md p-2 text-left text-sm hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Icon size={16} className={`mt-0.5 shrink-0 ${color}`} />
        <span className="text-slate-700">{issue.message}</span>
      </button>
      {(issue.why || (issue.topic && onHelp)) && (
        <div className="pl-8 pr-2">
          <div className="flex gap-3">
            {issue.why && (
              <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="text-xs text-blue-600 hover:underline">
                {open ? t('Ocultar') : t('¿Por qué?')}
              </button>
            )}
            {/* El artículo de la ayuda que explica la regla (issue.topic, lib/validation.js y tips.js). */}
            {issue.topic && onHelp && (
              <button type="button" onClick={() => onHelp(issue.topic)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <BookOpen size={12} /> {t('Más en la ayuda')}
              </button>
            )}
          </div>
          {open && <p className="mt-1 rounded bg-blue-50 p-2 text-xs text-slate-700">{issue.why}</p>}
        </div>
      )}
    </li>
  )
}

// Resultado de la verificación de conformidad (lib/validation.js) y consejos (lib/tips.js). Se
// recalcula en vivo mientras se edita; al pulsar un problema se seleccionan y encuadran los nodos.
export default function VerifyPanel({ issues, onFocus, onHelp, onClose }) {
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const tips = issues.filter((i) => i.severity === 'tip')

  return (
    <aside className="side-panel flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold">{t('Verificación IEC 60848')}</h2>
        <button type="button" onClick={onClose} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto p-4">
        {errors.length + warnings.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md bg-green-50 p-3 text-sm text-green-800">
            <CircleCheck size={18} className="mt-0.5 shrink-0" />
            <span>{t('El grafcet es conforme: no se han encontrado problemas.')}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {t('Errores: {errores} · avisos: {avisos}. Pulsa uno para ir a él.', { errores: errors.length, avisos: warnings.length })}
          </p>
        )}

        <ul className="space-y-1" aria-label={t('Problemas')}>
          {[...errors, ...warnings].map((issue, i) => (
            <IssueItem key={i} issue={issue} onFocus={onFocus} onHelp={onHelp} />
          ))}
        </ul>

        {tips.length > 0 && (
          <section aria-label={t('Consejos')}>
            <h3 className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              <Lightbulb size={13} /> {t('Consejos ({n})', { n: tips.length })}
            </h3>
            <ul className="space-y-1">
              {tips.map((issue, i) => (
                <IssueItem key={i} issue={issue} onFocus={onFocus} onHelp={onHelp} />
              ))}
            </ul>
          </section>
        )}

        <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
          {t(
            'Errores: el grafcet no es conforme o no puede evolucionar. Avisos: es válido pero probablemente no es lo que se quiere (p. ej. una etapa final sin salida). Consejos: errores típicos al aprender, con su explicación.',
          )}
        </p>
      </div>
    </aside>
  )
}
