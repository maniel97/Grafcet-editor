// Esquema eléctrico estático (SVG independiente, sin React Flow): una hoja tal como queda en el
// plano, para el dossier y para exportar a PDF, PNG o SVG. Mismos símbolos que el editor
// (ElecSymbols), cables ortogonales, números de cable, puntos de unión, rótulos con referencias
// cruzadas y, si el esquema lo lleva, el marco con columnas y cajetín.
import { ElecSymbol } from './ElecSymbols'
import ElecFrame from './ElecFrame'
import { INK, POTENTIAL_COLORS } from './elecColors'
import { contactNumbers, showTag, sizeOf, terminalsOf } from '../../lib/elec/catalog'
import { COLUMN_WIDTH, FRAME_HEIGHT, FRAME_TOP, crossReferenceMap, elecSheetsOf, frameColumns, sheetOfComponent } from '../../lib/elec/sheet'
import { WIRE_COLORS, junctions, sectionWidth, wireNumbers } from '../../lib/elec/wiring'

const BOXED = new Set(['psu', 'phasemonitor', 'vfd', 'softstarter', 'safetyrelay'])
const MARGIN = 20

// Partir un texto en líneas de unas `n` letras.
function lines(text, n = 18) {
  const out = []
  let line = ''
  for (const word of String(text ?? '').split(/\s+/).filter(Boolean)) {
    if (line && (line + ' ' + word).length > n) {
      out.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}

// Recorrido ortogonal de un cable: sale de cada borne hacia su lado (arriba o abajo) y se une por
// una horizontal a media altura.
function route(a, b) {
  const out = (p) => (p.side === 'top' ? -12 : 12)
  const a1 = { x: a.x, y: a.y + out(a) }
  const b1 = { x: b.x, y: b.y + out(b) }
  const mid = (a1.y + b1.y) / 2
  const pts = [a, a1, { x: a1.x, y: mid }, { x: b1.x, y: mid }, b1, b]
  return { d: pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '), label: { x: (a1.x + b1.x) / 2, y: mid } }
}

export default function ElecStatic({ schematic, sheetId, info = {} }) {
  const sch = schematic ?? { components: [], wires: [] }
  const sheets = elecSheetsOf(sch)
  const sheet = sheetId ?? sheets[0].id
  const comps = (sch.components ?? []).filter((c) => sheetOfComponent(sch, c) === sheet)
  const ids = new Set(comps.map((c) => c.id))
  const wires = (sch.wires ?? []).filter((w) => ids.has(w.from.c) && ids.has(w.to.c))
  const byId = new Map(comps.map((c) => [c.id, c]))
  const numbers = contactNumbers(sch.components ?? [])
  const xref = crossReferenceMap(sch, numbers)
  const nums = sch.wireNumbers ? wireNumbers(sch) : {}
  const joints = junctions(sch)
  const at = (end) => {
    const c = byId.get(end.c)
    const t = c && terminalsOf(c).find((x) => x.id === end.t)
    return t ? { x: c.x + t.x, y: c.y + t.y, side: t.side } : null
  }

  // Encuadre: el marco o lo dibujado (con sitio para los rótulos de la derecha).
  let box
  if (sch.frame) {
    box = { x: -MARGIN, y: -FRAME_TOP - MARGIN, w: frameColumns(sch) * COLUMN_WIDTH + 2 * MARGIN, h: FRAME_HEIGHT + FRAME_TOP + 2 * MARGIN }
  } else {
    const rects = comps.map((c) => {
      const { w, h } = sizeOf(c)
      return { x: c.x - (c.type === 'rail' ? 30 : 30), y: c.y - 20, r: c.x + w + (c.type === 'rail' ? 10 : 110), b: c.y + h + 20 }
    })
    const minX = Math.min(0, ...rects.map((r) => r.x)) - MARGIN
    const minY = Math.min(0, ...rects.map((r) => r.y)) - MARGIN
    const maxX = Math.max(200, ...rects.map((r) => r.r)) + MARGIN
    const maxY = Math.max(100, ...rects.map((r) => r.b)) + MARGIN
    box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }
  const sheetIndex = sheets.findIndex((s) => s.id === sheet)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={Math.round(box.w)} height={Math.round(box.h)} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} fontFamily="Inter, Helvetica, Arial, sans-serif">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="white" />
      {sch.frame && <ElecFrame cols={frameColumns(sch)} info={{ ...info, sheet: sheets[sheetIndex]?.name, index: sheetIndex + 1, count: sheets.length }} />}
      {/* Cables */}
      {wires.map((w) => {
        const a = at(w.from)
        const b = at(w.to)
        if (!a || !b) return null
        const { d, label } = route(a, b)
        return (
          <g key={w.id}>
            <path d={d} fill="none" stroke={WIRE_COLORS[w.color]?.stroke ?? INK} strokeWidth={sectionWidth(w.section)} strokeLinejoin="round" />
            {nums[w.id] && (
              <g>
                <rect x={label.x - 9} y={label.y - 6} width="18" height="11" fill="white" />
                <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize="8.5" fontFamily="ui-monospace, monospace" fill={INK}>
                  {nums[w.id]}
                </text>
              </g>
            )}
          </g>
        )
      })}
      {/* Aparatos */}
      {comps.map((c) => {
        const { w } = sizeOf(c)
        const tag = c.type === 'contact' || c.type === 'maincontacts' ? c.ref : c.tag
        const terms = terminalsOf(c)
        const label =
          c.type === 'rail' || c.type === 'plc'
            ? []
            : [
                [c.type === 'terminal' ? `${showTag(tag)}:${c.n ?? 1}` : showTag(tag), 11, 700],
                ...lines(c.text).map((t) => [t, 9.5, 400]),
                ...(xref.byTag[c.tag]?.length ? [[xref.byTag[c.tag].map((x) => `${x.numbers.join('-')} ${x.where}`).join(' · '), 7.5, 400]] : []),
                ...(xref.ownerOf[c.id] ? [[xref.ownerOf[c.id], 7.5, 400]] : []),
              ]
        return (
          <g key={c.id} transform={`translate(${c.x} ${c.y})`}>
            <ElecSymbol c={{ ...c, timed: false }} view={null} />
            {!BOXED.has(c.type) &&
              !['rail', 'plc', 'terminal'].includes(c.type) &&
              terms.map((t, i) => {
                const text = c.type === 'contact' ? numbers[c.id]?.[i] : t.id
                return text ? (
                  <text key={t.id} x={t.x + 4} y={t.side === 'top' ? t.y + 11 : t.y - 4} fontSize="8" fontFamily="ui-monospace, monospace" fill="#475569">
                    {text}
                  </text>
                ) : null
              })}
            {c.type === 'rail' && (
              <text x="-6" y="14" textAnchor="end" fontSize="12" fontWeight="700" fill={POTENTIAL_COLORS[c.potential] ?? INK}>
                {c.potential}
              </text>
            )}
            {c.type === 'plc' && (
              <text x="0" y="-6" fontSize="11" fontWeight="700" fill={INK}>
                {showTag(c.tag)}
              </text>
            )}
            {label.map(([t, size, weight], i) => (
              <text key={i} x={w + 3} y={32 + i * 12} fontSize={size} fontWeight={weight} fill={i ? '#334155' : INK}>
                {t}
              </text>
            ))}
            {terms.map((t) => joints[`${c.id}:${t.id}`] && <circle key={`j${t.id}`} cx={t.x} cy={t.y} r="3" fill={INK} />)}
          </g>
        )
      })}
      {!comps.length && (
        <text x={box.x + box.w / 2} y={box.y + box.h / 2} textAnchor="middle" fontSize="14" fill="#94a3b8">
          Hoja vacía
        </text>
      )}
    </svg>
  )
}
