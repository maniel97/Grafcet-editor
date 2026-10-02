import { useCallback } from 'react'
import { Handle, useNodeConnections, useNodeId, useStore } from '@xyflow/react'
import { isValidGrafcetConnection } from '../lib/grafcetRules'

// Conector con estado visual (colores en index.css):
// - libre:      blanco con borde azul
// - conectado:  azul relleno
// - candidato:  verde mientras se arrastra una conexión que puede terminar aquí según las
//               reglas completas de la norma (lib/grafcetRules.js)
// Solo se ve al pasar por el nodo, al seleccionarlo o al conectar; nunca en las exportaciones.
export default function GrafcetHandle({ type, position }) {
  const nodeId = useNodeId()
  const connected = useNodeConnections({ handleType: type }).length > 0

  const candidate = useStore(
    useCallback(
      (s) => {
        const c = s.connection
        if (!c.inProgress || c.fromNode.id === nodeId || c.fromHandle?.type === type) return false
        // Se puede arrastrar desde una salida o desde una entrada: normaliza a origen -> destino.
        const connection =
          c.fromHandle?.type === 'source' ? { source: c.fromNode.id, target: nodeId } : { source: nodeId, target: c.fromNode.id }
        return isValidGrafcetConnection(connection, (id) => s.nodeLookup.get(id), s.edges)
      },
      [nodeId, type],
    ),
  )

  const state = candidate ? 'is-candidate' : connected ? 'is-connected' : 'is-free'
  return <Handle type={type} position={position} className={`grafcet-handle ${state}`} />
}
