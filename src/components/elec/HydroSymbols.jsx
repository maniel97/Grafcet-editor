// Símbolos hidráulicos ISO 1219-1 (lib/elec/catalog.js, grupo «Hidráulica»), en la caja del
// componente. Los triángulos de energía van rellenos (en la neumática, en blanco).
// view: estado de la simulación (lib/elec/solve.js: view.hydro) o null al editar.
import { VALVE_SIDE, VALVE_SQUARE, terminalsOf, valveSquares } from '../../lib/elec/catalog'
import { hvalveBlocked, hvalvePaths } from '../../lib/elec/hydraulic'
import { INK } from './elecColors'
import { Arrow, Cylinder, Manual, Solenoid, Spring } from './PneuSymbols'

export const OIL = '#fed7aa'
const ACTIVE = '#ffedd5'
const HOT = '#dc2626'

// Columna de cada conexión en una casilla, arriba (A, B) o abajo (P, T).
const SPOT = { A: [20, 't'], B: [60, 't'], P: [20, 'b'], T: [60, 'b'] }

function Valve({ c, view }) {
  const n = valveSquares(c)
  const names = n === 3 ? ['14', '0', '12'] : ['14', '12']
  const now = view?.hydro?.valves?.[c.id]
  const left = VALVE_SIDE
  const right = VALVE_SIDE + n * VALVE_SQUARE
  const manual = c.manual && c.manual !== 'none'
  return (
    <g>
      {names.map((name, i) => {
        const x0 = left + i * VALVE_SQUARE
        const spot = (p) => ({ x: x0 + SPOT[p][0], y: SPOT[p][1] === 't' ? 20 : 60 })
        return (
          <g key={name}>
            <rect x={x0} y="20" width={VALVE_SQUARE} height="40" fill={now === name ? ACTIVE : 'white'} stroke={INK} strokeWidth="2" />
            {hvalvePaths(c, name).map(([a, b]) => {
              const p = spot(a)
              const q = spot(b)
              // Dos conexiones del mismo lado (P-T en tándem, A-B): un paso en U, sin flecha.
              if (p.y === q.y) {
                const y = p.y === 20 ? 30 : 50
                return <path key={a + b} d={`M ${p.x} ${p.y} L ${p.x} ${y} L ${q.x} ${y} L ${q.x} ${q.y}`} fill="none" stroke={INK} strokeWidth="1.6" />
              }
              const d = q.y > p.y ? 4 : -4
              return <Arrow key={a + b} x1={p.x} y1={p.y + d} x2={q.x} y2={q.y - d} />
            })}
            {hvalveBlocked(c, name).map((p) => {
              const { x, y } = spot(p)
              const d = y === 20 ? 1 : -1
              return <path key={p} d={`M ${x} ${y} L ${x} ${y + 8 * d} M ${x - 5} ${y + 8 * d} L ${x + 5} ${y + 8 * d}`} stroke={INK} strokeWidth="1.6" />
            })}
          </g>
        )
      })}
      {terminalsOf(c).map((t) => (
        <line key={t.id} x1={t.x} y1={t.y} x2={t.x} y2={t.side === 'top' ? 20 : 60} stroke={INK} strokeWidth="1.6" />
      ))}
      {manual ? <Manual kind={c.manual} x={left} /> : <Solenoid x={left - 18} tag={c.sol14} on={now === '14'} />}
      {manual && c.sol14 && <Solenoid x={left - 34} tag={c.sol14} on={now === '14'} />}
      {c.sol12 ? <Solenoid x={right + 2} tag={c.sol12} on={now === '12' && Boolean(view)} /> : <Spring x={right} dir={1} />}
      {n === 3 && c.sol12 && <Spring x={right + 18} dir={1} />}
      {n === 3 && <Spring x={left - (manual ? 14 : 18)} dir={-1} />}
    </g>
  )
}

// Depósito: rectángulo abierto por arriba.
const Tank = ({ x, y, w = 28 }) => <path d={`M ${x - w / 2} ${y} L ${x - w / 2} ${y + 12} L ${x + w / 2} ${y + 12} L ${x + w / 2} ${y}`} fill="none" stroke={INK} strokeWidth="2" />

export function HydroSymbol({ c, view }) {
  const h = view?.hydro
  switch (c.type) {
    case 'hpump': {
      // Motor (M), acoplamiento, bomba (triángulo relleno hacia fuera) y depósito.
      const on = view && h?.pumps?.[c.id]
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <line x1="48" y1="0" x2="48" y2="31" />
          <circle cx="48" cy="45" r="14" fill={on ? ACTIVE : 'white'} />
          <path d="M 48 33 L 55 45 L 41 45 Z" fill={INK} strokeWidth="1" />
          <line x1="48" y1="59" x2="48" y2="84" />
          <path d="M 23 43 L 34 43 M 23 47 L 34 47" strokeWidth="1.4" />
          <circle cx="14" cy="45" r="10" fill={on ? '#bbf7d0' : 'white'} />
          <text x="14" y="49" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} stroke="none">
            M
          </text>
          <line x1="72" y1="0" x2="72" y2="84" />
          <Tank x={60} y={80} w={36} />
        </g>
      )
    }
    case 'hrelief': {
      // Normalmente cerrada: la flecha, desplazada; con la presión de su muelle, se alinea y abre.
      const open = Boolean(h?.relief?.[c.id])
      return (
        <g fill="none" stroke={INK} strokeWidth="1.8">
          <line x1="20" y1="80" x2="20" y2="58" />
          <line x1="20" y1="22" x2="20" y2="0" />
          <rect x="6" y="22" width="28" height="36" fill={open ? '#fee2e2' : 'white'} strokeWidth="2" />
          {open ? <Arrow x1={20} y1={54} x2={20} y2={26} /> : <Arrow x1={27} y1={54} x2={27} y2={26} />}
          <polyline points="34 40 37 34 40 46 43 34 46 46 49 40 52 40" strokeWidth="1.3" />
          <path d="M 42 50 L 50 30" strokeWidth="1.1" />
          <path d="M 20 66 L 1 66 L 1 40 L 6 40" strokeDasharray="3 2" strokeWidth="1.2" />
        </g>
      )
    }
    case 'hgauge': {
      const bar = h?.gauges?.[c.id] ?? 0
      const max = Math.max(100, bar)
      const a = Math.PI * (1.25 - (1.5 * bar) / max)
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <line x1="20" y1="34" x2="20" y2="50" />
          <circle cx="20" cy="20" r="14" fill="white" />
          <line x1="20" y1="20" x2={20 + 11 * Math.cos(a)} y2={20 - 11 * Math.sin(a)} stroke={bar ? HOT : INK} strokeWidth="1.6" />
          <circle cx="20" cy="20" r="2" fill={INK} />
        </g>
      )
    }
    case 'htank':
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <line x1="20" y1="0" x2="20" y2="24" />
          <Tank x={20} y={14} />
        </g>
      )
    case 'hvalve':
      return <Valve c={c} view={view} />
    case 'hcylinder':
      return <Cylinder c={c} view={view} fluid="hydro" color={OIL} />
    case 'hthrottle':
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
    default:
      return null
  }
}
