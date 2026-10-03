import { useState } from 'react'
import { Plus, X } from 'lucide-react'

// Pestañas de hojas (abajo del lienzo): cambiar de hoja, añadir, renombrar (doble clic) y borrar.
export default function SheetTabs({ sheets, current, counts, onSelect, onAdd, onRename, onDelete, readOnly }) {
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const finish = (save) => {
    if (save && draft.trim()) onRename(editing, draft.trim())
    setEditing(null)
  }
  return (
    <div className="editor-only absolute bottom-3 left-16 z-10 flex max-w-[60%] items-center gap-0.5 overflow-x-auto rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm" role="tablist" aria-label="Hojas">
      {sheets.map((s) =>
        editing === s.id ? (
          <input
            key={s.id}
            autoFocus
            aria-label="Nombre de la hoja"
            className="w-24 rounded border border-blue-500 px-1 py-0.5 outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finish(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finish(true)
              if (e.key === 'Escape') {
                e.stopPropagation()
                finish(false)
              }
            }}
          />
        ) : (
          <span key={s.id} className={`group flex items-center rounded ${s.id === current ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
            <button
              type="button"
              role="tab"
              aria-selected={s.id === current}
              title={`${s.name}: ${counts.get(s.id) ?? 0} elementos (doble clic para renombrar)`}
              onClick={() => onSelect(s.id)}
              onDoubleClick={() => {
                if (readOnly) return
                setDraft(s.name)
                setEditing(s.id)
              }}
              className="whitespace-nowrap px-2 py-1"
            >
              {s.name}
            </button>
            {sheets.length > 1 && !readOnly && (
              <button
                type="button"
                aria-label={`Borrar ${s.name}`}
                title="Borrar la hoja y su contenido"
                onClick={() => onDelete(s.id)}
                className="mr-0.5 rounded p-0.5 opacity-0 hover:bg-red-500 hover:text-white group-hover:opacity-100"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ),
      )}
      {!readOnly && (
        <button type="button" onClick={onAdd} aria-label="Añadir hoja" title="Añadir hoja" className="rounded p-1 text-slate-600 hover:bg-slate-100">
          <Plus size={13} />
        </button>
      )}
    </div>
  )
}
