// Símbolos neumáticos ISO 1219-1 (lib/elec/catalog.js, grupo «Neumática»), en la caja del componente.
// view: estado de la simulación (lib/elec/solve.js: view.pneu) o null al editar.
import { VALVE_SIDE, VALVE_SQUARE, terminalsOf, valveSquares } from '../../lib/elec/catalog'
import { valveBlocked, valvePaths } from '../../lib/elec/pneumatic'
import { INK } from './elecColors'

const AIR = '#bfdbfe'
const ACTIVE = '#dbeafe'

function Arrow({ x1, y1, x2, y2 }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const h = (d) => `${x2 - 7 * Math.cos(a + d)} ${y2 - 7 * Math.sin(a + d)}`
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth="1.6" />
      <path d={`M ${h(0.45)} L ${x2} ${y2} L ${h(-0.45)} Z`} fill={INK} />
    </g>
  )
}

// Columna de cada conexión dentro de una casilla, y si está arriba o abajo.
const portSpot = (c, p) =>
  c.ways === '3/2' ? { 1: [20, 'b'], 2: [20, 't'], 3: [60, 'b'] }[p] : { 1: [40, 'b'], 2: [60, 't'], 3: [60, 'b'], 4: [20, 't'], 5: [20, 'b'] }[p]

function Spring({ x, dir }) {
  // Muelle en zigzag hacia fuera de la válvula (dir: -1 izquierda, 1 derecha).
  const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => `${x + dir * i * 4} ${i % 2 ? 30 : 50}`)
  return <polyline points={pts.join(' ')} fill="none" stroke={INK} strokeWidth="1.4" />
}

function Solenoid({ x, tag, on }) {
  return (
    <g>
      <rect x={x} y="30" width="16" height="20" fill={on ? '#bbf7d0' : 'white'} stroke={INK} strokeWidth="1.6" />
      <line x1={x + 2} y1="48" x2={x + 14} y2="32" stroke={INK} strokeWidth="1.3" />
      {tag && (
        <text x={x + 8} y="24" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#1d4ed8">
          {`-${tag}`}
        </text>
      )}
    </g>
  )
}

function Manual({ kind, x }) {
  // Pulsador (seta) o palanca, a la izquierda.
  return kind === 'lever' ? (
    <path d={`M ${x} 40 L ${x - 12} 40 M ${x - 6} 40 L ${x - 14} 28`} fill="none" stroke={INK} strokeWidth="1.6" />
  ) : (
    <path d={`M ${x} 40 L ${x - 12} 40 M ${x - 12} 32 L ${x - 12} 48 M ${x - 16} 32 A 8 8 0 0 0 ${x - 16} 48`} fill="none" stroke={INK} strokeWidth="1.6" />
  )
}

function Valve({ c, view }) {
  const n = valveSquares(c)
  const names = n === 3 ? ['14', '0', '12'] : ['14', '12']
  const now = view?.pneu?.valves?.[c.id]
  const left = VALVE_SIDE
  const right = VALVE_SIDE + n * VALVE_SQUARE
  return (
    <g>
      {names.map((name, i) => {
        const x0 = left + i * VALVE_SQUARE
        const spot = (p) => {
          const [dx, side] = portSpot(c, p)
          return { x: x0 + dx, y: side === 't' ? 20 : 60 }
        }
        return (
          <g key={name}>
            <rect x={x0} y="20" width={VALVE_SQUARE} height="40" fill={now === name ? ACTIVE : 'white'} stroke={INK} strokeWidth="2" />
            {valvePaths(c, name).map(([a, b]) => {
              const p = spot(a)
              const q = spot(b)
              const inset = (from, to) => (to.y > from.y ? 4 : -4)
              return <Arrow key={a + b} x1={p.x} y1={p.y + inset(p, q)} x2={q.x} y2={q.y - inset(p, q)} />
            })}
            {valveBlocked(c, name).map((p) => {
              const { x, y } = spot(p)
              const d = y === 20 ? 1 : -1
              return <path key={p} d={`M ${x} ${y} L ${x} ${y + 8 * d} M ${x - 5} ${y + 8 * d} L ${x + 5} ${y + 8 * d}`} stroke={INK} strokeWidth="1.6" />
            })}
          </g>
        )
      })}
      {/* Conexiones de la casilla de reposo y escapes (triángulo). */}
      {terminalsOf(c).map((t) => (
        <g key={t.id}>
          <line x1={t.x} y1={t.y} x2={t.x} y2={t.side === 'top' ? 20 : 60} stroke={INK} strokeWidth="1.6" />
          {(t.id === '3' || t.id === '5') && <path d={`M ${t.x - 5} 62 L ${t.x + 5} 62 L ${t.x} 69 Z`} fill="white" stroke={INK} strokeWidth="1.3" />}
        </g>
      ))}
      {/* Pilotaje 14 (izquierda) y 12 (derecha). */}
      {c.manual && c.manual !== 'none' ? <Manual kind={c.manual} x={left} /> : <Solenoid x={left - 18} tag={c.sol14} on={now === '14'} />}
      {c.manual && c.manual !== 'none' && c.sol14 && <Solenoid x={left - 34} tag={c.sol14} on={now === '14'} />}
      {c.sol12 ? <Solenoid x={right + 2} tag={c.sol12} on={now === '12' && Boolean(view)} /> : <Spring x={right} dir={1} />}
      {n === 3 && c.sol12 && <Spring x={right + 18} dir={1} />}
      {n === 3 && <Spring x={left - (c.manual && c.manual !== 'none' ? 14 : 18)} dir={-1} />}
    </g>
  )
}

function Cylinder({ c, view }) {
  const s = view?.pneu?.cylinders?.[c.id]
  const pos = s?.pos ?? (Number(c.initial) ? 1 : 0)
  const ports = view?.pneu?.ports ?? {}
  const px = 10 + pos * 132
  const single = c.acting === 'single'
  const [a0, a1] = c.tag ? [`${c.tag.toLowerCase()}0`, `${c.tag.toLowerCase()}1`] : ['', '']
  return (
    <g>
      {ports[`${c.id}:A`] === 'P' && <rect x="6" y="10" width={px - 6} height="26" fill={AIR} />}
      {!single && ports[`${c.id}:B`] === 'P' && <rect x={px + 8} y="10" width={154 - px - 8} height="26" fill={AIR} />}
      <rect x="4" y="8" width="152" height="30" fill="none" stroke={INK} strokeWidth="2" />
      <rect x={px} y="10" width="8" height="26" fill={INK} />
      <rect x={px + 8} y="20" width="150" height="6" fill="#94a3b8" stroke={INK} strokeWidth="1" />
      {single && (
        <polyline
          points={Array.from({ length: 9 }, (_, i) => `${px + 10 + (i * (144 - px)) / 8} ${i % 2 ? 12 : 34}`).join(' ')}
          fill="none"
          stroke={INK}
          strokeWidth="1.2"
        />
      )}
      {/* Detectores de final de carrera (a0 dentro, a1 fuera). */}
      {[
        [14, a0, view?.pneuSignals?.[a0]],
        [146, a1, view?.pneuSignals?.[a1]],
      ].map(([x, name, on]) => (
        <g key={x}>
          <rect x={x - 5} y="1" width="10" height="6" fill={on ? '#22c55e' : 'white'} stroke={INK} strokeWidth="1" />
          <text x={x} y="-3" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#1d4ed8">
            {name}
          </text>
        </g>
      ))}
      {terminalsOf(c).map((t) => (
        <line key={t.id} x1={t.x} y1="38" x2={t.x} y2={t.y} stroke={INK} strokeWidth="1.6" />
      ))}
    </g>
  )
}

export function PneuSymbol({ c, view }) {
  switch (c.type) {
    case 'airsource':
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <line x1="20" y1="0" x2="20" y2="10" />
          <circle cx="20" cy="24" r="13" fill="white" />
          <path d="M 20 15 L 27 27 L 13 27 Z" strokeWidth="1.6" />
        </g>
      )
    case 'frl': {
      const cut = view?.opened?.[c.id]
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <line x1="20" y1="0" x2="20" y2="22" />
          <line x1="20" y1="58" x2="20" y2="80" />
          <rect x="4" y="22" width="32" height="36" fill={cut ? '#fecaca' : 'white'} />
          <path d="M 20 26 L 31 40 L 20 54 L 9 40 Z" strokeWidth="1.4" />
          <line x1="9" y1="40" x2="31" y2="40" strokeWidth="1.2" strokeDasharray="2 2" />
          {cut && <path d="M 6 24 L 34 56 M 34 24 L 6 56" stroke="#dc2626" strokeWidth="2" />}
        </g>
      )
    }
    case 'throttle': {
      return (
        <g fill="none" stroke={INK} strokeWidth="1.8">
          <rect x="2" y="14" width="38" height="52" strokeDasharray="4 3" strokeWidth="1" />
          <line x1="20" y1="0" x2="20" y2="30" />
          <line x1="20" y1="50" x2="20" y2="80" />
          <path d="M 14 30 Q 20 40 14 50 M 26 30 Q 20 40 26 50" strokeWidth="1.5" />
          <path d="M 10 54 L 30 26" strokeWidth="1.3" />
          <path d="M 30 26 L 24 28 M 30 26 L 29 32" strokeWidth="1.3" />
          <path d="M 20 22 L 34 22 L 34 36 M 34 50 L 34 58 L 20 58" strokeWidth="1.3" />
          <circle cx="34" cy="42" r="4" fill="white" strokeWidth="1.3" />
          <path d="M 29 49 L 34 46 L 39 49" strokeWidth="1.3" />
        </g>
      )
    }
    case 'pvalve':
      return <Valve c={c} view={view} />
    case 'pcylinder':
      return <Cylinder c={c} view={view} />
    default:
      return null
  }
}
