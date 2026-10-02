import { CornerLeftUp, X } from 'lucide-react'
import ConditionText from './ConditionText'

// Aviso flotante mientras la herramienta Bucle espera que se elija la etapa destino.
// Ofrece atajos a las etapas iniciales, el destino más habitual de un bucle.
export default function LoopPickerBanner({ source, initialSteps, onPick, onCancel }) {
  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm shadow-lg">
      <CornerLeftUp size={16} className="text-blue-600" />
      <span>
        Bucle desde <strong>{source.data.condition ? <ConditionText text={source.data.condition} /> : 'la transición'}</strong>:
        haz clic en la etapa destino
      </span>
      {initialSteps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onPick(step.id)}
          className="rounded-full border border-blue-300 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
        >
          Etapa {step.data.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onCancel}
        title="Cancelar (Esc)"
        className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
      >
        <X size={16} />
      </button>
    </div>
  )
}
