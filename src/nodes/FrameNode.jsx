import { useState } from 'react'
import { NodeResizer, useReactFlow } from '@xyflow/react'
import { useEditor } from '../lib/editorContext'
import { FRAME_KINDS, FRAME_MIN } from '../lib/frames'
import { t } from '../lib/i18n'

// Marco con nombre (lib/frames.js): grafcet parcial «G1» o expansión de macroetapa «M1».
// Solo el nombre (arriba a la izquierda) atrapa el ratón: por él se selecciona y se arrastra
// (con todo su contenido); el interior deja pasar los clics a lo que hay dentro y detrás.
// Doble clic en el nombre para cambiarlo.
export default function FrameNode({ id, data, selected }) {
  const { takeSnapshot, readOnly } = useEditor()
  const { updateNodeData } = useReactFlow()
  const [draft, setDraft] = useState(null)
  const kind = FRAME_KINDS[data.kind] ?? FRAME_KINDS.grafcet
  const color = selected ? '#3b82f6' : '#475569'

  const finish = (save) => {
    const name = draft?.trim()
    if (save && name && name !== data.name) {
      takeSnapshot()
      updateNodeData(id, { name })
    }
    setDraft(null)
  }

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
        onDoubleClick={(e) => {
          if (readOnly) return
          e.stopPropagation()
          setDraft(data.name ?? '')
        }}
      >
        {draft !== null ? (
          <input
            autoFocus
            aria-label={t('Nombre del marco')}
            className="nodrag diagram-text w-24 rounded border border-blue-500 bg-white px-1 font-bold outline-none"
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
          <span className="diagram-text font-bold" style={{ color }}>
            {data.name}
          </span>
        )}
      </div>
    </>
  )
}
