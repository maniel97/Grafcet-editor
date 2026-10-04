import { useState } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { useEditor } from '../lib/editorContext'
import { FRAME_KINDS, FRAME_MIN } from '../lib/frames'
import { t } from '../lib/i18n'

// Marco con nombre (lib/frames.js): grafcet parcial «G1», expansión de macroetapa «M1» o grafcet
// encapsulado (arriba, el número de su etapa encapsulante; abajo, su nombre, como en la norma).
// Solo el rótulo de arriba atrapa el ratón: por él se selecciona y se arrastra (con todo su
// contenido); el interior deja pasar los clics a lo que hay dentro y detrás. Doble clic en un
// rótulo para cambiarlo.
export default function FrameNode({ id, data, selected }) {
  const { takeSnapshot, readOnly } = useEditor()
  const { updateNodeData } = useReactFlow()
  const [draft, setDraft] = useState(null) // { field, value }
  const kind = FRAME_KINDS[data.kind] ?? FRAME_KINDS.grafcet
  const encapsulation = data.kind === 'encapsulation'
  const color = selected ? '#3b82f6' : '#475569'
  const topField = encapsulation ? 'step' : 'name'

  const finish = (save) => {
    const value = draft?.value.trim()
    if (save && value && value !== data[draft.field]) {
      takeSnapshot()
      updateNodeData(id, { [draft.field]: value })
    }
    setDraft(null)
  }
  const edit = (field) => (e) => {
    if (readOnly) return
    e.stopPropagation()
    setDraft({ field, value: String(data[field] ?? '') })
  }
  const label = (field, text) =>
    draft?.field === field ? (
      <input
        autoFocus
        aria-label={field === 'step' ? t('Etapa encapsulante') : t('Nombre del marco')}
        className="nodrag diagram-text w-24 rounded border border-blue-500 bg-white px-1 font-bold outline-none"
        value={draft.value}
        onChange={(e) => setDraft({ field, value: e.target.value })}
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
      <span className="diagram-text font-bold" style={{ color }}>
        {text}
      </span>
    )

  return (
    <>
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={FRAME_MIN.width}
        minHeight={FRAME_MIN.height}
        color="#3b82f6"
        onResizeStart={() => takeSnapshot()}
      />
      <div
        data-frame-body
        className="pointer-events-none h-full w-full rounded-sm border-[1.5px] border-dashed"
        style={{ borderColor: color }}
      />
      <div
        className="pointer-events-auto absolute left-0 top-0 -translate-y-full cursor-move px-1 pb-0.5"
        title={t('{tipo}: arrastra para mover el marco con su contenido; doble clic para renombrar', { tipo: t(kind.label) })}
        onDoubleClick={edit(topField)}
      >
        {label(topField, encapsulation ? data.step : data.name)}
      </div>
      {encapsulation && (
        <div
          className="pointer-events-auto absolute bottom-0 left-3 translate-y-1/2 bg-white px-1"
          title={t('Nombre del grafcet encapsulado: doble clic para cambiarlo')}
          onDoubleClick={edit('name')}
        >
          {label('name', data.name)}
        </div>
      )}
    </>
  )
}
