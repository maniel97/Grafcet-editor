import { useRef, useState } from 'react'
import { closest, currentWord, replaceWord, suggest, typos } from '../lib/autocomplete'
import { parseExpression } from '../lib/symbols'

const TYPE_LABEL = { input: 'entrada', output: 'salida', memory: 'marca', timer: 'temporizador', counter: 'contador', step: 'etapa' }

// Campo de texto con autocompletado de variables y etapas.
// - mode 'expression' (receptividades, condiciones): completa la palabra en el cursor.
// - mode 'action': «A:=expr» completa como una expresión; si no, el texto entero es la salida.
// Avisa de erratas: «Marha» es nueva y se parece a «Marcha» (con un botón para corregirla).
export default function AutocompleteInput({ value, onChange, vocabulary = [], otherTexts = [], mode = 'expression', inputRef, className, ...props }) {
  const ownRef = useRef(null)
  const ref = inputRef ?? ownRef
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [caret, setCaret] = useState(null)

  const text = value ?? ''
  const whole = mode === 'action' && !text.includes(':=')
  const at = whole ? (text.trim() ? { start: 0, end: text.length, word: text } : null) : currentWord(text, caret ?? text.length)
  const pool = whole ? vocabulary.filter((v) => v.type === 'output') : vocabulary
  const options = open && at ? suggest(pool, at.word) : []
  // Lo que solo existe por lo escrito en este campo no cuenta como variable conocida; lo que está
  // en otra acción del mismo elemento, sí.
  const names = vocabulary
    .filter((v) => v.type !== 'step' && (!v.here || otherTexts.some((t) => mentions(t, v.name))))
    .map((v) => v.name)
  const checked = whole ? text.trim() : mode === 'action' ? text.split(':=')[1] ?? '' : text
  // Erratas: en una acción de texto entero se compara todo el texto con las salidas existentes.
  const wholeMatch = whole && checked && !names.includes(checked) ? closest(checked, pool.map((v) => v.name)) : null
  const warnings = whole ? (wholeMatch ? [{ word: checked, suggestion: wholeMatch }] : []) : typos(checked, names)

  const accept = (option) => {
    const next = replaceWord(text, at, option.name)
    onChange(next.text)
    setOpen(false)
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(next.caret, next.caret)
      setCaret(next.caret)
    })
  }

  return (
    <div className="relative">
      <input
        ref={ref}
        className={className}
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
          setActive(0)
          setOpen(true)
        }}
        onKeyUp={(e) => ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) && setCaret(e.currentTarget.selectionStart)}
        onClick={(e) => setCaret(e.currentTarget.selectionStart)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!options.length) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length)
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault()
            accept(options[active])
          } else if (e.key === 'Escape') {
            // Cierra la lista sin cerrar el panel.
            e.stopPropagation()
            setOpen(false)
          }
        }}
        {...props}
      />
      {options.length > 0 && (
        <ul role="listbox" aria-label="Sugerencias" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {options.map((o, i) => (
            <li
              key={o.name}
              role="option"
              aria-selected={i === active}
              // mousedown: antes de que el campo pierda el foco.
              onMouseDown={(e) => {
                e.preventDefault()
                accept(o)
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-2 py-1 ${i === active ? 'bg-blue-50 text-blue-800' : 'text-slate-700'}`}
            >
              <span className="truncate font-mono">{o.name}</span>
              <span className="shrink-0 text-xs text-slate-400">{TYPE_LABEL[o.type] ?? o.type}</span>
            </li>
          ))}
        </ul>
      )}
      {warnings.map((w) => (
        <p key={w.word} className="mt-1 text-xs text-amber-700">
          «{w.word}» es una variable nueva. ¿Querías decir{' '}
          <button
            type="button"
            className="font-mono font-medium underline hover:text-amber-900"
            onClick={() => onChange(whole ? w.suggestion : fixWord(text, w.word, w.suggestion))}
          >
            {w.suggestion}
          </button>
          ?
        </p>
      ))}
    </div>
  )
}

// ¿Aparece `name` en `text` como nombre completo (o es el texto entero de una acción)?
function mentions(text, name) {
  if (String(text).trim() === name) return true
  return parseExpression(String(text).split(':=').pop()).inputs.includes(name)
}

// Sustituye una palabra completa (no trozos) en el texto.
function fixWord(text, word, by) {
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}_.])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_.])`, 'gu'), by)
}
