import { Panel, useReactFlow } from '@xyflow/react'
import { Lock, LockOpen, Scan, ZoomIn, ZoomOut } from 'lucide-react'
import { t } from '../lib/i18n'

function ControlButton({ icon: Icon, label, onClick, active, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t(label)}
      aria-label={t(label)}
      aria-pressed={active}
      className={`flex h-8 w-8 items-center justify-center border-b border-slate-200 last:border-b-0 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-amber-50 text-amber-700' : 'text-slate-700'
      }`}
    >
      <Icon size={16} />
    </button>
  )
}

// Controles del lienzo en español (sustituyen a los de React Flow, con textos en inglés):
// acercar, alejar, encuadrar todo lo dibujado y bloquear la edición.
export default function CanvasControls({ onFitView, locked, onToggleLock, lockDisabled }) {
  const { zoomIn, zoomOut } = useReactFlow()
  return (
    <Panel position="bottom-left" className="editor-only">
      <div className="flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <ControlButton icon={ZoomIn} label="Acercar" onClick={() => zoomIn({ duration: 200 })} />
        <ControlButton icon={ZoomOut} label="Alejar" onClick={() => zoomOut({ duration: 200 })} />
        <ControlButton icon={Scan} label="Encuadrar todo el diagrama" onClick={() => onFitView()} />
        <ControlButton
          icon={locked ? Lock : LockOpen}
          label={
            lockDisabled
              ? 'La edición ya está bloqueada mientras se simula'
              : locked
                ? 'Desbloquear la edición'
                : 'Bloquear la edición (solo mirar: desplazar y hacer zoom)'
          }
          onClick={onToggleLock}
          active={locked}
          disabled={lockDisabled}
        />
      </div>
    </Panel>
  )
}
