import { useState } from 'react'
import { EyeOff, GripVertical, Maximize2, MessageSquare, Trash2, WandSparkles } from 'lucide-react'
import { useEditor } from '../lib/editorContext'
import { VARIABLE_TYPES, duplicatedAddresses } from '../lib/addressing'
import { resolveStepPrefix, stepVar } from '../lib/stepNames'

const DRAG_MIME = 'application/x-grafcet-variable'

// Celda que se edita al hacer clic: Intro o salir del campo confirma, Esc cancela.
// `autoEdit` la abre en edición al aparecer (variable recién añadida). Si `onCommit` devuelve
// false (p. ej. nombre repetido), el valor no se acepta.
function EditableCell({ value, placeholder, onCommit, className = '', invalid, autoEdit, title = 'Clic para editar', readOnly }) {
  const [draft, setDraft] = useState(autoEdit && !readOnly ? (value ?? '') : null)
  if (readOnly) {
    return (
      <span className={`block truncate px-1 ${invalid ? 'bg-red-50 text-red-700' : ''} ${value ? '' : 'text-slate-300'} ${className}`}>
        {value || placeholder}
      </span>
    )
  }
  if (draft !== null) {
    const commit = () => {
      if (draft !== (value ?? '')) onCommit(draft)
      setDraft(null)
    }
    return (
      <input
        autoFocus
        onFocus={(e) => e.target.select()}
        className={`nodrag nopan w-full min-w-0 rounded border border-blue-500 bg-white px-1 outline-none ${className}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            e.stopPropagation()
            setDraft(null)
          }
        }}
      />
    )
  }
  return (
    <button
      type="button"
      title={title}
      onClick={() => setDraft(value ?? '')}
      className={`nodrag w-full cursor-text truncate rounded px-1 text-left hover:bg-blue-50 ${
        invalid ? 'bg-red-50 text-red-700' : ''
      } ${value ? '' : 'text-slate-300'} ${className}`}
    >
      {value || placeholder}
    </button>
  )
}

function HeaderButton({ icon: Icon, title, onClick, active }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`nodrag editor-only rounded p-1 hover:bg-slate-200 ${active ? 'text-blue-600' : 'text-slate-500'}`}
    >
      <Icon size={14} />
    </button>
  )
}

// Tabla de variables dibujada en el lienzo, organizada por secciones (etapas, entradas,
// salidas, marcas, temporizadores, contadores). Se edita en el sitio y se reorganiza sola:
// arrastrar una variable a otra sección cambia su tipo.
export default function VariablesTableNode({ id, data, selected }) {
  // En solo lectura (simulando o con la edición bloqueada) la tabla se ve pero no se edita.
  const { plcTable, setHighlight, readOnly } = useEditor()
  const [dragging, setDragging] = useState(null) // nombre de la variable que se arrastra
  const [dropTarget, setDropTarget] = useState(null)
  if (!plcTable) return null

  const {
    plc,
    symbols,
    stepNodes,
    changePlc,
    setVariableType,
    autoFill,
    openDialog,
    hideTable,
    toggleComments,
    lastAdded,
    renameVariable,
    deleteVariable,
  } = plcTable
  const showComments = data.showComments ?? true
  const duplicated = duplicatedAddresses(plc, stepNodes, symbols)
  const isDup = (a) => !!a?.trim() && duplicated.has(a.trim().toUpperCase())

  const stepRows = [...stepNodes]
    .sort((a, b) => String(a.data.label).localeCompare(String(b.data.label), 'es', { numeric: true }))
    .map((s) => ({
      key: s.id,
      name: stepVar(s.data.label, resolveStepPrefix(plc)),
      address: plc.steps[s.id]?.address,
      comment: plc.steps[s.id]?.comment,
      uses: [s.id],
      setAddress: (v) => changePlc((p) => ({ ...p, steps: { ...p.steps, [s.id]: { ...p.steps[s.id], address: v } } })),
      setComment: (v) => changePlc((p) => ({ ...p, steps: { ...p.steps, [s.id]: { ...p.steps[s.id], comment: v } } })),
    }))

  const variableRows = (typeId) =>
    [...symbols]
      .filter(([name, found]) => (plc.variables[name]?.type ?? found.type) === typeId)
      .map(([name, found]) => {
        const entry = plc.variables[name] ?? {}
        const update = (patch) =>
          changePlc((p) => ({ ...p, variables: { ...p.variables, [name]: { ...p.variables[name], type: typeId, ...patch } } }))
        return {
          key: name,
          name,
          extra: entry.preset ?? found.preset,
          address: entry.address,
          comment: entry.comment,
          uses: [...found.uses],
          // Añadida a mano y aún sin uso en el diagrama: se puede renombrar y borrar.
          unused: found.uses.size === 0,
          draggable: true,
          setAddress: (v) => update({ address: v }),
          setComment: (v) => update({ comment: v }),
        }
      })

  const sections = [
    { id: 'steps', title: 'Etapas', rows: stepRows },
    ...VARIABLE_TYPES.map((t) => ({ id: t.id, title: t.plural, rows: variableRows(t.id), droppable: true })),
  ]
  // Durante un arrastre se muestran también las secciones vacías, para poder soltar en ellas.
  const visible = sections.filter((s) => s.rows.length || (dragging && s.droppable))
  const cols = showComments ? 'grid-cols-[minmax(5rem,auto)_6rem_minmax(7rem,1fr)]' : 'grid-cols-[minmax(5rem,auto)_6rem]'

  return (
    <div
      className={`diagram-text min-w-[220px] border-2 bg-white text-[0.85em] ${selected ? 'border-blue-500' : 'border-slate-900'}`}
      onMouseLeave={() => setHighlight(null)}
    >
      <div className="flex items-center gap-1 border-b-2 border-slate-900 bg-slate-100 px-2 py-1">
        <span className="flex-1 font-semibold">Tabla de variables</span>
        {!readOnly && (
          <>
            <HeaderButton icon={WandSparkles} title="Rellenar direcciones vacías" onClick={autoFill} />
            <HeaderButton icon={MessageSquare} title="Mostrar u ocultar comentarios" onClick={() => toggleComments(id)} active={showComments} />
            <HeaderButton icon={Maximize2} title="Abrir la tabla completa" onClick={openDialog} />
            <HeaderButton icon={EyeOff} title="Ocultar del lienzo" onClick={hideTable} />
          </>
        )}
      </div>

      {visible.length === 0 && (
        <p className="px-3 py-2 text-slate-400">Sin etapas ni variables todavía.</p>
      )}

      {visible.map((section) => (
        <section
          key={section.id}
          onDragOver={(e) => {
            if (!section.droppable || !e.dataTransfer.types.includes(DRAG_MIME)) return
            e.preventDefault()
            setDropTarget(section.id)
          }}
          onDragLeave={() => setDropTarget((t) => (t === section.id ? null : t))}
          onDrop={(e) => {
            const name = e.dataTransfer.getData(DRAG_MIME)
            setDropTarget(null)
            setDragging(null)
            if (name && section.droppable) setVariableType(name, section.id)
          }}
          className={dropTarget === section.id ? 'bg-blue-50 outline-2 -outline-offset-2 outline-blue-400 outline-dashed' : ''}
        >
          <div className="border-b border-slate-300 bg-slate-50 px-2 py-0.5 text-[0.8em] font-semibold uppercase tracking-wide text-slate-600">
            {section.title}
            {!section.rows.length && <span className="ml-1 font-normal normal-case text-slate-400">— suelta aquí</span>}
          </div>
          {section.rows.map((row) => (
            <div
              key={row.key}
              draggable={row.draggable && !readOnly}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, row.name)
                e.dataTransfer.effectAllowed = 'move'
                setDragging(row.name)
              }}
              onDragEnd={() => {
                setDragging(null)
                setDropTarget(null)
              }}
              onMouseEnter={() => setHighlight(new Set(row.uses))}
              className={`nodrag group grid ${cols} items-center gap-x-1 border-b border-slate-100 px-1 py-px last:border-b-0 hover:bg-amber-50`}
            >
              <span className="flex min-w-0 items-center gap-0.5 font-mono">
                {row.draggable && !readOnly && (
                  <GripVertical
                    size={12}
                    className="editor-only shrink-0 cursor-grab text-slate-300 group-hover:text-slate-500"
                    aria-label="Arrastrar a otra sección para cambiar el tipo"
                  />
                )}
                {row.unused ? (
                  <EditableCell
                    readOnly={readOnly}
                    value={row.name}
                    autoEdit={row.name === lastAdded}
                    title="Sin uso en el diagrama todavía. Clic para renombrar"
                    className="italic text-slate-500"
                    onCommit={(v) => renameVariable(row.name, v)}
                  />
                ) : (
                  <span className="truncate" title={row.name}>
                    {row.name}
                  </span>
                )}
                {row.extra && <span className="shrink-0 text-[0.85em] text-slate-400">({row.extra})</span>}
                {row.unused && !readOnly && (
                  <button
                    type="button"
                    title="Quitar de la tabla"
                    aria-label={`Quitar ${row.name} de la tabla`}
                    onClick={() => deleteVariable(row.name)}
                    className="nodrag editor-only shrink-0 rounded p-0.5 text-slate-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </span>
              <EditableCell
                readOnly={readOnly}
                value={row.address}
                placeholder="—"
                className="font-mono"
                invalid={isDup(row.address)}
                onCommit={row.setAddress}
              />
              {showComments && <EditableCell readOnly={readOnly} value={row.comment} placeholder="comentario" onCommit={row.setComment} />}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
