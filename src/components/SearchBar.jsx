import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { normalizeAction } from '../lib/actions'
import { t } from '../lib/i18n'

// Texto en el que se busca cada elemento del lienzo.
function searchable(node) {
  const d = node.data
  switch (node.type) {
    case 'step':
      return [`etapa ${t(d.label)}`, `X${t(d.label)}`, ...(d.actions ?? []).flatMap((a) => [normalizeAction(a).text, normalizeAction(a).condition])]
    case 'transition':
      return [d.condition]
    case 'note':
      return [d.text]
    case 'frame':
      return [d.name]
    default:
      return []
  }
}
const fold = (v) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// Buscar en el diagrama (Ctrl+F): etapas, receptividades, acciones, notas y marcos. Intro salta a
// la siguiente coincidencia (Mayús+Intro, a la anterior) y la centra; Esc cierra.
export default function SearchBar({ nodes, onFocus, onClose }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false) // ya se ha saltado al resultado actual
  const matches = useMemo(() => {
    const q = fold(query.trim())
    if (!q) return []
    // De arriba abajo y de izquierda a derecha, como se lee el diagrama.
    return nodes
      .filter((n) => searchable(n).some((v) => fold(v).includes(q)))
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x)
  }, [nodes, query])

  const go = (i) => {
    if (!matches.length) return
    const next = (i + matches.length) % matches.length
    setIndex(next)
    setShown(true)
    onFocus(matches[next].id)
  }

  return (
    <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 shadow-lg" role="search">
      <Search size={14} className="text-slate-400" />
      <input
        autoFocus
        aria-label={t('Buscar en el diagrama')}
        placeholder={t('Buscar etapa, variable, texto…')}
        className="w-56 bg-transparent px-1 py-0.5 text-sm outline-none"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIndex(0)
          setShown(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            // La primera vez va al resultado actual; después, al siguiente o al anterior.
            go(shown ? index + (e.shiftKey ? -1 : 1) : index)
          }
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      />
      <span className="min-w-12 text-right text-xs tabular-nums text-slate-500" aria-live="polite">
        {query.trim() ? (matches.length ? t('{n} de {total}', { n: index + 1, total: matches.length }) : t('Sin resultados')) : ''}
      </span>
      <button type="button" aria-label={t('Anterior')} className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30" disabled={!matches.length} onClick={() => go(index - 1)}>
        <ChevronUp size={14} />
      </button>
      <button type="button" aria-label={t('Siguiente')} className="rounded p-0.5 hover:bg-slate-100 disabled:opacity-30" disabled={!matches.length} onClick={() => go(index + 1)}>
        <ChevronDown size={14} />
      </button>
      <button type="button" aria-label={t('Cerrar la búsqueda')} title={t('Cerrar (Esc)')} className="rounded p-0.5 hover:bg-slate-100" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  )
}
