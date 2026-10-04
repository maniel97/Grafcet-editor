import { useState } from 'react'
import { EyeOff, GripVertical, Maximize2, MessageSquare, Trash2, WandSparkles } from 'lucide-react'
import { useEditor } from '../lib/editorContext'
import { VARIABLE_TYPES, duplicatedAddresses } from '../lib/addressing'
import { resolveStepPrefix, stepVar } from '../lib/stepNames'
import { describeRange, isAnalog } from '../lib/analog'
import { t, N_ } from '../lib/i18n'

const DRAG_MIME = 'application/x-grafcet-variable'

// Celda que se edita al hacer clic: Intro o salir del campo confirma, Esc cancela.
// `autoEdit` la abre en edición al aparecer (variable recién añadida). Si `onCommit` devuelve
// false (p. ej. nombre repetido), el valor no se acepta.
function EditableCell({ value, placeholder, onCommit, className = '', invalid, autoEdit, title = N_('Clic para editar'), readOnly }) {
  const [draft, setDraft] = useState(autoEdit && !readOnly ? (value ?? '') : null)
  if (readOnly) {
    return (
      <span className={`block truncate px-1 ${invalid ? 'bg-red-50 text-red-700' : ''} ${value ? '' : 'text-slate-300'} ${className}`}>
        {value || <span className="canvas-hint">{placeholder}</span>}
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
      title={t(title)}
      onClick={() => setDraft(value ?? '')}
      className={`nodrag w-full cursor-text truncate rounded px-1 text-left hover:bg-blue-50 ${
        invalid ? 'bg-red-50 text-red-700' : ''
      } ${value ? '' : 'text-slate-300'} ${className}`}
    >
      {value || <span className="canvas-hint">{placeholder}</span>}
    </button>
  )
}

function HeaderButton({ icon: Icon, title, onClick, active }) {
  return (
    <button
      type="button"
      title={t(title)}
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
          extra: isAnalog(typeId) ? describeRange(entry) : (entry.preset ?? found.preset),
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
    { id: 'steps', title: N_('Etapas'), rows: stepRows },
    ...VARIABLE_TYPES.map((v) => ({ id: v.id, title: v.plural, rows: variableRows(v.id), droppable: true })),
  ]
  // Durante un arrastre se muestran también las secciones vacías, para poder soltar en ellas.
  const visible = sections.filter((s) => s.rows.length || (dragging && s.droppable))
  // Columnas comunes a todas las filas (si cada fila calculara las suyas, un nombre largo
  // desplazaría su dirección y su comentario). La primera, a la medida del nombre más largo
  // (letra monoespaciada: 1ch por carácter) más el asa de arrastre y la preselección.
  const longest = Math.max(
    6,
    ...visible.flatMap((sec) => sec.rows.map((r) => String(r.name).length + (r.extra ? String(r.extra).length + 3 : 0))),
  )
  const columns = { gridTemplateColumns: `max(5rem, calc(${longest}ch + 1.5rem)) 6rem${showComments ? ' minmax(7rem, 1fr)' : ''}` }

  return (
    <div
      // Pendiente de colocarse junto al grafcet (ejemplos): lo espera también alguna prueba.
      data-auto-place={data.autoPlace ? 'pending' : undefined}
      className={`diagram-text min-w-[220px] border-2 bg-white text-[0.85em] ${selected ? 'border-blue-500' : 'border-slate-900'}`}
      onMouseLeave={() => setHighlight(null)}
    >
      <div className="flex items-center gap-1 border-b-2 border-slate-900 bg-slate-100 px-2 py-1">
        <span className="flex-1 font-semibold">{t('Tabla de variables')}</span>
        {!readOnly && (
          <>
            <HeaderButton icon={WandSparkles} title={t('Rellenar direcciones vacías')} onClick={autoFill} />
            <HeaderButton icon={MessageSquare} title={t('Mostrar u ocultar comentarios')} onClick={() => toggleComments(id)} active={showComments} />
            <HeaderButton icon={Maximize2} title={t('Abrir la tabla completa')} onClick={openDialog} />
            <HeaderButton icon={EyeOff} title={t('Ocultar del lienzo')} onClick={hideTable} />
          </>
        )}
      </div>

      {visible.length === 0 && (
        <p className="px-3 py-2 text-slate-400">{t('Sin etapas ni variables todavía.')}</p>
      )}

      {visible.map((section) => (
        <section
          key={section.id}
          onDragOver={(e) => {
            if (!section.droppable || !e.dataTransfer.types.includes(DRAG_MIME)) return
            e.preventDefault()
            setDropTarget(section.id)
          }}
          onDragLeave={() => setDropTarget((v) => (v === section.id ? null : v))}
          onDrop={(e) => {
            const name = e.dataTransfer.getData(DRAG_MIME)
            setDropTarget(null)
            setDragging(null)
            if (name && section.droppable) setVariableType(name, section.id)
          }}
          className={dropTarget === section.id ? 'bg-blue-50 outline-2 -outline-offset-2 outline-blue-400 outline-dashed' : ''}
        >
          {/* Cabecera de la sección con los títulos de las columnas, alineados con las filas. */}
          <div
            style={columns}
            // Tamaño y grosor de letra van en cada título, no en la rejilla: las columnas se miden en
            // «ch» (anchura del «0» de su letra) y tienen que medir lo mismo que las de las filas.
            className="grid items-baseline gap-x-1 border-b border-slate-300 bg-slate-50 px-1 py-0.5 uppercase tracking-wide text-slate-600"
          >
            <span className="truncate px-1 text-[0.8em] font-semibold">
              {t(section.title)}
              {!section.rows.length && <span className="canvas-hint ml-1 font-normal normal-case text-slate-400">{t('— suelta aquí')}</span>}
            </span>
            <span className="truncate px-1 text-[0.8em] font-medium text-slate-500">{t('Dirección')}</span>
            {showComments && <span className="truncate px-1 text-[0.8em] font-medium text-slate-500">{t('Comentario')}</span>}
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
              style={columns}
              className={`nodrag group grid items-center gap-x-1 border-b border-slate-100 px-1 py-px last:border-b-0 hover:bg-amber-50`}
            >
              <span className="flex min-w-0 items-center gap-0.5 font-mono">
                {row.draggable && !readOnly && (
                  <GripVertical
                    size={12}
                    className="editor-only shrink-0 cursor-grab text-slate-300 group-hover:text-slate-500"
                    aria-label={t('Arrastrar a otra sección para cambiar el tipo')}
                  />
                )}
                {row.unused ? (
                  <EditableCell
                    readOnly={readOnly}
                    value={row.name}
                    autoEdit={row.name === lastAdded}
                    title={t('Sin uso en el diagrama todavía. Clic para renombrar')}
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
                    title={t('Quitar de la tabla')}
                    aria-label={t('Quitar {variable} de la tabla', { variable: row.name })}
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
              {showComments && <EditableCell readOnly={readOnly} value={row.comment} placeholder={t('comentario')} onCommit={row.setComment} />}
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
