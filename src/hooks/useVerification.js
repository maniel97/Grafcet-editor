import { useDeferredValue, useMemo } from 'react'
import { issuesByNode, validateGrafcet } from '../lib/validation'

// Verificación de conformidad en vivo (lib/validation.js) más las comprobaciones de la tabla.
// Se calcula con prioridad baja (no frena el arrastre) y solo cambia si cambia el resultado: así
// los nodos no se vuelven a dibujar por moverse si los problemas siguen siendo los mismos.
// Los nodos solo se marcan con el panel abierto (`markedIssues`).
export function useVerification({ nodes, edges, plcIssues, verifyOpen }) {
  const deferredNodes = useDeferredValue(nodes)
  const deferredEdges = useDeferredValue(edges)
  const freshIssues = useMemo(
    () => [...validateGrafcet(deferredNodes, deferredEdges), ...plcIssues],
    [deferredNodes, deferredEdges, plcIssues],
  )
  const issuesKey = JSON.stringify(freshIssues)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se recalcula solo si cambian los problemas
  const issues = useMemo(() => freshIssues, [issuesKey])

  const issueCounts = useMemo(
    () => ({
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    }),
    [issues],
  )
  const markedIssues = useMemo(() => (verifyOpen ? issuesByNode(issues) : null), [verifyOpen, issues])
  return { issues, issueCounts, markedIssues }
}
