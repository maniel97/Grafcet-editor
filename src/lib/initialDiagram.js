// Diagrama de ejemplo: etapa inicial 0 -> Marcha -> etapa 1 (Motor M1) -> Paro -> vuelta a 0.
export const initialNodes = [
  { id: 's0', type: 'step', position: { x: 200, y: 40 }, data: { label: '0', initial: true, actions: [] } },
  { id: 't1', type: 'transition', position: { x: 200, y: 140 }, data: { condition: 'Marcha' } },
  { id: 's1', type: 'step', position: { x: 200, y: 210 }, data: { label: '1', actions: ['Motor M1'] } },
  { id: 't2', type: 'transition', position: { x: 200, y: 310 }, data: { condition: 'Paro' } },
]

const link = { type: 'grafcet', style: { stroke: '#0f172a', strokeWidth: 2 } }

export const initialEdges = [
  { id: 'e-s0-t1', source: 's0', target: 't1', ...link },
  { id: 'e-t1-s1', source: 't1', target: 's1', ...link },
  { id: 'e-s1-t2', source: 's1', target: 't2', ...link },
  { id: 'e-t2-s0', source: 't2', target: 's0', ...link },
]

export const defaultEdgeOptions = link
