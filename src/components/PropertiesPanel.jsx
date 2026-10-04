import { useRef } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { ACTION_KINDS, ACTION_PRESETS, actionKind, normalizeAction } from '../lib/actions'
import AutocompleteInput from './AutocompleteInput'
import { useDraft } from './useDraft'
import { t, N_ } from '../lib/i18n'

const inputClass =
  'w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
const sectionTitle = 'text-xs font-medium uppercase tracking-wide text-slate-500'

// Símbolos de receptividad (IEC 60848) que se insertan en la posición del cursor.
const CONDITION_SYMBOLS = [
  { symbol: '↑', title: N_('Flanco de subida (↑a)') },
  { symbol: '↓', title: N_('Flanco de bajada (↓a)') },
  { symbol: ' · ', label: '·', title: N_('Y lógica (a · b)') },
  { symbol: ' + ', label: '+', title: N_('O lógica (a + b)') },
  { symbol: '!', title: N_('Negación: se dibuja con raya encima') },
]

// Etiquetas de un clic para rellenar valores habituales.
function Presets({ values, onPick, title, render = (v) => v }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-slate-400">{title}</span>
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(v)}
            className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-0.5 font-mono text-xs text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
          >
            {render(v)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className={sectionTitle}>{label}</span>
      {children}
    </label>
  )
}

const kindMarker = { 'stored-on': '↑ ', 'stored-off': '↓ ', event: '⚡ ', conditional: '? ' }

function ActionRow({ action, onChange, onRemove, vocabulary, otherTexts }) {
  const kind = actionKind(action.kind)
  return (
    <div className="space-y-1 rounded-md border border-slate-200 p-2">
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          <AutocompleteInput
            mode="action"
            vocabulary={vocabulary}
            otherTexts={[...otherTexts, action.condition ?? '']}
            className={inputClass}
            value={action.text}
            placeholder={t('p. ej. Motor ON, A:=1, F/G2{3}')}
            aria-label={t('Texto de la acción')}
            onChange={(text) => onChange({ text })}
          />
        </div>
        <button
          type="button"
          title={t('Eliminar acción')}
          onClick={onRemove}
          className="rounded-md px-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <select
        className={inputClass}
        value={action.kind}
        title={t(kind.help)}
        onChange={(e) => onChange({ kind: e.target.value })}
        aria-label={t('Tipo de acción')}
      >
        {ACTION_KINDS.map((k) => (
          <option key={k.id} value={k.id}>
            {t(k.label)}
          </option>
        ))}
      </select>
      {kind.needsCondition && (
        <AutocompleteInput
          vocabulary={vocabulary}
          otherTexts={[...otherTexts, action.text]}
          className={inputClass}
          value={action.condition}
          placeholder={t(kind.placeholder)}
          onChange={(condition) => onChange({ condition })}
          aria-label={t('Condición de la acción')}
        />
      )}
      <p className="text-xs text-slate-400">{t(kind.help)}</p>
    </div>
  )
}

function StepFields({ data, onChange, onCommitLabel, vocabulary }) {
  const label = useDraft(data.label)
  const actions = (data.actions ?? []).map(normalizeAction)
  const setActions = (next) => onChange({ actions: next })

  return (
    <>
      <Field label={t('Número / nombre')}>
        {/* Al terminar de editar el número se actualizan las referencias a la etapa (X5, 5s/X5). */}
        <input
          className={inputClass}
          value={label.text}
          onFocus={label.focus}
          onChange={(e) => {
            label.set(e.target.value)
            onChange({ label: e.target.value })
          }}
          onBlur={() => {
            label.blur()
            onCommitLabel?.()
          }}
          onKeyDown={(e) => e.key === 'Enter' && onCommitLabel?.()}
          autoFocus
        />
      </Field>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!data.initial}
            onChange={(e) => onChange({ initial: e.target.checked, ...(e.target.checked ? { macro: false } : {}) })}
          />
          {t('Etapa inicial')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!data.macro}
            onChange={(e) => onChange({ macro: e.target.checked, ...(e.target.checked ? { initial: false, encapsulating: false } : {}) })}
          />
          {t('Macroetapa')}
          <span className="text-xs text-slate-400">{t('(se detalla en otro grafcet; p. ej. M1)')}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!data.encapsulating}
            onChange={(e) => onChange({ encapsulating: e.target.checked, ...(e.target.checked ? { macro: false } : {}) })}
          />
          {t('Etapa encapsulante')}
          <span className="text-xs text-slate-400">{t('(clic derecho en la etapa para crear su grafcet encapsulado)')}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!data.activationLink} onChange={(e) => onChange({ activationLink: e.target.checked })} />
          {t('Enlace de activación (*)')}
          <span className="text-xs text-slate-400">{t('(se activa al activarse su etapa encapsulante)')}</span>
        </label>
      </div>

      <div className="space-y-2">
        <span className={sectionTitle}>{t('Acciones')}</span>
        {actions.length === 0 && <p className="text-sm text-slate-400">{t('Sin acciones asociadas.')}</p>}
        {actions.map((action, i) => (
          <ActionRow
            key={i}
            vocabulary={vocabulary}
            // Textos de las demás acciones de la etapa: lo que aparece en ellas no es una errata.
            otherTexts={actions.filter((_, j) => j !== i).flatMap((a) => [a.text, a.condition ?? ''])}
            action={action}
            onChange={(patch) => setActions(actions.map((a, j) => (j === i ? { ...a, ...patch } : a)))}
            onRemove={() => setActions(actions.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          onClick={() => setActions([...actions, normalizeAction('')])}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-blue-600 hover:bg-blue-50"
        >
          <Plus size={16} />{' '}{t('Añadir acción')}
        </button>
        <Presets
          title={t('Añadir acción habitual')}
          values={ACTION_PRESETS}
          render={(a) => `${kindMarker[a.kind] ?? ''}${a.text}`}
          onPick={(a) => setActions([...actions, normalizeAction(a)])}
        />
      </div>
    </>
  )
}

function TransitionFields({ data, onChange, previousSteps, vocabulary }) {
  const inputRef = useRef(null)
  const condition = data.condition ?? ''

  // Inserta texto en la posición del cursor y lo deja colocado detrás.
  const insert = (text) => {
    const el = inputRef.current
    const start = el?.selectionStart ?? condition.length
    const end = el?.selectionEnd ?? condition.length
    onChange({ condition: condition.slice(0, start) + text + condition.slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + text.length, start + text.length)
    })
  }

  // Temporización normalizada referida a la etapa anterior: "5s/X2" (5 s desde que se activó X2).
  const timePresets = previousSteps.length ? previousSteps.map((label) => `5s/X${label}`) : ['5s/X1']
  const presets = ['1', 'a · b', 'a + b', '↑a', '↓a', ...timePresets, 'a AND b', 'a OR b']

  return (
    <>
      <Field label={t('Receptividad / condición')}>
        <AutocompleteInput
          inputRef={inputRef}
          vocabulary={vocabulary}
          className={inputClass}
          value={condition}
          placeholder={t('p. ej. a · b, ↑c, 5s/X2')}
          onChange={(c) => onChange({ condition: c })}
          autoFocus
        />
      </Field>
      <div className="flex gap-1">
        {CONDITION_SYMBOLS.map((s) => (
          <button
            key={s.symbol}
            type="button"
            title={t(s.title)}
            onClick={() => insert(s.symbol)}
            className="h-8 w-8 rounded-md border border-slate-300 font-mono text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50"
          >
            {s.label ?? s.symbol}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        <code className="font-mono">!a</code> o <code className="font-mono">!(a + b)</code> se dibujan con raya encima.{' '}
        <code className="font-mono">5s/X2</code>{t(': verdadera 5 s después de activarse la etapa 2.')}
      </p>
      <Presets title={t('Receptividades frecuentes')} values={presets} onPick={(v) => onChange({ condition: v })} />
    </>
  )
}

export default function PropertiesPanel({ node, onChange, onCommitLabel, onClose, previousSteps = [], vocabulary = [] }) {
  if (!node) return null
  const isStep = node.type === 'step'

  return (
    <aside className="side-panel flex w-72 shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold">{isStep ? t('Etapa') : t('Transición')}</h2>
        <button type="button" onClick={onClose} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-4">
        {isStep ? (
          <StepFields key={node.id} data={node.data} onChange={onChange} onCommitLabel={onCommitLabel} vocabulary={vocabulary} />
        ) : (
          <TransitionFields key={node.id} data={node.data} onChange={onChange} previousSteps={previousSteps} vocabulary={vocabulary} />
        )}
      </div>
    </aside>
  )
}
