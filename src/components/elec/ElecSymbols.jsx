// Símbolos IEC 60617 del esquema eléctrico (lib/elec/catalog.js), dibujados en la caja del
// componente (origen arriba a la izquierda; bornes en la cuadrícula de 20 px). `s` es el estado de
// la simulación para ese componente (o null al editar).
import { plcTerminals, sizeOf, terminalsOf } from '../../lib/elec/catalog'

import { INK, POTENTIAL_COLORS } from './elecColors'
import { PneuSymbol } from './PneuSymbols'

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
      {actuator === 'float' && <circle cx={x - 27} cy={mid.y} r="6" strokeWidth="1.5" />}
      {(actuator === 'pressure' || actuator === 'thermostat') && (
        <text x={x - 27} y={mid.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} stroke="none">
          {actuator === 'pressure' ? 'P' : 'θ'}
        </text>
      )}
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
            {t.id.startsWith('AIW') && s?.plcInAnalog?.[t.id] && (
              <text x={t.x} y="44" textAnchor="middle" fontSize="8" fill="#1d4ed8">
                {`${s.plcInAnalog[t.id].value.toFixed(1)} ${s.plcInAnalog[t.id].unit}`}
              </text>
            )}
          </g>
        )
      })}
      <text x={w / 2} y="64" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>
        {c.text || 'Autómata'}
      </text>
    </g>
  )
}

// Fusible (con la cuchilla del seccionador portafusibles si está abierto; fundido, en rojo).
function Fuse({ x = 20, open, blown }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1={x} y1="0" x2={x} y2="22" />
      {open ? <line x1={x} y1="22" x2={x - 12} y2="56" /> : <rect x={x - 6} y="22" width="12" height="36" fill={blown ? '#fecaca' : 'white'} />}
      {!open && <line x1={x} y1="22" x2={x} y2="58" strokeWidth="1.2" />}
      {blown && <path d={`M ${x - 7} 30 L ${x + 7} 50 M ${x + 7} 30 L ${x - 7} 50`} stroke="#dc2626" strokeWidth="1.5" />}
      <line x1={x} y1="58" x2={x} y2="80" />
    </g>
  )
}

// Diferencial: dos polos con el toroide y el botón de prueba (T).
function Rcd({ closed }) {
  return (
    <g>
      <Contact x={20} closed={closed} fixedMark="breaker" />
      <Contact x={60} closed={closed} fixedMark="breaker" />
      <line x1="13" y1="42" x2="53" y2="42" stroke={INK} strokeDasharray="3 3" strokeWidth="1" />
      <ellipse cx="40" cy="66" rx="26" ry="5" fill="none" stroke={INK} strokeWidth="1.3" />
      <text x="40" y="78" textAnchor="middle" fontSize="7" fill={INK}>
        I∆n
      </text>
    </g>
  )
}

function Transformer({ on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <path d="M 20 0 L 20 18 L 40 18 M 60 0 L 60 18 L 40 18" />
      <circle cx="40" cy="38" r="16" fill={on ? '#fef3c7' : 'white'} />
      <circle cx="40" cy="62" r="16" fill={on ? '#fed7aa' : 'white'} fillOpacity="0.8" />
      <path d="M 40 82 L 20 82 L 20 100 M 40 82 L 60 82 L 60 100" />
    </g>
  )
}

// Conmutador 0-1-2: dos contactos y el mando de tres posiciones.
function Selector3({ pos = 0 }) {
  return (
    <g>
      <Contact x={20} closed={pos === 1} />
      <Contact x={60} closed={pos === 2} />
      <line x1="13" y1="44" x2="53" y2="44" stroke={INK} strokeDasharray="3 2" strokeWidth="1.2" />
      {['0', '1', '2'].map((t, i) => (
        <text key={t} x={2 + i * 9} y="76" fontSize="8" fontWeight={pos === i ? 700 : 400} fill={pos === i ? '#16a34a' : '#64748b'}>
          {t}
        </text>
      ))}
    </g>
  )
}

// Detector de proximidad de 3 hilos (cuadrado con rombo), con los colores de sus cables.
function Sensor3({ c, active }) {
  return (
    <g strokeWidth="2" fill="none">
      <line x1="20" y1="0" x2="20" y2="24" stroke="#92400e" />
      <line x1="60" y1="0" x2="60" y2="24" stroke="#2563eb" />
      <line x1="40" y1="56" x2="40" y2="80" stroke="#111827" />
      <rect x="10" y="24" width="60" height="32" fill={active ? '#bbf7d0' : 'white'} stroke={INK} />
      <path d="M 24 40 L 31 33 L 38 40 L 31 47 Z" stroke={INK} strokeWidth="1.3" />
      <text x="54" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill={INK} stroke="none">
        {c.output === 'NPN' ? 'NPN' : 'PNP'}
      </text>
    </g>
  )
}

function Counter({ count, on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1="20" y1="0" x2="20" y2="28" />
      <line x1="20" y1="52" x2="20" y2="80" />
      <line x1="60" y1="0" x2="60" y2="28" />
      <line x1="60" y1="52" x2="60" y2="80" />
      <rect x="6" y="28" width="68" height="24" fill={on ? '#bbf7d0' : 'white'} />
      <text x="40" y="45" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} stroke="none" fontFamily="ui-monospace, monospace">
        {count ?? 0}
      </text>
      <text x="66" y="38" textAnchor="middle" fontSize="7" fill={INK} stroke="none">
        R
      </text>
    </g>
  )
}

function Buzzer({ kind, on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1="20" y1="0" x2="20" y2="30" />
      <line x1="20" y1="50" x2="20" y2="80" />
      {kind === 'buzzer' ? (
        <path d="M 6 30 L 34 30 L 34 50 L 6 50 Z M 10 40 L 30 40" fill={on ? '#fde68a' : 'white'} />
      ) : (
        <path d="M 6 50 A 14 14 0 0 1 34 50 Z" fill={on ? '#fde68a' : 'white'} />
      )}
      {on && <path d="M 38 32 Q 44 40 38 48" stroke="#f59e0b" />}
    </g>
  )
}

function Changeover({ on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
      <line x1="40" y1="0" x2="40" y2="26" />
      <path d={on ? 'M 40 26 L 58 54' : 'M 40 26 L 22 54'} stroke="#16a34a" strokeWidth="2.4" />
      <line x1="20" y1="54" x2="20" y2="80" />
      <line x1="60" y1="54" x2="60" y2="80" />
      <line x1="14" y1="54" x2="26" y2="54" strokeWidth="1.3" />
      <line x1="54" y1="54" x2="66" y2="54" strokeWidth="1.3" />
    </g>
  )
}

function Crossover({ on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round">
      <line x1="20" y1="0" x2="20" y2="26" />
      <line x1="60" y1="0" x2="60" y2="26" />
      <line x1="20" y1="54" x2="20" y2="80" />
      <line x1="60" y1="54" x2="60" y2="80" />
      {on ? <path d="M 20 26 L 60 54 M 60 26 L 20 54" stroke="#16a34a" strokeWidth="2.2" /> : <path d="M 20 26 L 20 54 M 60 26 L 60 54" stroke="#16a34a" strokeWidth="2.2" />}
    </g>
  )
}

function Socket() {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <path d="M 20 0 L 20 24 M 40 0 L 40 24 M 60 0 L 60 18" />
      <path d="M 12 24 L 48 24 A 18 18 0 0 1 12 24" fill="white" />
      <path d="M 54 18 L 66 18" />
      <text x="62" y="34" fontSize="8" fill={INK} stroke="none">
        PE
      </text>
    </g>
  )
}

// Caja con un rótulo dentro (aparatos electrónicos: fuente, variador, relé de seguridad…).
function Box({ x = 4, y = 16, w, h, label, sub, on }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill={on ? '#dcfce7' : '#f8fafc'} stroke={INK} strokeWidth="2" />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} textAnchor="middle" fontSize="11" fontWeight="700" fill={INK}>
        {label}
      </text>
      {sub && (
        <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize="9" fill="#334155">
          {sub}
        </text>
      )}
    </g>
  )
}
// Bornes de una caja: línea desde el borne hasta la caja, con su nombre dentro.
function Leads({ terms, top, bottom }) {
  return (
    <g>
      {terms.map((t) => (
        <g key={t.id}>
          <line x1={t.x} y1={t.y} x2={t.x} y2={t.side === 'top' ? top : bottom} stroke={INK} strokeWidth="1.6" />
          <text x={t.x} y={t.side === 'top' ? top + 10 : bottom - 4} textAnchor="middle" fontSize="7.5" fontFamily="ui-monospace, monospace" fill={INK}>
            {t.id}
          </text>
        </g>
      ))}
    </g>
  )
}

function DoorSwitch({ open }) {
  return (
    <g>
      <Contact x={20} nc closed={!open} />
      <Contact x={60} nc closed={!open} />
      <line x1="20" y1="44" x2="60" y2="44" stroke={INK} strokeDasharray="3 2" strokeWidth="1.2" />
      {/* Lengüeta del resguardo */}
      <path d="M 66 34 L 76 34 L 76 54 L 66 54" fill="none" stroke={INK} strokeWidth="1.5" />
    </g>
  )
}

function LightCurtain({ ok, broken }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <path d="M 20 0 L 20 16 M 80 0 L 80 16 M 40 84 L 40 100 M 60 84 L 60 100" />
      <rect x="8" y="16" width="14" height="68" fill="#e2e8f0" />
      <rect x="78" y="16" width="14" height="68" fill="#e2e8f0" />
      {[26, 38, 50, 62, 74].map((y) => (
        <line key={y} x1="22" y1={y} x2="78" y2={y} stroke={ok ? '#ef4444' : '#cbd5e1'} strokeWidth="1" strokeDasharray={broken ? '4 3' : undefined} />
      ))}
    </g>
  )
}

function Beacon({ lights }) {
  const colors = [
    ['red', '#ef4444', 'X1'],
    ['amber', '#f59e0b', 'X2'],
    ['green', '#22c55e', 'X3'],
  ]
  return (
    <g>
      {[20, 40, 60, 80].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="14" stroke={INK} strokeWidth="1.6" />
      ))}
      <path d="M 100 120 L 100 104" stroke={INK} strokeWidth="1.6" />
      {colors.map(([k, color], i) => (
        <rect key={k} x="34" y={14 + i * 22} width="32" height="20" rx="4" fill={lights?.[k] ? color : '#f1f5f9'} stroke={INK} strokeWidth="1.5" />
      ))}
      <rect x="34" y="80" width="32" height="12" fill={lights?.buzzer ? '#fde68a' : '#e2e8f0'} stroke={INK} strokeWidth="1.5" />
      <rect x="28" y="92" width="44" height="12" rx="2" fill="#475569" />
      <path d="M 72 98 L 100 98 L 100 104" fill="none" stroke={INK} strokeWidth="1.2" />
    </g>
  )
}

function LitButton({ c, closed, lit }) {
  return (
    <g>
      <Contact x={20} closed={closed} actuator="push" />
      <g fill="none" stroke={INK} strokeWidth="2">
        <line x1="60" y1="0" x2="60" y2="28" />
        <line x1="60" y1="52" x2="60" y2="80" />
        <circle cx="60" cy="40" r="11" fill={lit ? ({ green: '#22c55e', red: '#ef4444', amber: '#f59e0b', white: '#f8fafc', blue: '#3b82f6' }[c.color] ?? '#22c55e') : 'white'} />
        <path d="M 52 32 L 68 48 M 68 32 L 52 48" strokeWidth="1.3" />
      </g>
      <line x1="10" y1="40" x2="49" y2="40" stroke={INK} strokeDasharray="3 2" strokeWidth="1" />
    </g>
  )
}

function Transmitter({ c }) {
  const volts = c.output === '0-10V'
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1="20" y1="0" x2="20" y2="22" />
      {volts && <line x1="60" y1="0" x2="60" y2="22" />}
      <line x1="40" y1="58" x2="40" y2="80" />
      <circle cx="40" cy="40" r="18" fill="white" />
      <text x="40" y="38" textAnchor="middle" fontSize="8" fontWeight="700" fill={INK} stroke="none">
        {volts ? '0-10V' : '4-20'}
      </text>
      <text x="40" y="48" textAnchor="middle" fontSize="7" fill={INK} stroke="none">
        {volts ? 'V' : 'mA'}
      </text>
    </g>
  )
}

function Potentiometer({ value }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <rect x="10" y="30" width="60" height="16" fill="white" />
      <path d="M 40 60 L 40 80 M 40 60 L 34 50 M 40 60 L 46 50" />
      <path d={`M ${12 + 56 * (value ?? 0.5)} 26 L ${12 + 56 * (value ?? 0.5)} 50`} stroke="#2563eb" strokeWidth="2.5" />
      <text x="40" y="22" textAnchor="middle" fontSize="9" fill={INK} stroke="none">
        {`${Math.round((value ?? 0.5) * 100)} %`}
      </text>
    </g>
  )
}

function Brake({ on }) {
  return (
    <g fill="none" stroke={INK} strokeWidth="2">
      <line x1="20" y1="0" x2="20" y2="30" />
      <line x1="20" y1="50" x2="20" y2="80" />
      <rect x="6" y="30" width="28" height="20" fill={on ? '#bbf7d0' : '#fecaca'} />
      <path d="M 10 40 L 30 40" strokeWidth="1.3" />
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
      return Number(c.channels) === 2 ? (
        <g>
          <Contact nc closed={closed ?? true} actuator="emergency" />
          <Contact x={60} nc closed={closed ?? true} />
          <line x1="20" y1="44" x2="60" y2="44" stroke={INK} strokeDasharray="3 2" strokeWidth="1.2" />
        </g>
      ) : (
        <Contact nc closed={closed ?? true} actuator="emergency" />
      )
    case 'limit':
      return <Contact nc={c.contact === 'NC'} closed={closed ?? c.contact === 'NC'} actuator={['float', 'pressure', 'thermostat'].includes(c.kind) ? c.kind : 'limit'} />
    case 'selector3':
      return <Selector3 pos={view?.pos?.[c.id] ?? 0} />
    case 'sensor3':
      return <Sensor3 c={c} active={view?.closed?.[c.id]} />
    case 'counter':
      return <Counter count={view?.counts?.[c.tag]} on={view?.loads?.[c.id]} />
    case 'buzzer':
      return <Buzzer kind={c.kind} on={view?.loads?.[c.id]} />
    case 'fuse':
      return Number(c.poles) === 3 ? (
        <g>
          {[20, 60, 100].map((x) => (
            <Fuse key={x} x={x} open={view?.opened?.[c.id]} blown={view?.tripped?.[c.id]} />
          ))}
        </g>
      ) : (
        <Fuse open={view?.opened?.[c.id]} blown={view?.tripped?.[c.id]} />
      )
    case 'rcd':
      return <Rcd closed={closed ?? true} />
    case 'transformer':
      return <Transformer on={view?.loads?.[c.id]} />
    case 'changeover':
      return <Changeover on={closed} />
    case 'crossover':
      return <Crossover on={closed} />
    case 'socket':
      return <Socket />
    case 'terminal':
      return (
        <g>
          <line x1="20" y1="0" x2="20" y2="40" stroke={INK} strokeWidth="2" />
          <circle cx="20" cy="20" r="6" fill={c.kind === 'pe' ? '#bef264' : 'white'} stroke={c.kind === 'pe' ? '#65a30d' : INK} strokeWidth="1.8" />
          {c.kind === 'pe' && <path d="M 16 20 L 24 20 M 17.5 23 L 22.5 23 M 19 26 L 21 26" stroke="#365314" strokeWidth="1.2" />}
        </g>
      )
    case 'mainswitch':
      return (
        <g>
          <ThreePoles closed={closed ?? true} />
          {/* Mando giratorio del interruptor general (con candado) */}
          <circle cx="112" cy="42" r="6" fill="#facc15" stroke={INK} strokeWidth="1.5" />
          <line x1="93" y1="42" x2="106" y2="42" stroke={INK} strokeDasharray="3 2" strokeWidth="1" />
        </g>
      )
    case 'psu':
    case 'phasemonitor':
    case 'vfd':
    case 'softstarter':
    case 'safetyrelay': {
      const { w, h } = sizeOf(c)
      const top = c.type === 'phasemonitor' ? 14 : 16
      const bottom = h - 16
      const terms = terminalsOf(c)
      const sub =
        c.type === 'vfd'
          ? view?.vfd?.[c.id]?.dir
            ? `${view.vfd[c.id].hz} Hz ${view.vfd[c.id].dir > 0 ? '→' : '←'}`
            : 'parado'
          : c.type === 'softstarter'
            ? view?.soft?.[c.id]?.on
              ? `rampa ${Math.round(view.soft[c.id].pct * 100)} %`
              : ''
            : c.type === 'safetyrelay' && view?.safety?.[c.id]
              ? `canal 1 ${view.safety[c.id].ch1 ? '✓' : '✗'} · canal 2 ${view.safety[c.id].ch2 ? '✓' : '✗'}`
              : c.type === 'psu'
                ? '230 V~ / 24 V DC'
                : ''
      const label = { psu: 'Fuente 24 V', phasemonitor: 'Control de fases', vfd: 'Variador', softstarter: 'Arrancador suave', safetyrelay: 'Relé de seguridad' }[c.type]
      return (
        <g>
          <Box x={2} y={top} w={w - 4} h={bottom - top} label={label} sub={sub} on={view?.loads?.[c.id]} />
          <Leads terms={terms} top={top} bottom={bottom} />
        </g>
      )
    }
    case 'doorswitch':
      return <DoorSwitch open={closed === false} />
    case 'lightcurtain':
      return <LightCurtain ok={view?.loads?.[c.id]} broken={closed === false} />
    case 'beacon':
      return <Beacon lights={view?.beacons?.[c.id]} />
    case 'litbutton':
      return <LitButton c={c} closed={closed ?? false} lit={view?.loads?.[c.id]} />
    case 'transmitter':
      return <Transmitter c={c} />
    case 'potentiometer':
      return <Potentiometer value={view?.knob?.[c.id] ?? Number(c.initial ?? 0.5)} />
    case 'brake':
      return <Brake on={view?.loads?.[c.id]} />
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
      return <PneuSymbol c={c} view={view} />
  }
}
