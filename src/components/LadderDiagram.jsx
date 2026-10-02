import { forwardRef } from 'react'

// Dibujo SVG del ladder generado (lib/ladder/generate.js): un único SVG con todas las secciones
// y segmentos, listo para verse y para exportarse tal cual (SVG, PNG, PDF).

const W = 100 // ancho de celda (un contacto)
const H = 64 // alto de fila
const RAIL = 24 // margen del raíl izquierdo
const MARGIN = 16
const COMMENT_H = 22
const SECTION_H = 34
const RUNG_GAP = 14
const FONT = 'Inter, system-ui, sans-serif'
const MONO = 'ui-monospace, Consolas, monospace'
const INK = '#0f172a'
const MUTED = '#64748b'

const clip = (text, max = 14) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

// Texto encima (nombre o dirección) y debajo (dirección) del símbolo, según el modo de etiquetas.
function labels(op, resolver, mode) {
  const name = resolver.name(op)
  const address = resolver.address(op)
  if (mode === 'address') return { top: address || name, bottom: '' }
  if (mode === 'symbol') return { top: name, bottom: '' }
  return { top: name, bottom: address }
}

function OperandText({ x, y, top, bottom }) {
  return (
    <>
      <text x={x} y={y - 18} textAnchor="middle" fontSize="11" fontFamily={FONT} fill={INK}>
        {clip(top)}
      </text>
      {bottom && (
        <text x={x} y={y + 26} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={MUTED}>
          {bottom}
        </text>
      )}
    </>
  )
}

// --- Disposición de redes: { w (celdas), h (filas), draw(x, y) } con la entrada/salida en la
// primera fila. Serie = una tras otra; paralelo = ramas apiladas unidas por verticales.
function layout(net, ctx) {
  switch (net.type) {
    case 'series': {
      const parts = net.items.map((i) => layout(i, ctx))
      return {
        w: parts.reduce((s, p) => s + p.w, 0),
        h: Math.max(...parts.map((p) => p.h)),
        draw: (x, y) => {
          let cx = x
          return parts.map((p, i) => {
            const el = <g key={i}>{p.draw(cx, y)}</g>
            cx += p.w * W
            return el
          })
        },
      }
    }
    case 'parallel': {
      const parts = net.items.map((i) => layout(i, ctx))
      const w = Math.max(...parts.map((p) => p.w))
      return {
        w,
        h: parts.reduce((s, p) => s + p.h, 0),
        draw: (x, y) => {
          let cy = y
          const lastY = y + (parts.length - 1 ? parts.slice(0, -1).reduce((s, p) => s + p.h, 0) * H : 0)
          const els = parts.map((p, i) => {
            const rowY = cy
            cy += p.h * H
            return (
              <g key={i}>
                {p.draw(x, rowY)}
                {p.w < w && <line x1={x + p.w * W} y1={rowY} x2={x + w * W} y2={rowY} stroke={INK} strokeWidth="1.5" />}
              </g>
            )
          })
          return (
            <>
              {els}
              <line x1={x} y1={y} x2={x} y2={lastY} stroke={INK} strokeWidth="1.5" />
              <line x1={x + w * W} y1={y} x2={x + w * W} y2={lastY} stroke={INK} strokeWidth="1.5" />
            </>
          )
        },
      }
    }
    case 'contact':
      return { w: 1, h: 1, draw: (x, y) => <Contact x={x} y={y} node={net} ctx={ctx} /> }
    case 'compare':
      return { w: 1, h: 1, draw: (x, y) => <Compare x={x} y={y} node={net} ctx={ctx} /> }
    case 'not':
      return {
        w: layout(net.item, ctx).w + 1,
        h: 1,
        draw: (x, y) => {
          const inner = layout(net.item, ctx)
          return (
            <>
              {inner.draw(x, y)}
              <Contact x={x + inner.w * W} y={y} node={{ kind: 'NOT' }} ctx={ctx} />
            </>
          )
        },
      }
    case 'false':
      return {
        w: 1,
        h: 1,
        draw: (x, y) => (
          <>
            <line x1={x} y1={y} x2={x + 30} y2={y} stroke={INK} strokeWidth="1.5" />
            <text x={x + W / 2} y={y + 4} textAnchor="middle" fontSize="11" fill="#dc2626" fontFamily={FONT}>
              sin condición
            </text>
          </>
        ),
      }
    default: // 'true': cable directo
      return { w: 1, h: 1, draw: (x, y) => <line x1={x} y1={y} x2={x + W} y2={y} stroke={INK} strokeWidth="1.5" /> }
  }
}

function Contact({ x, y, node, ctx }) {
  const cx = x + W / 2
  const text = node.kind === 'NOT' ? null : labels(node.operand, ctx.resolver, ctx.mode)
  const mark = { NC: '/', P: 'P', N: 'N', NOT: 'NOT' }[node.kind]
  return (
    <g>
      <line x1={x} y1={y} x2={cx - 8} y2={y} stroke={INK} strokeWidth="1.5" />
      <line x1={cx + 8} y1={y} x2={x + W} y2={y} stroke={INK} strokeWidth="1.5" />
      <line x1={cx - 8} y1={y - 12} x2={cx - 8} y2={y + 12} stroke={INK} strokeWidth="2" />
      <line x1={cx + 8} y1={y - 12} x2={cx + 8} y2={y + 12} stroke={INK} strokeWidth="2" />
      {mark === '/' && <line x1={cx - 6} y1={y + 10} x2={cx + 6} y2={y - 10} stroke={INK} strokeWidth="1.5" />}
      {mark && mark !== '/' && (
        <text x={cx} y={y + 4} textAnchor="middle" fontSize={mark.length > 1 ? 8 : 11} fontWeight="600" fontFamily={FONT} fill={INK}>
          {mark}
        </text>
      )}
      {text && <OperandText x={cx} y={y} {...text} />}
      {(node.kind === 'P' || node.kind === 'N') && ctx.mode !== 'symbol' && ctx.resolver.edgeMemory(node) && (
        <text x={cx} y={y + 38} textAnchor="middle" fontSize="9" fontFamily={MONO} fill={MUTED}>
          {ctx.resolver.edgeMemory(node)}
        </text>
      )}
    </g>
  )
}

function Compare({ x, y, node, ctx }) {
  const name = (op) => (ctx.mode === 'address' ? ctx.resolver.address(op) || ctx.resolver.name(op) : ctx.resolver.name(op))
  return (
    <g>
      <line x1={x} y1={y} x2={x + 12} y2={y} stroke={INK} strokeWidth="1.5" />
      <line x1={x + W - 12} y1={y} x2={x + W} y2={y} stroke={INK} strokeWidth="1.5" />
      <rect x={x + 12} y={y - 22} width={W - 24} height={44} fill="white" stroke={INK} strokeWidth="1.5" />
      <text x={x + W / 2} y={y - 9} textAnchor="middle" fontSize="10" fontWeight="600" fontFamily={FONT} fill={INK}>
        CMP {node.op}
      </text>
      <text x={x + W / 2} y={y + 5} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={INK}>
        {clip(name(node.a), 11)}
      </text>
      <text x={x + W / 2} y={y + 17} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={INK}>
        {clip(name(node.b), 11)}
      </text>
    </g>
  )
}

function Output({ x, y, output, ctx }) {
  const cx = x + W / 2
  const text = labels(output.operand, ctx.resolver, ctx.mode)
  if (output.type === 'ton' || output.type === 'assign') {
    const title = output.type === 'ton' ? 'TON' : 'CALC'
    const body = output.type === 'ton' ? `PT ${+output.seconds.toFixed(3)} s` : clip(`${output.operand.name} := ${output.text}`, 15)
    return (
      <g>
        <line x1={x} y1={y} x2={x + 8} y2={y} stroke={INK} strokeWidth="1.5" />
        <rect x={x + 8} y={y - 22} width={W - 16} height={44} fill="white" stroke={INK} strokeWidth="1.5" />
        <text x={cx} y={y - 8} textAnchor="middle" fontSize="10" fontWeight="600" fontFamily={FONT} fill={INK}>
          {title}
        </text>
        <text x={cx} y={y + 8} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={INK}>
          {body}
        </text>
        <OperandText x={cx} y={y - 8} top={text.top} bottom="" />
        {text.bottom && (
          <text x={cx} y={y + 36} textAnchor="middle" fontSize="10" fontFamily={MONO} fill={MUTED}>
            {text.bottom}
          </text>
        )}
      </g>
    )
  }
  const letter = { set: 'S', reset: 'R' }[output.type]
  return (
    <g>
      <line x1={x} y1={y} x2={cx - 12} y2={y} stroke={INK} strokeWidth="1.5" />
      <path d={`M ${cx - 6} ${y - 12} A 14 14 0 0 0 ${cx - 6} ${y + 12}`} fill="none" stroke={INK} strokeWidth="2" />
      <path d={`M ${cx + 6} ${y - 12} A 14 14 0 0 1 ${cx + 6} ${y + 12}`} fill="none" stroke={INK} strokeWidth="2" />
      {letter && (
        <text x={cx} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fontFamily={FONT} fill={INK}>
          {letter}
        </text>
      )}
      <line x1={cx + 12} y1={y} x2={x + W} y2={y} stroke={INK} strokeWidth="1.5" />
      <OperandText x={cx} y={y} {...text} />
    </g>
  )
}

// mode: 'symbol' | 'address' | 'both'
const LadderDiagram = forwardRef(function LadderDiagram({ ladder, mode = 'both' }, ref) {
  const ctx = { resolver: ladder.resolver, mode }
  const laidOut = new Map(ladder.sections.flatMap((s) => s.rungs.map((r) => [r, layout(r.network, ctx)])))
  // Todas las bobinas alineadas en la misma columna, como en un esquema real.
  const netCols = Math.max(1, ...[...laidOut.values()].map((l) => l.w))
  const outX = RAIL + MARGIN + netCols * W
  const width = outX + W + RAIL + MARGIN * 2

  let y = MARGIN
  const blocks = []
  for (const section of ladder.sections) {
    blocks.push(
      <g key={`s-${section.id}`} data-block-top={y} data-block-bottom={y + SECTION_H} data-keep-with-next="1">
        <rect x={MARGIN} y={y} width={width - MARGIN * 2} height={SECTION_H - 8} rx="4" fill="#f1f5f9" />
        <text x={MARGIN + 10} y={y + 18} fontSize="13" fontWeight="700" fontFamily={FONT} fill={INK}>
          {section.title}
        </text>
      </g>,
    )
    y += SECTION_H
    for (const rung of section.rungs) {
      const laid = laidOut.get(rung)
      const rows = Math.max(laid.h, rung.outputs.length)
      const top = y + COMMENT_H
      const lineY = top + H / 2
      const railTop = top + 4
      const railBottom = top + rows * H - 4
      const x0 = MARGIN + RAIL
      blocks.push(
        <g key={`r-${rung.number}`} data-block-top={y} data-block-bottom={top + rows * H + RUNG_GAP}>
          <text x={MARGIN} y={y + 14} fontSize="11" fontFamily={FONT} fill={rung.error ? '#dc2626' : MUTED}>
            <tspan fontWeight="700" fill={rung.error ? '#dc2626' : INK}>
              {rung.number}
            </tspan>
            {`  ${rung.comment}${rung.error ? '  (receptividad no válida)' : ''}`}
          </text>
          {/* Raíles de alimentación */}
          <line x1={x0} y1={railTop} x2={x0} y2={railBottom} stroke={INK} strokeWidth="3" />
          <line x1={outX + W + 8} y1={railTop} x2={outX + W + 8} y2={railBottom} stroke={INK} strokeWidth="3" />
          {laid.draw(x0, lineY)}
          {/* Cable hasta la columna de salidas */}
          {laid.w < netCols && <line x1={x0 + laid.w * W} y1={lineY} x2={outX} y2={lineY} stroke={INK} strokeWidth="1.5" />}
          {rung.outputs.length > 1 && (
            <line x1={outX} y1={lineY} x2={outX} y2={lineY + (rung.outputs.length - 1) * H} stroke={INK} strokeWidth="1.5" />
          )}
          {rung.outputs.map((o, i) => (
            <g key={i}>
              <Output x={outX} y={lineY + i * H} output={o} ctx={ctx} />
              <line x1={outX + W} y1={lineY + i * H} x2={outX + W + 8} y2={lineY + i * H} stroke={INK} strokeWidth="1.5" />
            </g>
          ))}
        </g>,
      )
      y = top + rows * H + RUNG_GAP
    }
  }

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={width} height={y + MARGIN} viewBox={`0 0 ${width} ${y + MARGIN}`}>
      <rect width="100%" height="100%" fill="white" />
      {blocks}
    </svg>
  )
})

export default LadderDiagram
