import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { closest } from '../lib/autocomplete'
import { ArrowLeft, ArrowRight, Cable, ChevronDown, Copy, Hand, Maximize2, Tag, Minimize2, Minus, MousePointer2, Plus, RotateCw, Scan, Trash2, WandSparkles, X } from 'lucide-react'
import {
  PIECE_SIZES,
  SCENE_TYPES,
  SCENE_VARS,
  TANK,
  conveyorRect,
  cylinderPlate,
  PIECE_COLORS,
  SENSOR_KINDS,
  detectScene,
  limitZone,
  measuredDistance,
  overlaps,
  sceneIO,
  weighed,
  sceneFaults,
  sceneSignals,
  sensorZone,
  sinkRect,
  distanceBeam,
  worldRect,
} from '../lib/sim/scene'
import { copyToClipboard, pasteFromClipboard } from '../lib/sim/sceneClipboard'

const W = 1200
const H = 800
const GRID = 10
const snap = (v) => Math.round(v / GRID) * GRID
const COLORS = {
  green: '#16a34a',
  red: '#dc2626',
  yellow: '#eab308',
  blue: '#2563eb',
  black: '#1e293b',
  white: '#f8fafc',
  amber: '#f59e0b',
  metal: '#94a3b8',
}
const COLOR_NAMES = { green: 'Verde', red: 'Rojo', yellow: 'Amarillo', blue: 'Azul', black: 'Negro', white: 'Blanco' }
const INK = '#0f172a'
const ON = '#16a34a'
const OFF = '#cbd5e1'
const isOn = (values, name) => Boolean(name) && Number(values[name] ?? 0) !== 0

// --- Dibujos (coordenadas locales: anclaje en 0,0; el grupo se gira con rot) ----------------

function ButtonShape({ e, pressed }) {
  const fill = COLORS[e.color] ?? COLORS.green
  return (
    <g>
      <rect x="-20" y="-20" width="40" height="40" rx="6" fill="#e2e8f0" stroke={INK} />
      <circle r={pressed ? 12 : 14} fill={fill} stroke={INK} strokeWidth="1.5" opacity={pressed ? 0.75 : 1} />
      {e.contact === 'NC' && (
        <text y="4" textAnchor="middle" fontSize="9" fontWeight="700" fill="white">
          NC
        </text>
      )}
    </g>
  )
}
function SwitchShape({ pressed }) {
  return (
    <g>
      <rect x="-20" y="-20" width="40" height="40" rx="6" fill="#e2e8f0" stroke={INK} />
      <circle r="12" fill="#334155" />
      <rect x="-3" y="-14" width="6" height="16" rx="2" fill="white" transform={`rotate(${pressed ? 45 : -45})`} />
      <text x="-16" y="-8" fontSize="7" fill={INK}>
        0
      </text>
      <text x="11" y="-8" fontSize="7" fill={INK}>
        1
      </text>
    </g>
  )
}
function EmergencyShape({ pressed }) {
  return (
    <g>
      <circle r="26" fill="#facc15" stroke={INK} />
      <circle r={pressed ? 15 : 18} fill="#dc2626" stroke={INK} strokeWidth="1.5" />
      {pressed && (
        <text y="4" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
          PULSADA
        </text>
      )}
    </g>
  )
}
function LampShape({ e, lit }) {
  const fill = COLORS[e.color] ?? COLORS.green
  return (
    <g>
      {lit && <circle r="20" fill={fill} opacity="0.25" />}
      <circle r="14" fill={lit ? fill : '#e2e8f0'} stroke={INK} strokeWidth="1.5" />
      <circle r="8" fill="white" opacity={lit ? 0.35 : 0.6} />
    </g>
  )
}
function CylinderShape({ e, pos, values }) {
  const stroke = Number(e.stroke) || 100
  const out = isOn(values, e.extend)
  const back = e.retract ? isOn(values, e.retract) : !out
  return (
    <g>
      <rect x="0" y="-12" width="80" height="24" rx="3" fill="#e2e8f0" stroke={INK} strokeWidth="1.5" />
      <rect x={6 + pos * 62} y="-10" width="6" height="20" fill={INK} />
      <rect x={12 + pos * 62} y="-3" width={68 - pos * 62 + pos * stroke} height="6" fill="#64748b" />
      <rect x={80 + pos * stroke} y="-14" width="8" height="28" rx="1" fill="#475569" />
      {/* Tomas de aire: verde cuando llega la orden */}
      <circle cx="10" cy="-15" r="3" fill={back && !out ? ON : OFF} stroke={INK} strokeWidth="0.5" />
      <circle cx="70" cy="-15" r="3" fill={out && !back ? ON : OFF} stroke={INK} strokeWidth="0.5" />
      {e.retracted && <circle cx="12" cy="15" r="3" fill={pos <= 0.001 ? ON : OFF} stroke={INK} strokeWidth="0.5" />}
      {e.extended && <circle cx="68" cy="15" r="3" fill={pos >= 0.999 ? ON : OFF} stroke={INK} strokeWidth="0.5" />}
      {/* Carrera (guía discontinua) */}
      <line x1="88" y1="18" x2={88 + stroke} y2="18" stroke="#94a3b8" strokeDasharray="3 3" />
    </g>
  )
}
function ConveyorShape({ e, running, t }) {
  const length = Number(e.length) || 240
  const offset = running ? (t * 40) % 20 : 0
  return (
    <g>
      <rect x="0" y="-15" width={length} height="30" rx="15" fill="#cbd5e1" stroke={running ? ON : INK} strokeWidth="1.5" />
      {Array.from({ length: Math.floor((length - 30) / 20) + 1 }, (_, i) => (
        <line key={i} x1={15 + i * 20 + offset} y1="-13" x2={15 + i * 20 + offset} y2="13" stroke="#94a3b8" />
      ))}
      <circle cx="15" cy="0" r="11" fill="none" stroke={INK} />
      <circle cx={length - 15} cy="0" r="11" fill="none" stroke={INK} />
      <path d={`M ${length / 2 - 6} -5 L ${length / 2 + 4} 0 L ${length / 2 - 6} 5`} fill="none" stroke={running ? ON : '#64748b'} strokeWidth="2" />
    </g>
  )
}
function LimitShape({ active }) {
  return (
    <g>
      <rect x="-10" y="-6" width="20" height="14" rx="2" fill="#e2e8f0" stroke={INK} />
      <line x1="0" y1="-6" x2="0" y2="-11" stroke={INK} strokeWidth="2" />
      <circle cx="0" cy="-15" r="5" fill={active ? ON : 'white'} stroke={INK} strokeWidth="1.5" />
    </g>
  )
}
// Detector de presencia: óptico (con haz), inductivo (cara azul), capacitivo (cara naranja) o de
// color (tres leds). La zona de detección, roja cuando detecta.
function SensorShape({ e, active }) {
  const kind = e.kind ?? 'optical'
  const zone = <rect x={10} y={-6} width={Number(e.range) || 60} height={12} fill={active ? '#ef4444' : '#94a3b8'} opacity={active ? 0.35 : 0.15} />
  if (kind === 'optical') {
    return (
      <g>
        {zone}
        <rect x="-10" y="-8" width="20" height="16" rx="3" fill="#334155" />
        <circle cx="10" cy="0" r="4" fill={active ? '#f87171' : '#64748b'} />
      </g>
    )
  }
  const face = { inductive: '#2563eb', capacitive: '#f97316', color: '#e2e8f0' }[kind]
  return (
    <g>
      {zone}
      <rect x="-16" y="-7" width="24" height="14" rx="2" fill="#475569" />
      <line x1="-12" y1="-7" x2="-12" y2="7" stroke="#94a3b8" />
      <line x1="-6" y1="-7" x2="-6" y2="7" stroke="#94a3b8" />
      <rect x="6" y="-7" width="5" height="14" rx="1" fill={face} />
      {kind === 'color' &&
        ['#dc2626', '#16a34a', '#2563eb'].map((c, i) => <circle key={c} cx="8.5" cy={-4 + i * 4} r="1.5" fill={c} />)}
      <circle cx="-2" cy="-10" r="2.5" fill={active ? '#ef4444' : '#cbd5e1'} />
    </g>
  )
}
function DistanceShape({ e, distance }) {
  const range = Number(e.range) || 200
  return (
    <g>
      <rect x="12" y="-6" width={range} height="12" fill="#a855f7" opacity="0.1" />
      {distance !== null && <line x1="12" y1="0" x2={12 + distance} y2="0" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />}
      <rect x="-12" y="-11" width="24" height="22" rx="3" fill="#334155" />
      <circle cx="6" cy="-5" r="4" fill="#94a3b8" stroke="#1e293b" />
      <circle cx="6" cy="5" r="4" fill="#94a3b8" stroke="#1e293b" />
    </g>
  )
}
function ScaleShape({ kg }) {
  return (
    <g>
      <rect x="-40" y="-8" width="80" height="6" rx="2" fill="#64748b" />
      <polygon points="-30,-2 30,-2 22,14 -22,14" fill="#cbd5e1" stroke={INK} />
      <rect x="-20" y="16" width="40" height="15" rx="2" fill="#0f172a" />
      <text x="16" y="27" textAnchor="end" fontSize="10" fontFamily="ui-monospace, Consolas, monospace" fill="#4ade80">
        {String(Math.round(kg * 10) / 10).replace('.', ',')} kg
      </text>
    </g>
  )
}
function PotentiometerShape({ value }) {
  const angle = -135 + value * 270
  const arc = (a) => [Math.sin((a * Math.PI) / 180) * 17, -Math.cos((a * Math.PI) / 180) * 17]
  const [x0, y0] = arc(-135)
  const [x1, y1] = arc(angle)
  return (
    <g>
      <circle r="21" fill="#e2e8f0" stroke={INK} />
      <path d={`M ${x0} ${y0} A 17 17 0 ${angle + 135 > 180 ? 1 : 0} 1 ${x1} ${y1}`} fill="none" stroke="#2563eb" strokeWidth="3" />
      <circle r="11" fill="#334155" />
      <line x1="0" y1="0" x2="0" y2="-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${angle})`} />
      <text y="34" textAnchor="middle" fontSize="9" fill={INK}>
        {Math.round(value * 100)} %
      </text>
    </g>
  )
}
function HeaterShape({ e, temp, heating }) {
  const ambient = Number(e.ambient ?? 20)
  const hot = Math.min(1, Math.max(0, (temp - ambient) / Math.max(1, Number(e.maxTemp ?? 150) - ambient)))
  return (
    <g>
      <rect x="-40" y="-24" width="80" height="48" rx="6" fill="#f97316" fillOpacity={0.08 + hot * 0.6} stroke={INK} strokeWidth="1.5" />
      <polyline points="-30,6 -24,-4 -18,6 -12,-4 -6,6 0,-4 6,6 12,-4 18,6 24,-4 30,6" fill="none" stroke={heating ? '#dc2626' : '#64748b'} strokeWidth="2" />
      <text y="-10" textAnchor="middle" fontSize="11" fontWeight="600" fill={INK}>
        {Math.round(temp)} °C
      </text>
    </g>
  )
}
function PieceShape({ p }) {
  const metal = p.material === 'metal'
  return (
    <g pointerEvents="none" data-piece={p.id} data-material={p.material ?? 'plastic'}>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={COLORS[p.color] ?? COLORS.amber} stroke={metal ? '#334155' : INK} />
      {metal && <line x1={p.x + 4} y1={p.y + p.h - 5} x2={p.x + p.w - 5} y2={p.y + 4} stroke="white" strokeWidth="2" opacity="0.6" />}
    </g>
  )
}
function FeederShape() {
  return (
    <g>
      <polygon points="-28,-56 28,-56 18,-26 -18,-26" fill="#e2e8f0" stroke={INK} />
      <rect x="-24" y="-24" width="48" height="48" fill="none" stroke="#94a3b8" strokeDasharray="4 3" />
    </g>
  )
}
function SinkShape({ count }) {
  return (
    <g>
      <rect x="-30" y="-30" width="60" height="60" rx="4" fill="#f1f5f9" stroke={INK} strokeDasharray="5 3" />
      <text y="4" textAnchor="middle" fontSize="13" fontWeight="600" fill={INK}>
        {count}
      </text>
    </g>
  )
}

function TankShape({ e, level, values }) {
  const { w, h } = TANK
  const fill = isOn(values, e.fill)
  const drain = isOn(values, e.drain)
  return (
    <g>
      <rect x="0" y="0" width={w} height={h} rx="4" fill="#f8fafc" stroke={INK} strokeWidth="1.5" />
      <rect x="1" y={1 + (h - 2) * (1 - level)} width={w - 2} height={(h - 2) * level} fill="#3b82f6" opacity="0.55" />
      {/* Válvulas: entrada arriba, salida abajo */}
      <path d={`M ${w / 2 - 8} -16 L ${w / 2 + 8} -4 L ${w / 2 + 8} -16 L ${w / 2 - 8} -4 Z`} fill={fill ? ON : OFF} stroke={INK} />
      <line x1={w / 2} y1="-24" x2={w / 2} y2="-16" stroke={INK} strokeWidth="2" />
      <path d={`M ${w / 2 - 8} ${h + 4} L ${w / 2 + 8} ${h + 16} L ${w / 2 + 8} ${h + 4} L ${w / 2 - 8} ${h + 16} Z`} fill={drain ? ON : OFF} stroke={INK} />
      {fill && <line x1={w / 2} y1="-4" x2={w / 2} y2={(h - 2) * (1 - level)} stroke="#3b82f6" strokeWidth="3" opacity="0.6" />}
      {e.high && <circle cx={w + 8} cy={h * (1 - TANK.high)} r="4" fill={level >= TANK.high ? ON : OFF} stroke={INK} strokeWidth="0.75" />}
      {e.low && <circle cx={w + 8} cy={h * (1 - TANK.low)} r="4" fill={level >= TANK.low ? ON : OFF} stroke={INK} strokeWidth="0.75" />}
      <text x={w / 2} y={h / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
        {Math.round(level * 100)} %
      </text>
    </g>
  )
}
function MotorShape({ angle, running }) {
  return (
    <g>
      <circle r="20" fill="#e2e8f0" stroke={running ? ON : INK} strokeWidth="1.5" />
      <g transform={`rotate(${angle})`}>
        {[0, 120, 240].map((a) => (
          <path key={a} d="M 0 0 L 16 -5 L 16 5 Z" fill="#475569" transform={`rotate(${a})`} />
        ))}
      </g>
      <circle r="3" fill={INK} />
      <text x="0" y="-24" textAnchor="middle" fontSize="9" fontWeight="700" fill={running ? ON : '#64748b'}>
        M
      </text>
    </g>
  )
}
function DisplayShape({ value }) {
  const text = Number.isFinite(Number(value)) ? String(Math.round(Number(value) * 100) / 100).replace('.', ',') : '—'
  return (
    <g>
      <rect x="-40" y="-16" width="80" height="32" rx="4" fill="#0f172a" stroke={INK} />
      <text x="34" y="7" textAnchor="end" fontSize="18" fontFamily="ui-monospace, Consolas, monospace" fill="#4ade80">
        {text}
      </text>
    </g>
  )
}

// Rectángulo que ocupa un elemento (para seleccionar y para el contorno de selección).
function boundsOf(e, pos = 0) {
  const r = (x, y, w, h) => ({ x: e.x + x, y: e.y + y, w, h })
  switch (e.type) {
    case 'emergency':
      return r(-26, -26, 52, 52)
    case 'lamp':
      return r(-16, -16, 32, 32)
    case 'button':
    case 'switch':
      return r(-20, -20, 40, 40)
    case 'cylinder': {
      const body = { ...e }
      // Cuerpo y carrera completa (la guía discontinua): así se puede pulsar en cualquier punto.
      const a = cylinderPlate(body, Math.max(pos, 1))
      const b = conveyorRect({ ...e, length: 80 })
      const guide = worldRect(e, 88, 14, Number(e.stroke) || 100, 8)
      const x = Math.min(a.x, b.x, guide.x)
      const y = Math.min(a.y, b.y, guide.y)
      return { x, y, w: Math.max(a.x + a.w, b.x + b.w, guide.x + guide.w) - x, h: Math.max(a.y + a.h, b.y + b.h, guide.y + guide.h) - y }
    }
    case 'conveyor':
      return conveyorRect(e)
    case 'limit': {
      const z = limitZone(e)
      return { x: Math.min(z.x, e.x - 10), y: Math.min(z.y, e.y - 10), w: 22, h: 30 }
    }
    case 'sensor': {
      const z = sensorZone(e)
      const x = Math.min(z.x, e.x - 10)
      const y = Math.min(z.y, e.y - 10)
      return { x, y, w: Math.max(z.x + z.w, e.x + 10) - x, h: Math.max(z.y + z.h, e.y + 10) - y }
    }
    case 'distance': {
      const z = distanceBeam(e)
      const x = Math.min(z.x, e.x - 12)
      const y = Math.min(z.y, e.y - 12)
      return { x, y, w: Math.max(z.x + z.w, e.x + 12) - x, h: Math.max(z.y + z.h, e.y + 12) - y }
    }
    case 'scale':
      return r(-40, -8, 80, 40)
    case 'potentiometer':
      return r(-22, -22, 44, 60)
    case 'heater':
      return r(-40, -24, 80, 48)
    case 'feeder':
      return r(-28, -56, 56, 80)
    case 'sink':
      return sinkRect(e)
    case 'tank':
      return r(0, -24, TANK.w + 14, TANK.h + 40)
    case 'motor':
      return r(-20, -28, 40, 48)
    case 'display':
      return r(-40, -16, 80, 32)
    default:
      return r(-20, -20, 40, 40)
  }
}

function labelOf(e) {
  const vars = (SCENE_VARS[e.type] ?? []).map(([key]) => e[key]).filter(Boolean)
  // Detector sin variable: su tipo, corto (los rótulos largos se solapan entre detectores juntos).
  const fallback = e.type === 'sensor' ? { optical: 'Óptico', inductive: 'Inductivo', capacitive: 'Capacitivo', color: 'Color' }[e.kind ?? 'optical'] : null
  return e.text || vars[0] || fallback || SCENE_TYPES[e.type].label
}

// --- Propiedades -------------------------------------------------------------------------------

// Tipo de la variable nueva según el campo: lo que la escena escribe es una entrada, lo que lee
// una salida; las analógicas, entradas analógicas; el visualizador, una marca.
const NEW_TYPE = { in: 'input', out: 'output', analog: 'analogIn', any: 'memory' }
const TYPE_NAMES = { input: 'entrada', output: 'salida', analogIn: 'entrada analógica', memory: 'marca' }

// Campo de variable: se elige de la tabla o se escribe un nombre nuevo, que se añade a la tabla
// con el tipo adecuado. Si se parece mucho a uno que ya existe, pregunta antes («¿Querías decir…?»).
// La lista de sugerencias es propia (no la del navegador: con la simulación en marcha el panel se
// redibuja sin parar y la lista nativa aparecía fuera de sitio).
function VariableField({ label, value, options, allNames, dir, onPick, onCreate }) {
  const [draft, setDraft] = useState(value ?? '')
  const [typo, setTypo] = useState(null) // { name, suggestion }
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const typed = draft.trim()
  // Mientras se escribe, las que contienen lo escrito; si no, todas.
  const shown = typed && typed !== (value ?? '') ? options.filter((n) => n.toLowerCase().includes(typed.toLowerCase())) : options
  const choose = (name) => {
    setOpen(false)
    setTypo(null)
    setDraft(name)
    onPick(name)
  }
  const commit = () => {
    setOpen(false)
    const name = draft.trim()
    if (name === (value ?? '')) return
    if (!name || allNames.includes(name)) {
      setTypo(null)
      onPick(name)
      return
    }
    const suggestion = closest(name, allNames)
    if (suggestion) {
      setTypo({ name, suggestion })
      return
    }
    onCreate(name, NEW_TYPE[dir])
    onPick(name)
  }
  const fresh = typed && !allNames.includes(typed)
  return (
    <div>
      <label className="block">
        <span className="text-slate-500">{label}</span>
        <span className="relative block">
          <input
            value={draft}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            placeholder="— (elige o escribe)"
            // Al abrir, resaltada la variable actual.
            onFocus={() => {
              setOpen(true)
              setActive(Math.max(0, options.indexOf(value)))
            }}
            onClick={() => setOpen(true)}
            onChange={(ev) => {
              setDraft(ev.target.value)
              setTypo(null)
              setOpen(true)
              setActive(0)
            }}
            onBlur={commit}
            onKeyDown={(ev) => {
              if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                ev.preventDefault()
                setOpen(true)
                const n = shown.length
                if (n) setActive((i) => (i + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n)
              } else if (ev.key === 'Enter') {
                if (open && shown[active] && typed !== shown[active]) choose(shown[active])
                else commit()
              } else if (ev.key === 'Escape') {
                setOpen(false)
                setDraft(value ?? '')
              }
            }}
            className="w-full rounded border border-slate-300 px-1 py-0.5 pr-5 font-mono"
          />
          <ChevronDown size={12} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
          {open && shown.length > 0 && (
            <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-40 overflow-auto rounded border border-slate-300 bg-white py-0.5 shadow-lg">
              {shown.map((n, i) => (
                <li
                  key={n}
                  role="option"
                  aria-selected={n === value}
                  // Antes de que el campo pierda el foco (si no, el clic no llega).
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    choose(n)
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={`cursor-pointer px-1.5 py-0.5 font-mono ${i === active ? 'bg-blue-600 text-white' : n === value ? 'font-semibold' : ''}`}
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
        </span>
      </label>
      {typo ? (
        <p className="mt-0.5 text-[11px] text-amber-700" role="status">
          «{typo.name}» no existe. ¿Querías decir{' '}
          <button type="button" className="font-mono font-medium underline" onClick={() => choose(typo.suggestion)}>
            {typo.suggestion}
          </button>
          ?{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              onCreate(typo.name, NEW_TYPE[dir])
              choose(typo.name)
            }}
          >
            Crear «{typo.name}»
          </button>
        </p>
      ) : (
        fresh && <p className="mt-0.5 text-[11px] text-blue-700">Nueva: se añadirá a la tabla como {TYPE_NAMES[NEW_TYPE[dir]]}.</p>
      )}
    </div>
  )
}

// Entradas y salidas de la planta: lo conectado (con su dirección) y los avisos. Un clic en un
// elemento lo selecciona.
function IOPanel({ io, elements, onSelect }) {
  const label = (id) => {
    const e = elements.find((x) => x.id === id)
    return e ? `${SCENE_TYPES[e.type].label} ${labelOf(e)}` : id
  }
  const ElementLink = ({ id }) => (
    <button type="button" onClick={() => onSelect(id)} className="text-left text-blue-700 hover:underline">
      {label(id)}
    </button>
  )
  const warnings = io.unassigned.length + io.unusedOutputs.length + io.notInGrafcet.length
  return (
    <div className="space-y-3 text-xs" aria-label="Conexiones de la planta">
      <p className="font-semibold">Entradas y salidas de la planta</p>
      {io.signals.length === 0 ? (
        <p className="text-slate-500">Ningún elemento tiene variables todavía.</p>
      ) : (
        <ul className="space-y-1" aria-label="Conectadas">
          {io.signals.map((sig) => (
            <li key={sig.name}>
              <span className="flex items-center gap-1 font-mono">
                {sig.dir === 'out' ? (
                  <ArrowRight size={12} className="shrink-0 text-green-600" aria-label="salida del grafcet hacia la planta" />
                ) : (
                  <ArrowLeft size={12} className="shrink-0 text-blue-600" aria-label="entrada del grafcet desde la planta" />
                )}
                <span className="font-semibold">{sig.name}</span>
                <span className="text-slate-500">{sig.address || 'sin dirección'}</span>
              </span>
              <span className="block pl-4">
                {sig.elements.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <ElementLink id={id} />
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {warnings + io.manual.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-2" aria-label="Avisos de conexión">
          {io.unassigned.length > 0 && (
            <div>
              <p className="font-medium text-amber-700">Sin variable (no hacen nada):</p>
              {io.unassigned.map((id) => (
                <p key={id} className="pl-2">
                  <ElementLink id={id} />
                </p>
              ))}
            </div>
          )}
          {io.unusedOutputs.length > 0 && (
            <p>
              <span className="font-medium text-amber-700">Salidas del grafcet que ningún elemento usa: </span>
              <span className="font-mono">{io.unusedOutputs.join(', ')}</span>
            </p>
          )}
          {io.notInGrafcet.length > 0 && (
            <p>
              <span className="font-medium text-amber-700">Variables de la planta que el grafcet no usa: </span>
              <span className="font-mono">{io.notInGrafcet.join(', ')}</span>
            </p>
          )}
          {io.manual.length > 0 && (
            <p className="text-slate-600">
              <span className="font-medium">Entradas que se cambian a mano</span> (en el panel de simulación):{' '}
              <span className="font-mono">{io.manual.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Properties({ element, variables, onChange, onDelete, onRotate, onCreateVariable, onMoveInDesk }) {
  const names = (dir) =>
    variables
      .filter((v) =>
        dir === 'any' ? true : dir === 'analog' ? v.type === 'analogIn' : dir === 'out' ? v.type === 'output' || v.type === 'memory' : v.type === 'input',
      )
      .map((v) => v.name)
  const set = (patch) => onChange({ ...element, ...patch })
  const field = 'w-full rounded border border-slate-300 px-1 py-0.5'
  const number = (key, label, min, step = 1) => (
    <label className="block">
      <span className="text-slate-500">{label}</span>
      <input type="number" min={min} step={step} value={element[key]} onChange={(ev) => set({ [key]: Number(ev.target.value) || min })} className={field} />
    </label>
  )
  return (
    <div className="space-y-2 text-xs" aria-label="Propiedades del elemento">
      <div className="flex items-center gap-1">
        <span className="font-semibold">{SCENE_TYPES[element.type].label}</span>
        <span className="ml-auto" />
        <button type="button" onClick={onRotate} title="Girar 90° (R)" className="rounded p-1 hover:bg-slate-100">
          <RotateCw size={14} />
        </button>
        <button type="button" onClick={onDelete} title="Borrar (Supr)" className="rounded p-1 hover:bg-red-500 hover:text-white">
          <Trash2 size={14} />
        </button>
      </div>
      {(SCENE_VARS[element.type] ?? []).map(([key, label, dir]) => (
        <VariableField
          // Con el valor en la clave: al cambiar desde fuera (deshacer…), el campo empieza de nuevo.
          key={`${element.id}-${key}-${element[key] ?? ''}`}
          label={label}
          value={element[key]}
          options={names(dir)}
          allNames={variables.map((v) => v.name)}
          dir={dir}
          onPick={(name) => set({ [key]: name })}
          onCreate={onCreateVariable}
        />
      ))}
      {DESK_TYPES.includes(element.type) && (
        <div className="flex items-end gap-1">
          <label className="block flex-1">
            <span className="text-slate-500">Ubicación</span>
            <select value={element.place === 'desk' ? 'desk' : 'machine'} onChange={(ev) => set({ place: ev.target.value })} className={field}>
              <option value="desk">En el pupitre</option>
              <option value="machine">En la máquina</option>
            </select>
          </label>
          {element.place === 'desk' && (
            <>
              <button type="button" onClick={() => onMoveInDesk(-1)} title="Mover a la izquierda en el pupitre" className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100">
                ◀
              </button>
              <button type="button" onClick={() => onMoveInDesk(1)} title="Mover a la derecha en el pupitre" className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100">
                ▶
              </button>
            </>
          )}
        </div>
      )}
      {['button', 'switch', 'limit', 'sensor'].includes(element.type) && (
        <label className="block">
          <span className="text-slate-500">Contacto</span>
          <select value={element.contact ?? 'NO'} onChange={(ev) => set({ contact: ev.target.value })} className={field}>
            <option value="NO">Normalmente abierto (NA)</option>
            <option value="NC">Normalmente cerrado (NC)</option>
          </select>
        </label>
      )}
      {(element.type === 'button' || element.type === 'lamp') && (
        <label className="block">
          <span className="text-slate-500">Color</span>
          <select value={element.color ?? 'green'} onChange={(ev) => set({ color: ev.target.value })} className={field}>
            {Object.entries(COLOR_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}
      {element.type === 'cylinder' && (
        <>
          {number('stroke', 'Carrera (px)', 20, 10)}
          {number('time', 'Tiempo de carrera (s)', 0.1, 0.1)}
        </>
      )}
      {element.type === 'conveyor' && (
        <>
          {number('length', 'Largo (px)', 60, 10)}
          {number('time', 'Tiempo de recorrido (s)', 0.2, 0.1)}
        </>
      )}
      {element.type === 'sensor' && (
        <>
          <label className="block">
            <span className="text-slate-500">Tipo de detector</span>
            <select
              value={element.kind ?? 'optical'}
              onChange={(ev) => set({ kind: ev.target.value, range: SENSOR_KINDS[ev.target.value].range })}
              className={field}
            >
              {Object.entries(SENSOR_KINDS).map(([id, k]) => (
                <option key={id} value={id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {element.kind === 'color' && (
            <label className="block">
              <span className="text-slate-500">Color que detecta</span>
              <select value={element.color ?? 'amber'} onChange={(ev) => set({ color: ev.target.value })} className={field}>
                {Object.entries(PIECE_COLORS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {number('range', 'Alcance (px)', 10, 10)}
        </>
      )}
      {element.type === 'distance' && number('range', 'Alcance (px) = valor máximo', 20, 10)}
      {element.type === 'potentiometer' && (
        <label className="block">
          <span className="text-slate-500">Posición al empezar (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="5"
            value={Math.round((Number(element.initial) || 0) * 100)}
            onChange={(ev) => set({ initial: Math.min(1, Math.max(0, Number(ev.target.value) / 100)) })}
            className={field}
          />
        </label>
      )}
      {element.type === 'heater' && (
        <>
          {number('setpoint', 'Termostato: salta a (°C)', 0, 1)}
          {number('ambient', 'Temperatura ambiente (°C)', -20, 1)}
          {number('maxTemp', 'Temperatura máxima (°C)', 30, 5)}
          {number('tau', 'Inercia: constante de tiempo (s)', 1, 1)}
        </>
      )}
      {element.type === 'tank' && (
        <>
          {number('fillTime', 'Llenado de vacío a lleno (s)', 0.5, 0.5)}
          {number('drainTime', 'Vaciado de lleno a vacío (s)', 0.5, 0.5)}
          <label className="block">
            <span className="text-slate-500">Nivel al empezar (%)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={Math.round((Number(element.initial) || 0) * 100)}
              onChange={(ev) => set({ initial: Math.min(1, Math.max(0, Number(ev.target.value) / 100)) })}
              className={field}
            />
          </label>
        </>
      )}
      {element.type === 'feeder' && (
        <>
          <label className="block">
            <span className="text-slate-500">Piezas</span>
            <select value={element.sizes ?? 'small'} onChange={(ev) => set({ sizes: ev.target.value })} className={field}>
              <option value="small">Pequeñas</option>
              <option value="large">Grandes</option>
              <option value="mixed">Alternas (pequeña, grande…)</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500">Material</span>
            <select value={element.material ?? 'plastic'} onChange={(ev) => set({ material: ev.target.value })} className={field}>
              <option value="plastic">Plástico</option>
              <option value="metal">Metal</option>
              <option value="mixed">Alterno (plástico, metal…)</option>
            </select>
          </label>
          {element.material !== 'metal' && (
            <label className="block">
              <span className="text-slate-500">Color del plástico</span>
              <select value={element.color ?? 'amber'} onChange={(ev) => set({ color: ev.target.value })} className={field}>
                {Object.entries(PIECE_COLORS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!element.trigger && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={Boolean(element.auto)} onChange={(ev) => set({ auto: ev.target.checked })} />
              Siempre una pieza esperando
            </label>
          )}
        </>
      )}
      {!['limit', 'sensor', 'distance'].includes(element.type) && (
        <label className="block">
          <span className="text-slate-500">Rótulo</span>
          <input value={element.text ?? ''} onChange={(ev) => set({ text: ev.target.value })} placeholder="(el nombre de la variable)" className={field} />
        </label>
      )}
    </div>
  )
}

function Faults({ element, fault, onAction }) {
  const options = sceneFaults(element)
  return (
    <div className="space-y-2 text-xs" aria-label="Averías del elemento">
      <p className="font-semibold">{labelOf(element)}</p>
      {options.length ? (
        <label className="block">
          <span className="text-slate-500">Avería (solo en esta simulación)</span>
          <select
            value={fault ?? ''}
            onChange={(ev) => onAction(element.id, `fault:${ev.target.value}`)}
            aria-label={`Avería de ${labelOf(element)}`}
            className={`w-full rounded border px-1 py-0.5 ${fault ? 'border-red-400 text-red-700' : 'border-slate-300'}`}
          >
            <option value="">Ninguna</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-slate-500">Este elemento no tiene averías.</p>
      )}
      <p className="text-[11px] text-slate-500">Mira en «Qué espera el grafcet» cómo reacciona el programa.</p>
    </div>
  )
}

// --- Vista ---------------------------------------------------------------------------------

// Ancho de la planta en la vista dividida (se recuerda en este navegador).
const WIDTH_KEY = 'grafcet-editor:scene-width'
const MIN_WIDTH = 320
const loadWidth = () => {
  try {
    const w = Number(localStorage.getItem(WIDTH_KEY))
    return w >= MIN_WIDTH ? w : null
  } catch {
    return null
  }
}
const saveWidth = (w) => {
  try {
    localStorage.setItem(WIDTH_KEY, String(Math.round(w)))
  } catch {
    /* sin almacenamiento */
  }
}
const ZOOM_MIN = 0.3
const ZOOM_MAX = 2
const FIT_MARGIN = 30

const HISTORY_LIMIT = 100

let created = 0
const newId = () => `e${Date.now().toString(36)}${(created++).toString(36)}`
// Vista previa de la paleta: el módulo «en acción» y para qué sirve.
const HINTS = {
  button: 'Pulsador: da 1 mientras lo mantienes pulsado (o 0 si es NC). Para Marcha, Paro, Rearme…',
  switch: 'Interruptor: se queda en la posición elegida. Para selectores Manual/Automático, pieza colocada…',
  emergency: 'Seta de emergencia: contacto NC enclavado; al pulsarla da 0 hasta que se rearma.',
  lamp: 'Piloto: se enciende con una salida del grafcet.',
  cylinder: 'Cilindro: sale con A+ y entra con A− (o con muelle). Lleva detectores a0/a1 o pisa finales de carrera; empuja las piezas.',
  conveyor: 'Cinta: con su motor en marcha lleva las piezas que tiene encima.',
  limit: 'Final de carrera: se acciona cuando lo pisa el vástago de un cilindro o una pieza.',
  'sensor:optical': 'Detector óptico (réflex): su haz ve cualquier pieza (y los vástagos) que pase por delante.',
  'sensor:inductive': 'Detector inductivo: solo detecta metal y a poca distancia. Para separar piezas de metal de las de plástico.',
  'sensor:capacitive': 'Detector capacitivo: detecta cualquier material (plástico, metal…) a poca distancia.',
  'sensor:color': 'Detector de color: solo da 1 con piezas del color elegido. Para clasificar por colores.',
  distance: 'Sensor de distancia (ultrasonidos): valor analógico proporcional a la distancia al primer objeto de su haz.',
  scale: 'Báscula: valor analógico con el peso (kg) de las piezas que tiene encima; el metal pesa el triple.',
  potentiometer: 'Potenciómetro: entrada analógica manual (consignas, velocidades…). En modo Usar, arrastra a izquierda o derecha.',
  heater: 'Calentador: la resistencia sube la temperatura (analógica, °C) con inercia; termostato digital opcional.',
  feeder: 'Alimentador: suelta piezas solo, con una salida del grafcet o al pulsarlo en modo Usar.',
  sink: 'Recogida: retira y cuenta las piezas que caen dentro.',
  tank: 'Depósito: se llena y vacía con sus válvulas; sensores de nivel bajo y alto y nivel analógico.',
  motor: 'Motor: gira mientras su salida está activa (al revés con la salida de giro inverso).',
  display: 'Visualizador: muestra el valor de una variable (contador, analógica…).',
}
const PREVIEW_DELAY = 450

// Dibujo de muestra de un módulo (con sus valores por defecto y «en marcha»).
function ModulePreview({ item }) {
  const { type } = item
  const e = { id: 'preview', type, x: 0, y: 0, rot: 0, ...SCENE_TYPES[type].defaults, ...item.preset }
  const demo = { motor: 'M', variable: 'V', extend: 'E', fill: 'F', high: 'H', low: 'L' }
  const values = { M: 1, V: 1, E: 1, F: 1 }
  const shapes = {
    button: <ButtonShape e={e} pressed={false} />,
    switch: <SwitchShape pressed />,
    emergency: <EmergencyShape pressed={false} />,
    lamp: <LampShape e={e} lit />,
    cylinder: <CylinderShape e={{ ...e, ...demo, retracted: 'a0', extended: 'a1' }} pos={0.6} values={values} />,
    conveyor: <ConveyorShape e={{ ...e, length: 160 }} running t={0} />,
    limit: <LimitShape active />,
    sensor: <SensorShape e={e} active />,
    feeder: <FeederShape />,
    sink: <SinkShape count={3} />,
    tank: <TankShape e={{ ...e, ...demo }} level={0.55} values={values} />,
    motor: <MotorShape angle={20} running />,
    display: <DisplayShape value={42} />,
    distance: <DistanceShape e={{ ...e, range: 120 }} distance={70} />,
    scale: <ScaleShape kg={3} />,
    potentiometer: <PotentiometerShape value={0.65} />,
    heater: <HeaterShape e={e} temp={85} heating />,
  }
  const b = boundsOf(type === 'conveyor' ? { ...e, length: 160 } : type === 'distance' ? { ...e, range: 120 } : e, 1)
  const pad = 12
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} className="mx-auto block max-h-28 w-full" aria-hidden="true">
      {shapes[type]}
      {type === 'conveyor' && <rect x="40" y="-28" width="28" height="28" rx="3" fill={COLORS.amber} stroke={INK} />}
      {type === 'feeder' && <rect x="-14" y="-14" width="28" height="28" rx="3" fill={COLORS.amber} stroke={INK} />}
      {type === 'sensor' && <PieceShape p={{ id: 0, x: 22, y: -14, w: 28, h: 28, color: item.preset.kind === 'inductive' ? 'metal' : 'amber', material: item.preset.kind === 'inductive' ? 'metal' : 'plastic' }} />}
      {type === 'distance' && <rect x="82" y="-14" width="28" height="28" rx="3" fill={COLORS.amber} stroke={INK} />}
      {type === 'scale' && <rect x="-14" y="-36" width="28" height="28" rx="3" fill={COLORS.amber} stroke={INK} />}
    </svg>
  )
}

// Paleta: un módulo por tipo; los detectores de presencia, uno por tipo de detección.
const SENSOR_PALETTE = { optical: 'Detector óptico', inductive: 'Detector inductivo', capacitive: 'Detector capacitivo', color: 'Detector de color' }
const PALETTE_ITEMS = Object.entries(SCENE_TYPES).flatMap(([type, t]) =>
  type === 'sensor'
    ? Object.entries(SENSOR_KINDS).map(([kind, k]) => ({
        key: `sensor:${kind}`,
        type,
        group: t.group,
        label: SENSOR_PALETTE[kind],
        preset: { kind, range: k.range },
      }))
    : [{ key: type, type, group: t.group, label: t.label, preset: {} }],
)
const PALETTE = PALETTE_ITEMS.reduce((groups, item) => ({ ...groups, [item.group]: [...(groups[item.group] ?? []), item] }), {})
// Pupitre de mando: los mandos y la señalización pueden ir en un panel fijo, aparte del
// mecanismo (como el cuadro eléctrico real). e.place: 'desk' | 'machine' (por defecto, máquina).
const DESK_TYPES = ['button', 'switch', 'emergency', 'potentiometer', 'lamp', 'display']
const isDesk = (e) => DESK_TYPES.includes(e.type) && e.place === 'desk'

// Arrastrar un módulo de la paleta a la escena (tipo de dato propio del arrastre).
const DRAG_TYPE = 'application/x-grafcet-scene'
const PALETTE_BY_KEY = Object.fromEntries(PALETTE_ITEMS.map((i) => [i.key, i]))

// Planta virtual en escena (lib/sim/scene.js), al estilo de PC_SIMU: se colocan los elementos
// libremente, se les asignan las variables y, al simular, interactúan (el vástago pisa los finales
// de carrera, las cintas llevan las piezas, los cilindros las empujan…). Modo «Editar» para
// colocar y configurar; modo «Usar» para accionar los mandos.
// onHistory({ canUndo, canRedo, undo, redo, copy, cut, paste, duplicate, selectAll, remove } | null): en
// modo Editar, los botones y atajos de edición de siempre (deshacer, rehacer, copiar, pegar…)
// actúan sobre la escena, con su propio historial.
// onCreateVariable(name, type): añade una variable nueva a la tabla (escrita en un elemento).
export default function SceneView({ scene, onChange, worldState, values, time, variables, onAction, onHistory, onCreateVariable, maximized, onToggleMaximize, onClose }) {
  const elements = scene?.elements ?? []
  const [mode, setMode] = useState('use')
  // Selección: ids de los elementos (Ctrl+clic añade o quita; recuadro con el ratón).
  const [selection, setSelection] = useState([])
  const selected = selection.length === 1 ? selection[0] : null
  const setSelected = (id) => setSelection(id ? [id] : [])
  const [zoom, setZoom] = useState(0.8)
  const [drag, setDrag] = useState(null) // { ids, start: { x, y }, dx, dy }
  const [marquee, setMarquee] = useState(null) // { x0, y0, x1, y1, add }
  const [showIO, setShowIO] = useState(false) // rótulos con las variables y sus direcciones
  const [ioOpen, setIoOpen] = useState(false) // panel de conexiones
  const [panning, setPanning] = useState(null) // { x, y, left, top }: arrastre con la rueda pulsada
  // Deshacer / rehacer de la escena (aparte del historial del grafcet).
  const history = useRef({ past: [], future: [] })
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 }) // para los botones
  const svgRef = useRef(null)
  const scrollRef = useRef(null)
  const sectionRef = useRef(null)
  const [width, setWidth] = useState(loadWidth)
  const resizing = useRef(null)
  const [fitTick, setFitTick] = useState(0) // se reajusta al terminar de arrastrar el separador
  // Vista previa flotante de un módulo de la paleta (junto al ratón, tras un momento encima).
  const [preview, setPreview] = useState(null)
  const previewTimer = useRef(null)
  useEffect(() => () => clearTimeout(previewTimer.current), [])

  // Ajustar: zoom y desplazamiento para ver todos los elementos (y las piezas), con margen.
  const pendingScroll = useRef(null)
  const fit = useCallback(() => {
    const el = scrollRef.current
    const list = (scene?.elements ?? []).filter((e) => !isDesk(e))
    if (!el || !list.length) return
    const boxes = list.map((e) => boundsOf(e, 1))
    // Hueco para los rótulos, debajo de cada elemento.
    const minX = Math.max(0, Math.min(...boxes.map((b) => b.x)) - FIT_MARGIN)
    const minY = Math.max(0, Math.min(...boxes.map((b) => b.y)) - FIT_MARGIN)
    const maxX = Math.min(W, Math.max(...boxes.map((b) => b.x + b.w)) + FIT_MARGIN)
    const maxY = Math.min(H, Math.max(...boxes.map((b) => b.y + b.h + 16)) + FIT_MARGIN)
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY))))
    const zoomed = Math.floor(z * 100) / 100
    // Centrado en lo que se ve (el desplazamiento se aplica cuando el SVG ya tiene el nuevo tamaño).
    pendingScroll.current = {
      left: ((minX + maxX) / 2) * zoomed - el.clientWidth / 2,
      top: ((minY + maxY) / 2) * zoomed - el.clientHeight / 2,
    }
    setZoom(zoomed)
  }, [scene])
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !pendingScroll.current) return
    el.scrollLeft = Math.max(0, pendingScroll.current.left)
    el.scrollTop = Math.max(0, pendingScroll.current.top)
    pendingScroll.current = null
  })
  // Rueda del ratón: zoom centrado en el puntero (como en el lienzo del grafcet). Escucha no
  // pasiva para poder evitar el desplazamiento normal de la página.
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (ev) => {
      ev.preventDefault()
      const current = zoomRef.current
      const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, current * Math.exp(-ev.deltaY * 0.0015))) * 100) / 100
      if (next === current) return
      const rect = el.getBoundingClientRect()
      const ox = ev.clientX - rect.left
      const oy = ev.clientY - rect.top
      // El punto de la escena bajo el puntero se queda bajo el puntero.
      const px = (el.scrollLeft + ox) / current
      const py = (el.scrollTop + oy) / current
      pendingScroll.current = { left: px * next - ox, top: py * next - oy }
      zoomRef.current = next
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Ajuste automático al abrir, al soltar el separador y al pasar a pantalla completa o volver.
  const fitRef = useRef(fit)
  useEffect(() => {
    fitRef.current = fit
  })
  useEffect(() => {
    const id = requestAnimationFrame(() => fitRef.current())
    return () => cancelAnimationFrame(id)
  }, [maximized, fitTick])
  const state = worldState ?? { pos: {}, pressed: {}, pieces: [], counts: {} }
  const signals = sceneSignals(scene ?? { elements: [] }, state)
  const selectedElement = elements.find((e) => e.id === selected)
  const detected = mode === 'edit' ? detectScene(variables, scene) : []
  const io = sceneIO(scene, variables)
  const ioWarnings = io.unassigned.length + io.unusedOutputs.length + io.notInGrafcet.length
  const addressOf = new Map(variables.map((v) => [v.name, v.address]))
  // Líneas extra del rótulo (con «E/S»): cada variable del elemento con su dirección, de dos en dos
  // (un cilindro con cuatro variables no se sale de la escena).
  const ioLines = (e) => {
    const items = (SCENE_VARS[e.type] ?? [])
      .map(([key]) => e[key])
      .filter(Boolean)
      .map((name) => (addressOf.get(name) ? `${name} ${addressOf.get(name)}` : name))
    const lines = []
    for (let i = 0; i < items.length; i += 2) lines.push(items.slice(i, i + 2).join(' · '))
    return lines
  }

  // Cada cambio de la escena se guarda en el historial (deshacer / rehacer).
  const save = (list) => {
    const h = history.current
    h.past = [...h.past.slice(-(HISTORY_LIMIT - 1)), elements]
    h.future = []
    setHistorySize({ past: h.past.length, future: 0 })
    onChange({ ...(scene ?? {}), elements: list })
  }
  const travel = (from, to) => {
    const h = history.current
    if (!h[from].length) return
    h[to] = [...h[to], elements]
    const list = h[from][h[from].length - 1]
    h[from] = h[from].slice(0, -1)
    setHistorySize({ past: h.past.length, future: h.future.length })
    onChange({ ...(scene ?? {}), elements: list })
    setSelection((ids) => ids.filter((id) => list.some((e) => e.id === id)))
  }
  const undo = () => travel('past', 'future')
  const redo = () => travel('future', 'past')
  const update = (element) => save(elements.map((e) => (e.id === element.id ? element : e)))
  const removeSelected = () => {
    if (!selection.length) return
    save(elements.filter((e) => !selection.includes(e.id)))
    setSelection([])
  }
  const remove = (id) => {
    save(elements.filter((e) => e.id !== id))
    setSelection([])
  }
  const rotateSelected = () =>
    selection.length && save(elements.map((e) => (selection.includes(e.id) ? { ...e, rot: ((e.rot ?? 0) + 90) % 360 } : e)))
  const copySelected = () => {
    if (!selection.length) return
    copyToClipboard(elements.filter((e) => selection.includes(e.id)))
  }
  // Pegar: copias nuevas, desplazadas (cada pegado un poco más) y seleccionadas.
  const paste = () => {
    const copies = pasteFromClipboard().map((e) => ({ ...e, id: newId() }))
    if (!copies.length) return
    save([...elements, ...copies])
    setSelection(copies.map((e) => e.id))
  }
  const duplicate = () => {
    copySelected()
    paste()
  }

  // Para la barra del editor: funciones estables que llaman a las de este momento.
  const latest = useRef({})
  useEffect(() => {
    latest.current = {
      undo,
      redo,
      copy: copySelected,
      cut: () => {
        copySelected()
        removeSelected()
      },
      paste,
      duplicate,
      selectAll: () => setSelection(elements.map((e) => e.id)),
      remove: removeSelected,
    }
  })
  useEffect(() => {
    if (!onHistory) return
    onHistory(
      mode === 'edit'
        ? {
            canUndo: historySize.past > 0,
            canRedo: historySize.future > 0,
            ...Object.fromEntries(['undo', 'redo', 'copy', 'cut', 'paste', 'duplicate', 'selectAll', 'remove'].map((k) => [k, () => latest.current[k]()])),
          }
        : null,
    )
  }, [mode, historySize, onHistory])
  useEffect(() => () => onHistory?.(null), [onHistory])

  // Teclado de la escena (solo con el foco en ella, para no mezclarse con los atajos del grafcet).
  const onKeyDown = (ev) => {
    if (mode !== 'edit' || ['INPUT', 'SELECT', 'TEXTAREA'].includes(ev.target.tagName)) return
    const ctrl = ev.ctrlKey || ev.metaKey
    const key = ev.key.toLowerCase()
    const actions = {
      r: !ctrl && rotateSelected,
      delete: removeSelected,
      backspace: removeSelected,
      escape: () => setSelection([]),
    }
    const action = actions[key]
    if (!action) return
    ev.preventDefault()
    ev.stopPropagation()
    action()
  }

  // Nuevo elemento en el centro de lo que se ve.
  // Nuevo elemento: donde se suelta al arrastrarlo desde la paleta o, con un clic, en el centro
  // de lo que se ve.
  // Mandos y señalización: con un clic (o soltados en el pupitre) van al pupitre; soltados en la
  // escena, a la máquina.
  const add = (type, preset = {}, at = null, place = null) => {
    const el = scrollRef.current
    const x = snap(at ? at.x : el ? (el.scrollLeft + el.clientWidth / 2) / zoom : W / 2)
    const y = snap(at ? at.y : el ? (el.scrollTop + el.clientHeight / 2) / zoom : H / 2)
    const where = place ?? (DESK_TYPES.includes(type) && !at ? 'desk' : null)
    const element = { id: newId(), type, x, y, rot: 0, ...SCENE_TYPES[type].defaults, ...preset, ...(where ? { place: where } : {}) }
    save([...elements, element])
    setSelected(element.id)
    setMode('edit')
  }

  const toScene = (ev) => {
    const point = svgRef.current.createSVGPoint()
    point.x = ev.clientX
    point.y = ev.clientY
    const p = point.matrixTransform(svgRef.current.getScreenCTM().inverse())
    return { x: p.x, y: p.y }
  }

  // Orden en el pupitre: intercambia el elemento con el anterior o el siguiente del pupitre.
  const moveInDesk = (id, dir) => {
    const desk = elements.filter(isDesk)
    const i = desk.findIndex((e) => e.id === id)
    const other = desk[i + dir]
    if (!other) return
    const a = elements.findIndex((e) => e.id === id)
    const b = elements.findIndex((e) => e.id === other.id)
    const list = [...elements]
    ;[list[a], list[b]] = [list[b], list[a]]
    save(list)
  }

  // Pupitre: los mismos mandos que en la escena, en celdas fijas (el potenciómetro, por la
  // posición del ratón en su celda).
  const [deskKnob, setDeskKnob] = useState(null)
  const turnDeskKnob = (ev, e) => {
    const r = ev.currentTarget.getBoundingClientRect()
    onAction(e.id, `set:${Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))}`)
  }
  const onDeskDown = (ev, e) => {
    ev.stopPropagation()
    sectionRef.current?.focus({ preventScroll: true })
    if (mode === 'use') {
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      if (e.type === 'potentiometer') {
        setDeskKnob(e.id)
        turnDeskKnob(ev, e)
      } else if (operable(e)) operate(e, 'down')
      else setSelected(e.id)
      return
    }
    if (ev.ctrlKey || ev.metaKey) setSelection((ids) => (ids.includes(e.id) ? ids.filter((id) => id !== e.id) : [...ids, e.id]))
    else setSelection([e.id])
  }
  const onDeskUp = (e) => {
    if (mode !== 'use') return
    setDeskKnob(null)
    operate(e, 'up')
  }

  // Potenciómetro: la posición del ratón respecto al mando (de −30 a +30 px) es el valor.
  const [knobDrag, setKnobDrag] = useState(null)
  const turnKnob = (ev, e) => onAction(e.id, `set:${Math.min(1, Math.max(0, (toScene(ev).x - e.x + 30) / 60))}`)

  // Accionar un mando (modo «Usar»).
  const operate = (e, phase) => {
    if (e.type === 'button') onAction(e.id, phase === 'down' ? 'press' : 'release')
    else if (phase === 'down' && (e.type === 'switch' || e.type === 'emergency')) onAction(e.id, 'toggle')
    else if (phase === 'down' && e.type === 'feeder') onAction(e.id, 'feed')
  }

  const onPointerDown = (ev, e) => {
    ev.stopPropagation()
    sectionRef.current?.focus({ preventScroll: true })
    if (mode === 'use') {
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      if (e.type === 'potentiometer') {
        setKnobDrag(e)
        turnKnob(ev, e)
      } else if (operable(e)) operate(e, 'down')
      else setSelected(e.id)
      return
    }
    // Ctrl+clic: añade o quita de la selección (sin mover).
    if (ev.ctrlKey || ev.metaKey) {
      setSelection((ids) => (ids.includes(e.id) ? ids.filter((id) => id !== e.id) : [...ids, e.id]))
      return
    }
    // Arrastrar un elemento seleccionado mueve toda la selección.
    const ids = selection.includes(e.id) ? selection : [e.id]
    if (!selection.includes(e.id)) setSelection([e.id])
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    setDrag({ ids, start: toScene(ev), dx: 0, dy: 0 })
  }
  const onPointerMove = (ev) => {
    if (knobDrag) turnKnob(ev, knobDrag)
    if (marquee) {
      const p = toScene(ev)
      setMarquee({ ...marquee, x1: p.x, y1: p.y })
    }
    if (!drag) return
    const p = toScene(ev)
    setDrag({ ...drag, dx: snap(p.x - drag.start.x), dy: snap(p.y - drag.start.y) })
  }
  // Recuadro de selección sobre el fondo (modo Editar).
  const onBackgroundDown = (ev) => {
    sectionRef.current?.focus({ preventScroll: true })
    if (mode !== 'edit') {
      setSelection([])
      return
    }
    const p = toScene(ev)
    const add = ev.ctrlKey || ev.metaKey
    if (!add) setSelection([])
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, add })
  }
  const onBackgroundUp = () => {
    if (!marquee) return
    const box = { x: Math.min(marquee.x0, marquee.x1), y: Math.min(marquee.y0, marquee.y1), w: Math.abs(marquee.x1 - marquee.x0), h: Math.abs(marquee.y1 - marquee.y0) }
    setMarquee(null)
    if (box.w < 4 && box.h < 4) return
    const hit = elements.filter((e) => !isDesk(e) && overlaps(box, boundsOf(e, state.pos[e.id] ?? 0))).map((e) => e.id)
    setSelection((ids) => (marquee.add ? [...new Set([...ids, ...hit])] : hit))
  }
  const onPointerUp = (ev, e) => {
    if (mode === 'use') {
      setKnobDrag(null)
      operate(e, 'up')
      return
    }
    if (drag) {
      if (drag.dx || drag.dy) save(elements.map((x) => (drag.ids.includes(x.id) ? { ...x, x: x.x + drag.dx, y: x.y + drag.dy } : x)))
      setDrag(null)
    }
  }

  const shown = elements.map((e) => (drag?.ids.includes(e.id) ? { ...e, x: e.x + drag.dx, y: e.y + drag.dy } : e))
  const machine = shown.filter((e) => !isDesk(e))
  const deskItems = elements.filter(isDesk)
  const draw = (e) => {
    const pos = state.pos[e.id] ?? 0
    switch (e.type) {
      case 'button':
        return <ButtonShape e={e} pressed={signals[e.id]} />
      case 'switch':
        return <SwitchShape pressed={signals[e.id]} />
      case 'emergency':
        return <EmergencyShape pressed={signals[e.id]} />
      case 'lamp':
        return <LampShape e={e} lit={isOn(values, e.variable)} />
      case 'cylinder':
        return <CylinderShape e={e} pos={pos} values={values} />
      case 'conveyor':
        return <ConveyorShape e={e} running={isOn(values, e.motor)} t={time} />
      case 'limit':
        return <LimitShape active={signals[e.id]} />
      case 'sensor':
        return <SensorShape e={e} active={signals[e.id]} />
      case 'feeder':
        return <FeederShape />
      case 'sink':
        return <SinkShape count={state.counts[e.id] ?? 0} />
      case 'tank':
        return <TankShape e={e} level={state.level?.[e.id] ?? (Number(e.initial) || 0)} values={values} />
      case 'motor':
        return <MotorShape angle={state.angle?.[e.id] ?? 0} running={isOn(values, e.variable)} />
      case 'display':
        return <DisplayShape value={values[e.variable]} />
      case 'distance':
        return <DistanceShape e={e} distance={measuredDistance(scene, state, e)} />
      case 'scale':
        return <ScaleShape kg={weighed(state, e)} />
      case 'potentiometer':
        return <PotentiometerShape value={state.knob?.[e.id] ?? Number(e.initial ?? 0.5)} />
      case 'heater':
        return <HeaterShape e={e} temp={state.temp?.[e.id] ?? Number(e.ambient ?? 20)} heating={isOn(values, e.heat)} />
      default:
        return null
    }
  }
  // Los mandos y pilotos no se giran (su rótulo se lee siempre).
  const turns = (e) => !['button', 'switch', 'emergency', 'lamp', 'sink', 'feeder', 'tank', 'motor', 'display', 'scale', 'potentiometer', 'heater'].includes(e.type)
  const operable = (e) => ['button', 'switch', 'emergency', 'feeder', 'potentiometer'].includes(e.type)

  return (
    <section
      aria-label="Escena de la planta"
      ref={sectionRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`side-panel relative flex outline-none min-w-0 flex-col border-l border-slate-200 bg-white ${maximized ? 'absolute inset-y-0 left-0 right-80 z-20' : 'shrink-0'}`}
      style={maximized ? undefined : { width: width ?? '50%' }}
    >
      {/* Separador: arrastrar para repartir el espacio entre el grafcet y la planta. */}
      {!maximized && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ancho de la planta"
          title="Arrastra para cambiar el ancho de la planta (doble clic: mitad y mitad)"
          className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-blue-400/40"
          onPointerDown={(ev) => {
            const right = sectionRef.current.getBoundingClientRect().right
            const total = sectionRef.current.parentElement.getBoundingClientRect().width
            resizing.current = { right, max: total - 320 - MIN_WIDTH, frame: 0, width: null }
            ev.currentTarget.setPointerCapture(ev.pointerId)
          }}
          onPointerMove={(ev) => {
            const r = resizing.current
            if (!r) return
            r.width = Math.round(Math.min(Math.max(MIN_WIDTH, r.right - ev.clientX), Math.max(MIN_WIDTH, r.max)))
            // Un cambio por fotograma (el lienzo del grafcet se redimensiona con él).
            if (!r.frame) {
              r.frame = requestAnimationFrame(() => {
                r.frame = 0
                setWidth(r.width)
              })
            }
          }}
          onPointerUp={() => {
            const r = resizing.current
            resizing.current = null
            if (!r?.width) return
            cancelAnimationFrame(r.frame)
            setWidth(r.width)
            saveWidth(r.width)
            setFitTick((t) => t + 1)
          }}
          onDoubleClick={() => {
            setWidth(null)
            saveWidth(0)
            setFitTick((t) => t + 1)
          }}
        />
      )}
      <header className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-xs">
        <span className="mr-1 text-sm font-semibold">Planta</span>
        <div className="flex rounded-md border border-slate-300 p-0.5" role="radiogroup" aria-label="Modo de la escena">
          {[
            ['use', 'Usar', Hand, 'Accionar pulsadores, interruptores y alimentadores'],
            ['edit', 'Editar', MousePointer2, 'Colocar, mover y configurar elementos'],
          ].map(([id, label, Icon, title]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              title={title}
              onClick={() => {
                setMode(id)
                setSelected(null)
              }}
              className={`flex items-center gap-1 rounded px-2 py-0.5 ${mode === id ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowIO((v) => !v)}
          aria-pressed={showIO}
          title="Rótulos con las variables y sus direcciones"
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${showIO ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
        >
          <Tag size={12} /> E/S
        </button>
        <button
          type="button"
          onClick={() => setIoOpen((v) => !v)}
          aria-pressed={ioOpen}
          title="Qué está conectado y qué falta"
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${ioOpen ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
        >
          <Cable size={12} /> Conexiones
          {ioWarnings > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{ioWarnings}</span>}
        </button>
        <button type="button" onClick={() => onAction(null, 'clear')} title="Quita de la escena todas las piezas (cilindros, cintas y demás elementos se quedan)" className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
          Quitar piezas
        </button>
        <span className="ml-auto" />
        <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))} title="Alejar" className="rounded p-1 hover:bg-slate-100">
          <Minus size={13} />
        </button>
        <span className="w-11 text-center tabular-nums whitespace-nowrap">{Math.round(zoom * 100)} %</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))} title="Acercar" className="rounded p-1 hover:bg-slate-100">
          <Plus size={13} />
        </button>
        <button type="button" onClick={fit} title="Ajustar: ver todos los mandos y el mecanismo" aria-label="Ajustar la vista" className="rounded p-1 hover:bg-slate-100">
          <Scan size={14} />
        </button>
        <button type="button" onClick={onToggleMaximize} title={maximized ? 'Vista dividida con el grafcet' : 'Pantalla completa'} className="rounded p-1 hover:bg-slate-100">
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button type="button" onClick={onClose} title="Cerrar la planta" className="rounded p-1 hover:bg-slate-100">
          <X size={14} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && (
          <nav className="w-32 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 p-1.5 text-xs" aria-label="Elementos">
            {detected.length > 0 && (
              <button
                type="button"
                onClick={() => save([...elements, ...detected])}
                title="A partir de los nombres de las variables: cada salida A+ con A−, a0 y a1 es un cilindro"
                className="flex w-full items-center gap-1 rounded border border-blue-300 bg-blue-50 px-1 py-0.5 text-left text-blue-800 hover:bg-blue-100"
              >
                <WandSparkles size={12} className="shrink-0" /> Detectar cilindros ({detected.length})
              </button>
            )}
            {Object.entries(PALETTE).map(([group, types]) => (
              <div key={group}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{group}</p>
                {types.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                      add(item.type, item.preset)
                    }}
                    onMouseEnter={(ev) => {
                      const at = { x: ev.clientX, y: ev.clientY }
                      clearTimeout(previewTimer.current)
                      previewTimer.current = setTimeout(() => setPreview({ key: item.key, ...at }), PREVIEW_DELAY)
                    }}
                    onMouseMove={(ev) => setPreview((p) => (p ? { ...p, x: ev.clientX, y: ev.clientY } : p))}
                    draggable
                    onDragStart={(ev) => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                      ev.dataTransfer.setData(DRAG_TYPE, item.key)
                      ev.dataTransfer.effectAllowed = 'copy'
                    }}
                    title="Arrastra a la escena (o pulsa para ponerlo en el centro)"
                    onMouseLeave={() => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                    }}
                    className="block w-full rounded px-1 py-0.5 text-left hover:bg-blue-50"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className={`paper min-h-0 min-w-0 flex-1 overflow-auto ${panning ? 'cursor-grabbing' : ''}`}
          // Rueda pulsada y arrastrar: desplazar la vista (como en el lienzo del grafcet), también
          // empezando encima de un elemento.
          onPointerDownCapture={(ev) => {
            if (ev.button !== 1) return
            ev.preventDefault()
            ev.stopPropagation()
            const el = scrollRef.current
            ev.currentTarget.setPointerCapture(ev.pointerId)
            setPanning({ x: ev.clientX, y: ev.clientY, left: el.scrollLeft, top: el.scrollTop })
          }}
          onPointerMoveCapture={(ev) => {
            if (!panning) return
            ev.stopPropagation()
            scrollRef.current.scrollLeft = panning.left - (ev.clientX - panning.x)
            scrollRef.current.scrollTop = panning.top - (ev.clientY - panning.y)
          }}
          onPointerUpCapture={(ev) => {
            if (!panning) return
            ev.stopPropagation()
            setPanning(null)
          }}
          // Sin el desplazamiento automático del navegador con la rueda pulsada.
          onMouseDown={(ev) => ev.button === 1 && ev.preventDefault()}
          onDragOver={(ev) => {
            if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return
            ev.preventDefault()
            ev.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(ev) => {
            const item = PALETTE_BY_KEY[ev.dataTransfer.getData(DRAG_TYPE)]
            if (!item) return
            ev.preventDefault()
            add(item.type, item.preset, toScene(ev))
          }}
        >
          <svg
            ref={svgRef}
            width={W * zoom}
            height={H * zoom}
            viewBox={`0 0 ${W} ${H}`}
            className="block select-none"
            onPointerMove={onPointerMove}
            onPointerDown={onBackgroundDown}
            onPointerUp={onBackgroundUp}
            role="img"
            aria-label="Escena"
          >
            <defs>
              <pattern id="scene-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="white" />
            {mode === 'edit' && <rect width={W} height={H} fill="url(#scene-grid)" />}
            {machine.length === 0 && (
              <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="16" fill="#94a3b8">
                Pulsa «Editar» y añade elementos: pulsadores, cilindros, cintas, detectores…
              </text>
            )}
            {/* Las cintas y recogidas, debajo de todo (las piezas van encima). */}
            {[...machine].sort((a, b) => (a.type === 'conveyor' || a.type === 'sink' ? -1 : 0) - (b.type === 'conveyor' || b.type === 'sink' ? -1 : 0)).map((e) => (
              <g
                key={e.id}
                data-element={e.type}
                aria-label={`${SCENE_TYPES[e.type].label} ${labelOf(e)}`}
                style={{ cursor: mode === 'edit' ? 'move' : operable(e) ? 'pointer' : 'default' }}
                onPointerDown={(ev) => onPointerDown(ev, e)}
                onPointerUp={(ev) => onPointerUp(ev, e)}
                onPointerCancel={(ev) => onPointerUp(ev, e)}
              >
                {/* Zona de clic: todo el contorno (también los huecos del dibujo). */}
                {(() => {
                  const b = boundsOf(e, state.pos[e.id] ?? 0)
                  return <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />
                })()}
                <g transform={`translate(${e.x} ${e.y})${turns(e) ? ` rotate(${e.rot ?? 0})` : ''}`}>{draw(e)}</g>
              </g>
            ))}
            {state.pieces.map((p) => (
              <PieceShape key={p.id} p={p} />
            ))}
            {/* Rótulos (sin girar) */}
            {machine.map((e) => {
              const b = boundsOf(e, state.pos[e.id] ?? 0)
              return (
                <text key={`l-${e.id}`} x={b.x + b.w / 2} y={b.y + b.h + 13} textAnchor="middle" fontSize="11" fill="#334155" pointerEvents="none">
                  {labelOf(e)}
                  {showIO &&
                    ioLines(e).map((line) => (
                      <tspan key={line} x={b.x + b.w / 2} dy="12" fontSize="9.5" fontFamily="ui-monospace, Consolas, monospace" fill="#2563eb">
                        {line}
                      </tspan>
                    ))}
                </text>
              )
            })}
            {machine
              .filter((e) => selection.includes(e.id))
              .map((e) => {
                const b = boundsOf(e, state.pos[e.id] ?? 0)
                return (
                  <rect key={`sel-${e.id}`} data-selected={e.id} x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} fill="none" stroke="#3b82f6" strokeDasharray="4 3" pointerEvents="none" />
                )
              })}
            {marquee && (
              <rect
                x={Math.min(marquee.x0, marquee.x1)}
                y={Math.min(marquee.y0, marquee.y1)}
                width={Math.abs(marquee.x1 - marquee.x0)}
                height={Math.abs(marquee.y1 - marquee.y0)}
                fill="#3b82f6"
                fillOpacity="0.08"
                stroke="#3b82f6"
                strokeDasharray="3 2"
                pointerEvents="none"
              />
            )}
          </svg>
        </div>
        {(deskItems.length > 0 || mode === 'edit') && (
          <div
            role="region"
            aria-label="Pupitre de mando"
            className="paper flex shrink-0 items-start gap-2 overflow-x-auto border-t-4 border-slate-400 bg-slate-300 px-3 py-2"
            onDragOver={(ev) => {
              if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return
              ev.preventDefault()
              ev.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(ev) => {
              const item = PALETTE_BY_KEY[ev.dataTransfer.getData(DRAG_TYPE)]
              if (!item) return
              ev.preventDefault()
              add(item.type, item.preset, null, DESK_TYPES.includes(item.type) ? 'desk' : null)
            }}
          >
            {deskItems.length === 0 && (
              <p className="py-3 text-xs text-slate-600">Pupitre de mando: arrastra aquí pulsadores, pilotos, potenciómetros…</p>
            )}
            {deskItems.map((e) => {
              const b = boundsOf({ ...e, x: 0, y: 0 })
              return (
                <div
                  key={e.id}
                  data-element={e.type}
                  data-desk=""
                  aria-label={`${SCENE_TYPES[e.type].label} ${labelOf(e)}`}
                  className={`flex w-20 shrink-0 select-none flex-col items-center rounded bg-slate-200 p-1 shadow-sm ${
                    selection.includes(e.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{ cursor: mode === 'use' && operable(e) ? 'pointer' : 'default' }}
                  onPointerDown={(ev) => onDeskDown(ev, e)}
                  onPointerMove={(ev) => deskKnob === e.id && turnDeskKnob(ev, e)}
                  onPointerUp={() => onDeskUp(e)}
                  onPointerCancel={() => onDeskUp(e)}
                >
                  <svg viewBox={`${b.x - 4} ${b.y - 4} ${b.w + 8} ${b.h + 8}`} className="h-14 w-full" aria-hidden="true">
                    {draw({ ...e, x: 0, y: 0 })}
                  </svg>
                  <span className="max-w-full truncate text-[10px] text-slate-700">{labelOf(e)}</span>
                  {showIO &&
                    ioLines(e).map((line) => (
                      <span key={line} className="max-w-full truncate font-mono text-[9px] text-blue-700">
                        {line}
                      </span>
                    ))}
                </div>
              )
            })}
          </div>
        )}
        </div>
        {mode === 'edit' && selection.length > 1 && (
          <aside className="w-48 shrink-0 space-y-2 overflow-y-auto border-l border-slate-200 p-2 text-xs" aria-label="Selección">
            <p className="font-semibold">{selection.length} elementos seleccionados</p>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={rotateSelected} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
                <RotateCw size={12} /> Girar
              </button>
              <button type="button" onClick={duplicate} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
                <Copy size={12} /> Duplicar
              </button>
              <button type="button" onClick={removeSelected} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-red-500 hover:text-white">
                <Trash2 size={12} /> Borrar
              </button>
            </div>
            <p className="text-[11px] text-slate-500">Arrastra uno de ellos para mover todo el grupo. Ctrl+clic añade o quita.</p>
          </aside>
        )}
        {ioOpen && !selectedElement && !(mode === 'edit' && selection.length > 1) && (
          <aside className="w-56 shrink-0 overflow-y-auto border-l border-slate-200 p-2">
            <IOPanel
              io={io}
              elements={elements}
              onSelect={(id) => {
                setMode('edit')
                setSelection([id])
              }}
            />
          </aside>
        )}
        {selectedElement && (
          <aside className="w-48 shrink-0 overflow-y-auto border-l border-slate-200 p-2">
            {mode === 'edit' ? (
              <Properties
                element={selectedElement}
                variables={variables}
                onChange={update}
                onDelete={() => remove(selectedElement.id)}
                onRotate={rotateSelected}
                onCreateVariable={onCreateVariable}
                onMoveInDesk={(dir) => moveInDesk(selectedElement.id, dir)}
              />
            ) : (
              <Faults element={selectedElement} fault={state.faults?.[selectedElement.id]} onAction={onAction} />
            )}
          </aside>
        )}
      </div>
      {preview && mode === 'edit' && (
        <div
          role="tooltip"
          aria-label={`Vista previa: ${PALETTE_BY_KEY[preview.key].label}`}
          className="side-panel pointer-events-none fixed z-50 w-56 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg"
          style={{ left: Math.min(preview.x + 16, window.innerWidth - 240), top: Math.min(preview.y + 12, window.innerHeight - 220) }}
        >
          <p className="mb-1 font-semibold">{PALETTE_BY_KEY[preview.key].label}</p>
          <div className="paper rounded border border-slate-100 bg-white p-1">
            <ModulePreview item={PALETTE_BY_KEY[preview.key]} />
          </div>
          <p className="mt-1 text-slate-600">{HINTS[preview.key]}</p>
        </div>
      )}
      {mode === 'edit' && (
        <p className="border-t border-slate-200 px-2 py-1 text-[11px] text-slate-500">
          Arrastra módulos a la escena o al pupitre · rueda: zoom · rueda pulsada: desplazar · Ctrl+clic o recuadro: varios · R gira · Supr borra · Ctrl+C/V/D copia, pega, duplica · deshacer y rehacer: los de siempre · asigna las variables en el panel de la derecha. Piezas de {PIECE_SIZES.small[0]} y{' '}
          {PIECE_SIZES.large[0]} px.
        </p>
      )}
    </section>
  )
}
