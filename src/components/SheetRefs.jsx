import { ViewportPortal } from '@xyflow/react'

const STUB = 28
const ARROW = 6

// Referencias de los enlaces entre hojas (lib/sheets.js: crossSheetRefs), dibujadas en el propio
// lienzo como las referencias de enlace: una flecha bajo el origen con su destino y un tramo sobre
// el destino con su origen. Van dentro del dibujo, así que salen también al exportar.
export default function SheetRefs({ refs, nodes }) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const placed = new Map() // varias referencias en el mismo lado de un nodo: una debajo de otra
  return (
    <ViewportPortal>
      {refs.map((r, i) => {
        const n = byId.get(r.nodeId)
        if (!n) return null
        const h = n.measured?.height ?? 56
        const key = `${r.nodeId}:${r.side}`
        const k = placed.get(key) ?? 0
        placed.set(key, k + 1)
        const x = n.position.x + 28
        const y = r.side === 'out' ? n.position.y + h : n.position.y - STUB
        return (
          <div key={i} className="pointer-events-none absolute left-0 top-0" style={{ transform: `translate(${x - 10}px, ${y}px)` }}>
            {k === 0 && (
              <svg width="20" height={STUB} className="block overflow-visible">
                <line x1="10" y1="0" x2="10" y2={STUB} stroke="#0f172a" strokeWidth="2" />
                {r.side === 'out' && <path d={`M ${10 - ARROW} ${STUB - ARROW} L 10 ${STUB + 2} L ${10 + ARROW} ${STUB - ARROW} Z`} fill="#0f172a" />}
              </svg>
            )}
            <div
              data-ref-label
              className="diagram-text absolute whitespace-nowrap text-[0.85em] text-slate-700"
              style={{ left: 20, top: r.side === 'out' ? STUB - 12 + k * 16 : -6 - k * 16 }}
            >
              {r.text}
            </div>
          </div>
        )
      })}
    </ViewportPortal>
  )
}
