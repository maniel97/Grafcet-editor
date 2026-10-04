import { useCallback, useEffect, useRef } from 'react'
import { NodeToolbar, Position, useStore } from '@xyflow/react'
import { CornerLeftUp, Plus } from 'lucide-react'
import { useQuickConnect } from '../lib/useQuickConnect'
import { useStructureActions } from '../lib/useStructureActions'
import { useEditor } from '../lib/editorContext'
import { t } from '../lib/i18n'

// En pantallas táctiles los botones son mayores para poder pulsarlos con el dedo.
const COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const BUTTON_SIZE = COARSE ? 36 : 24
const zoomSelector = (s) => s.transform[2]

// Botón redondo flotante junto al nodo seleccionado.
// `centerX` (en unidades del lienzo, desde el borde izquierdo del nodo) centra el botón en ese
// punto en lugar de en el nodo entero. La barra flotante no se escala con el zoom, así que el
// desplazamiento se convierte a píxeles de pantalla con el zoom actual.
// Con `disabled` se muestra en gris y no hace nada; se usa aria-disabled en vez del atributo
// disabled para que el tooltip explicativo siga apareciendo al pasar el ratón.
// `preview` (ver GhostPreview) se muestra en el lienzo mientras el ratón está encima.
function FloatingButton({ position, title, onClick, centerX, disabled = false, preview, icon: Icon = Plus }) {
  const zoom = useStore(zoomSelector)
  const { setPreview, readOnly } = useEditor()
  const showingPreview = useRef(false)
  const anchored = centerX !== undefined

  const hidePreview = useCallback(() => {
    if (!showingPreview.current) return
    showingPreview.current = false
    setPreview(null)
  }, [setPreview])

  // El botón desaparece al deseleccionar el nodo sin que llegue un mouseleave: limpia la vista previa.
  useEffect(() => hidePreview, [hidePreview])

  // En solo lectura (simulando o con la edición bloqueada) no hay botones flotantes.
  if (readOnly) return null

  return (
    // offset 16: deja hueco con el conector de 14px, que sobresale 7px del borde del nodo.
    <NodeToolbar position={position} align={anchored ? 'start' : 'center'} offset={16}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-disabled={disabled}
        onMouseEnter={() => {
          if (!preview || disabled) return
          showingPreview.current = true
          setPreview(preview)
        }}
        onMouseLeave={hidePreview}
        onClick={
          disabled
            ? undefined
            : () => {
                hidePreview()
                onClick()
              }
        }
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, ...(anchored ? { marginLeft: centerX * zoom - BUTTON_SIZE / 2 } : {}) }}
        className={`flex items-center justify-center rounded-full shadow-md ${
          disabled
            ? 'cursor-not-allowed bg-slate-300 text-slate-500'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
        }`}
      >
        <Icon size={COARSE ? 20 : 16} strokeWidth={2.5} />
      </button>
    </NodeToolbar>
  )
}

// "+" debajo del nodo: crea el siguiente elemento de la secuencia conectado en vertical.
export default function QuickConnectButton({ nodeId, title, centerX, disabled }) {
  const quickConnect = useQuickConnect()
  return (
    <FloatingButton
      position={Position.Bottom}
      title={title}
      centerX={centerX}
      disabled={disabled}
      preview={{ kind: 'next', nodeId }}
      onClick={() => quickConnect(nodeId)}
    />
  )
}

// "+" a la derecha de la etapa: le añade una acción al final de las existentes.
export function AddActionButton({ nodeId }) {
  const { addAction } = useStructureActions()
  return (
    <FloatingButton
      position={Position.Right}
      title={t('Añadir acción')}
      preview={{ kind: 'action', nodeId }}
      onClick={() => addAction(nodeId)}
    />
  )
}

// Botón de bucle a la izquierda de la transición (lado por el que se dibujan los bucles):
// inicia la selección de la etapa a la que se vuelve.
export function LoopButton({ nodeId, title, disabled }) {
  const { startLoop } = useEditor()
  return (
    <FloatingButton
      position={Position.Left}
      icon={CornerLeftUp}
      title={title}
      disabled={disabled}
      onClick={() => startLoop(nodeId)}
    />
  )
}
