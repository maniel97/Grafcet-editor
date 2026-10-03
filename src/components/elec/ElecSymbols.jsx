// Símbolos IEC 60617 del esquema eléctrico (lib/elec/catalog.js), dibujados en la caja del
// componente (origen arriba a la izquierda; bornes en la cuadrícula de 20 px). `s` es el estado de
// la simulación para ese componente (o null al editar).
import { plcTerminals } from '../../lib/elec/catalog'

import { INK, POTENTIAL_COLORS } from './elecColors'

const LIVE = '#16a34a'
const LAMP_COLORS = { green: '#22c55e', red: '#ef4444', amber: '#f59e0b', white: '#f8fafc', blue: '#3b82f6' }

// Contacto en la columna x, de y0 a y1 (corte entre 30 y 50). nc: normalmente cerrado.
// closed: estado actual. kind: actuador ('push', 'emergency', 'switch', 'limit', 'timer', null).
export function Contact({ x = 20, y0 = 0, y1 = 80, nc = false, closed = nc, actuator = null, fixedMark = null }) {
  const top = y0 + 28
  const bottom = y0 + 52
  const blade = closed ? `M ${x} ${bottom} L ${nc ? x + 6 : x} ${top - (nc ? 2 : 0)}` : `M ${x} ${bottom} L ${x - 14} ${top + 4}`
  const mid = { x: closed ? x : x - 7, y: (top + bottom) / 2 + 2 }
  return (
    <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
      <line x1={x} y1={y0} x2={x} y2={top} />
      {nc && <line x1={x} y1={top} x2={x + 8} y2={top} />}
      <line x1={x} y1={bottom} x2={x} y2={y1} />
      <path d={blade} stroke={closed ? LIVE : INK} strokeWidth="2.4" />
      {/* Contacto de contactor (semicírculo) o de interruptor automático (aspa). */}
      {fixedMark === 'contactor' && <path d={`M ${x - 4} ${top} A 4 4 0 0 0 ${x + 4} ${top}`} strokeWidth="1.5" />}
      {fixedMark === 'breaker' && <path d={`M ${x - 4} ${top - 4} L ${x + 4} ${top + 4} M ${x + 4} ${top - 4} L ${x - 4} ${top + 4}`} strokeWidth="1.5" />}
      {actuator && <line x1={mid.x - 4} y1={mid.y} x2={x - 20} y2={mid.y} strokeDasharray="3 2" strokeWidth="1.2" />}
      {actuator === 'push' && <path d={`M ${x - 20} ${mid.y - 6} L ${x - 24} ${mid.y - 6} L ${x - 24} ${mid.y + 6} L ${x - 20} ${mid.y + 6}`} strokeWidth="1.5" />}
      {actuator === 'emergency' && <path d={`M ${x - 22} ${mid.y - 9} A 9 9 0 0 0 ${x - 22} ${mid.y + 9} Z`} fill="#ef4444" strokeWidth="1.5" />}
      {actuator === 'switch' && <path d={`M ${x - 20} ${mid.y - 6} L ${x - 24} ${mid.y - 6} L ${x - 24} ${mid.y} M ${x - 20} ${mid.y + 6} L ${x - 24} ${mid.y + 6}`} strokeWidth="1.5" />}
      {actuator === 'limit' && <path d={`M ${x - 20} ${mid.y} L ${x - 26} ${mid.y - 6} L ${x - 26} ${mid.y + 6} Z`} strokeWidth="1.5" />}
      {actuator === 'timer' && <path d={`M ${x - 22} ${mid.y - 7} A 7 7 0 0 1 ${x - 22} ${mid.y + 7}`} strokeWidth="1.5" />}
    </g>
  )
}

function Coil({ kind, on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1="20" y1="0" x2="20" y2="30" />
      <line x1="20" y1="50" x2="20" y2="80" />
      <rect x="6" y="30" width="28" height="20" fill={on ? '#bbf7d0' : 'white'} />
      {kind === 'ton' && <rect x="6" y="30" width="7" height="20" fill={INK} />}
      {kind === 'tof' && <rect x="27" y="30" width="7" height="20" fill={INK} />}
      {kind === 'valve' && <line x1="10" y1="48" x2="30" y2="32" strokeWidth="1.5" />}
    </g>
  )
}

function Lamp({ color, on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1="20" y1="0" x2="20" y2="28" />
      <line x1="20" y1="52" x2="20" y2="80" />
      <circle cx="20" cy="40" r="12" fill={on ? LAMP_COLORS[color] ?? LAMP_COLORS.green : 'white'} />
      <path d="M 11.5 31.5 L 28.5 48.5 M 28.5 31.5 L 11.5 48.5" strokeWidth="1.5" />
    </g>
  )
}

// Tres polos (aparatos de potencia) con su unión mecánica discontinua.
function ThreePoles({ closed, fixedMark, thermal = false, tripped = false }) {
  return (
    <g>
      {[20, 60, 100].map((x) =>
        thermal ? (
          <g key={x} fill="none" stroke={INK} strokeWidth="2">
            <line x1={x} y1="0" x2={x} y2="28" />
            <rect x={x - 8} y="28" width="16" height="24" fill={tripped ? '#fecaca' : 'white'} />
            <path d={`M ${x} 30 L ${x} 36 L ${x + 4} 36 L ${x + 4} 44 L ${x} 44 L ${x} 50`} strokeWidth="1.3" />
            <line x1={x} y1="52" x2={x} y2="80" />
          </g>
        ) : (
          <Contact key={x} x={x} closed={closed} fixedMark={fixedMark} />
        ),
      )}
      {!thermal && <line x1="13" y1="42" x2="93" y2="42" stroke={INK} strokeDasharray="3 3" strokeWidth="1" />}
    </g>
  )
}

function Motor({ c, m }) {
  const six = c.type === 'motor6'
  const color = m?.running ? LIVE : INK
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      {[20, 60, 100].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="30" />
      ))}
      <path d="M 20 30 L 45 45 M 60 30 L 60 40 M 100 30 L 75 45" />
      {six && [20, 60, 100].map((x) => <line key={`b${x}`} x1={x} y1="120" x2={x} y2="90" />)}
      {six && <path d="M 20 90 L 45 78 M 60 90 L 60 82 M 100 90 L 75 78" />}
      <circle cx="60" cy="62" r="24" fill="white" stroke={color} strokeWidth={m?.running ? 3 : 2} />
      <text x="60" y="60" textAnchor="middle" fontSize="14" fontWeight="700" fill={INK} stroke="none">
        M
      </text>
      <text x="60" y="75" textAnchor="middle" fontSize="10" fill={INK} stroke="none">
        3~
      </text>
      {m?.running && (
        <text x="90" y="70" fontSize="16" fill={LIVE} stroke="none">
          {m.dir > 0 ? '↻' : '↺'}
        </text>
      )}
    </g>
  )
}

function Plc({ c, s }) {
  const terms = plcTerminals(c)
  const w = Math.max(...terms.map((t) => t.x)) + 20
  return (
    <g>
      <rect x="2" y="16" width={w - 4} height="88" rx="4" fill="#f1f5f9" stroke={INK} strokeWidth="2" />
      {terms.map((t) => {
        const top = t.side === 'top'
        const lit = t.id.startsWith('I') ? s?.plcIn?.[t.id] : t.id.startsWith('Q') ? s?.plcOut?.[t.id] : false
        return (
          <g key={t.id}>
            <line x1={t.x} y1={top ? 0 : 104} x2={t.x} y2={top ? 16 : 120} stroke={INK} strokeWidth="2" />
            <text x={t.x} y={top ? 30 : 96} textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill={INK}>
              {t.id}
            </text>
            {(t.id.startsWith('I') || t.id.startsWith('Q')) && <circle cx={t.x} cy={top ? 40 : 84} r="3.5" fill={lit ? LIVE : '#cbd5e1'} />}
          </g>
        )
      })}
      <text x={w / 2} y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>
        {c.text || 'Autómata'}
      </text>
    </g>
  )
}

// Dibujo de un componente. view: estado de la simulación (lib/elec/solve.js: view) o null.
export function ElecSymbol({ c, view }) {
  const closed = view?.closed?.[c.id]
  switch (c.type) {
    case 'rail': {
      const len = Number(c.length) || 400
      return <line x1="0" y1="10" x2={len} y2="10" stroke={POTENTIAL_COLORS[c.potential] ?? INK} strokeWidth="4" />
    }
    case 'pushbutton':
      return <Contact nc={c.contact === 'NC'} closed={closed ?? c.contact === 'NC'} actuator="push" />
    case 'switch':
      return <Contact nc={c.contact === 'NC'} closed={closed ?? c.contact === 'NC'} actuator="switch" />
    case 'emergency':
      return <Contact nc closed={closed ?? true} actuator="emergency" />
    case 'limit':
      return <Contact nc={c.contact === 'NC'} closed={closed ?? c.contact === 'NC'} actuator="limit" />
    case 'contact':
      return <Contact nc={c.contact === 'NC'} closed={closed ?? c.contact === 'NC'} actuator={c.timed ? 'timer' : null} />
    case 'coil':
      return <Coil kind={c.kind} on={view?.loads?.[c.id]} />
    case 'valve':
      return <Coil kind="valve" on={view?.loads?.[c.id]} />
    case 'lamp':
      return <Lamp color={c.color} on={view?.loads?.[c.id]} />
    case 'breaker':
      return Number(c.poles) === 1 ? <Contact closed={closed ?? true} fixedMark="breaker" /> : <ThreePoles closed={closed ?? true} fixedMark="breaker" />
    case 'motorprotector':
      return <ThreePoles closed={closed ?? true} fixedMark="breaker" />
    case 'thermal':
      return <ThreePoles thermal tripped={view?.tripped?.[c.id]} />
    case 'maincontacts':
      return <ThreePoles closed={closed ?? false} fixedMark="contactor" />
    case 'motor3':
    case 'motor6':
      return <Motor c={c} m={view?.motors?.[c.id]} />
    case 'plc':
      return <Plc c={c} s={view} />
    default:
      return null
  }
}
