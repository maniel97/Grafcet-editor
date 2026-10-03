import { useEffect, useState } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { useEditor } from '../lib/editorContext'
import { NOTE_COLORS, parseNote } from '../lib/notes'

// Texto de la nota con su formato ligero (lib/notes.js: títulos, listas, negrita, variables).
function NoteText({ text }) {
  const spans = (list) =>
    list.map((s, i) =>
      s.code ? (
        <code key={i} className="rounded bg-black/5 px-0.5 font-mono text-[0.92em]">
          {s.text}
        </code>
      ) : s.bold ? (
        <strong key={i}>{s.text}</strong>
      ) : (
        <span key={i}>{s.text}</span>
      ),
    )
  return parseNote(text).map((b, i) =>
    b.kind === 'blank' ? (
      <div key={i} className="h-[0.6em]" />
    ) : b.kind === 'title' ? (
      <p key={i} className="text-[1.08em] font-bold">
        {spans(b.spans)}
      </p>
    ) : b.kind === 'item' ? (
      <p key={i} className="flex gap-1.5 pl-1">
        <span aria-hidden="true">•</span>
        <span>{spans(b.spans)}</span>
      </p>
    ) : (
      <p key={i} className="whitespace-pre-wrap">
        {spans(b.spans)}
      </p>
    ),
  )
}

// Nota de texto libre sobre el lienzo (enunciado, explicación, firma de un plano...). No forma
// parte del grafcet: la verificación, la simulación, el ladder y el trazado de enlaces la ignoran.
// Doble clic para editar (Esc cancela; clic fuera o Ctrl+Intro guarda); se redimensiona por las
// esquinas al seleccionarla.
export default function NoteNode({ id, data, selected }) {
  const { takeSnapshot, readOnly, editingNoteId, setEditingNoteId } = useEditor()
  const { updateNodeData } = useReactFlow()
  const [draft, setDraft] = useState(null)
  const color = NOTE_COLORS[data.color] ?? NOTE_COLORS.yellow

  // Edición pedida desde fuera (nota recién creada, menú contextual o doble clic).
  useEffect(() => {
    if (editingNoteId === id && !readOnly) setDraft(data.text ?? '')
    // Solo al pedirse la edición, no cada vez que cambia el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNoteId, id, readOnly])

  const finish = (save) => {
    if (save && draft !== (data.text ?? '')) {
      takeSnapshot()
      updateNodeData(id, { text: draft })
    }
    setDraft(null)
    setEditingNoteId(null)
  }

  return (
    <>
      <NodeResizer
        isVisible={selected && !readOnly && draft === null}
        minWidth={120}
        minHeight={50}
        color={color.border}
        onResizeStart={() => takeSnapshot()}
      />
      <div
        data-note-body
        className="h-full w-full overflow-hidden rounded-sm border-2 p-[10px] shadow-sm"
        style={{ background: color.bg, borderColor: selected ? '#3b82f6' : color.border }}
      >
        {draft !== null ? (
          <textarea
            autoFocus
            aria-label="Texto de la nota"
            className="nodrag nopan nowheel diagram-text h-full w-full resize-none bg-transparent outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => finish(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                finish(false)
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish(true)
            }}
          />
        ) : (
          <div className={`diagram-text h-full break-words ${data.text ? 'text-slate-800' : 'italic text-slate-400'}`}>
            {data.text ? <NoteText text={data.text} /> : <span className="canvas-hint">Doble clic para escribir</span>}
          </div>
        )}
      </div>
    </>
  )
}
