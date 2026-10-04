import { COLUMN_WIDTH, FRAME_HEIGHT, FRAME_TOP, TITLE_BLOCK } from '../../lib/elec/sheet'
import { t as tr } from '../../lib/i18n'
import { INK } from './elecColors'

// Marco de una hoja del esquema (IEC 61082-1): columnas numeradas arriba y abajo, y el cajetín
// abajo a la derecha. Coordenadas del esquema: el dibujo va de y = 0 a FRAME_HEIGHT; la franja de
// las columnas, encima (y < 0). info: { project, sheet, index, count, author, company, date }.
export default function ElecFrame({ cols, info = {} }) {
  const w = cols * COLUMN_WIDTH
  const strip = 26
  const top = -FRAME_TOP
  const bottom = FRAME_HEIGHT
  const tb = { x: w - TITLE_BLOCK.w, y: bottom - TITLE_BLOCK.h }
  const cell = (x, y, cw, label, value, strong) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={cw} height={TITLE_BLOCK.h / 2} fill="white" stroke={INK} strokeWidth="1" />
      <text x={x + 4} y={y + 10} fontSize="7" fill="#64748b">
        {label}
      </text>
      <text x={x + 4} y={y + 27} fontSize={strong ? 12 : 10} fontWeight={strong ? 700 : 400} fill={INK}>
        {value}
      </text>
    </g>
  )
  return (
    <g pointerEvents="none">
      <rect x="0" y={top} width={w} height={bottom - top} fill="none" stroke={INK} strokeWidth="1.5" />
      {/* Columnas: números arriba y abajo, con sus separaciones. */}
      {[top, bottom - strip].map((y, k) => (
        <g key={y}>
          <line x1="0" y1={k ? y : y + strip} x2={w} y2={k ? y : y + strip} stroke={INK} strokeWidth="1" />
          {Array.from({ length: cols }, (_, i) => (
            <g key={i}>
              {i > 0 && <line x1={i * COLUMN_WIDTH} y1={y} x2={i * COLUMN_WIDTH} y2={y + strip} stroke={INK} strokeWidth="1" />}
              <text x={i * COLUMN_WIDTH + COLUMN_WIDTH / 2} y={y + 17} textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
                {i + 1}
              </text>
            </g>
          ))}
        </g>
      ))}
      {/* Cajetín */}
      {cell(tb.x, tb.y - strip, 240, 'Proyecto', info.project || tr('Sin título'), true)}
      {cell(tb.x + 240, tb.y - strip, 180, 'Centro / empresa', info.company ?? '')}
      {cell(tb.x, tb.y - strip + TITLE_BLOCK.h / 2, 120, 'Autor', info.author ?? '')}
      {cell(tb.x + 120, tb.y - strip + TITLE_BLOCK.h / 2, 90, 'Fecha', info.date ?? '')}
      {cell(tb.x + 210, tb.y - strip + TITLE_BLOCK.h / 2, 130, 'Esquema', info.sheet ?? '')}
      {cell(tb.x + 340, tb.y - strip + TITLE_BLOCK.h / 2, 80, 'Hoja', `${info.index ?? 1} de ${info.count ?? 1}`)}
    </g>
  )
}

// Nodo de React Flow con el marco (detrás de todo, sin ratón).
export function ElecFrameNode({ data }) {
  const w = data.cols * COLUMN_WIDTH
  const h = FRAME_HEIGHT + FRAME_TOP
  return (
    <svg width={w} height={h} viewBox={`0 ${-FRAME_TOP} ${w} ${h}`} className="pointer-events-none block" aria-hidden="true">
      <ElecFrame cols={data.cols} info={data.info} />
    </svg>
  )
}
