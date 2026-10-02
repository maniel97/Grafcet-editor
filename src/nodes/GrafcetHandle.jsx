import { Handle, useNodeId, useReactFlow } from '@xyflow/react'
import { isValidGrafcetConnection } from '../lib/grafcetRules'
import { useEditor } from '../lib/editorContext'

// Conector con estado visual (colores en index.css):
// - libre:      blanco con borde azul
// - conectado:  azul relleno
// - candidato:  verde mientras se arrastra una conexión que puede terminar aquí según las
//               reglas completas de la norma (lib/grafcetRules.js)
// Solo se ve al pasar por el nodo, al seleccionarlo o al conectar; nunca en las exportaciones.
//
// Rendimiento: no se suscribe al estado del lienzo. `connected` lo calcula el nodo (una vez para
// sus dos conectores) y la conexión en curso llega por contexto solo al empezar y al terminarla;
// así, con cientos de conectores, un arrastre no obliga a comprobarlos todos en cada movimiento.
export default function GrafcetHandle({ type, position, connected }) {
  const nodeId = useNodeId()
  const { connecting } = useEditor()
  const { getNode, getEdges } = useReactFlow()

  let candidate = false
  if (connecting && connecting.nodeId !== nodeId && connecting.handleType !== type) {
    // Se puede arrastrar desde una salida o desde una entrada: normaliza a origen -> destino.
    const connection =
      connecting.handleType === 'source' ? { source: connecting.nodeId, target: nodeId } : { source: nodeId, target: connecting.nodeId }
    candidate = isValidGrafcetConnection(connection, getNode, getEdges())
  }

  const state = candidate ? 'is-candidate' : connected ? 'is-connected' : 'is-free'
  return <Handle type={type} position={position} className={`grafcet-handle ${state}`} />
}
