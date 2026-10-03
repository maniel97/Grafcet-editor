import { useEffect, useRef, useState } from 'react'
import { Hand, Maximize2, Minimize2, Minus, MousePointer2, Plus, RotateCw, Trash2, WandSparkles, X } from 'lucide-react'
import {
  PIECE_SIZES,
  SCENE_TYPES,
  SCENE_VARS,
  TANK,
  conveyorRect,
  cylinderPlate,
  detectScene,
  limitZone,
  sceneFaults,
  sceneSignals,
  sensorZone,
  sinkRect,
  worldRect,
} from '../lib/sim/scene'

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
function SensorShape({ e, active }) {
  return (
    <g>
      <rect x={10} y={-6} width={Number(e.range) || 60} height={12} fill={active ? '#ef4444' : '#94a3b8'} opacity={active ? 0.35 : 0.15} />
      <rect x="-10" y="-8" width="20" height="16" rx="3" fill="#334155" />
      <circle cx="10" cy="0" r="4" fill={active ? '#f87171' : '#64748b'} />
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
  return e.text || vars[0] || SCENE_TYPES[e.type].label
}

// --- Propiedades -------------------------------------------------------------------------------

function Properties({ element, variables, onChange, onDelete, onRotate }) {
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
        <label key={key} className="block">
          <span className="text-slate-500">{label}</span>
          <select value={element[key] ?? ''} onChange={(ev) => set({ [key]: ev.target.value })} className={field}>
            <option value="">—</option>
            {[...new Set([...names(dir), ...(element[key] ? [element[key]] : [])])].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
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
      {element.type === 'sensor' && number('range', 'Alcance (px)', 10, 10)}
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
          {!element.trigger && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={Boolean(element.auto)} onChange={(ev) => set({ auto: ev.target.checked })} />
              Siempre una pieza esperando
            </label>
          )}
        </>
      )}
      {element.type !== 'limit' && element.type !== 'sensor' && (
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

let created = 0
const newId = () => `e${Date.now().toString(36)}${(created++).toString(36)}`
const PALETTE = Object.entries(SCENE_TYPES).reduce((groups, [type, t]) => ({ ...groups, [t.group]: [...(groups[t.group] ?? []), type] }), {})

// Planta virtual en escena (lib/sim/scene.js), al estilo de PC_SIMU: se colocan los elementos
// libremente, se les asignan las variables y, al simular, interactúan (el vástago pisa los finales
// de carrera, las cintas llevan las piezas, los cilindros las empujan…). Modo «Editar» para
// colocar y configurar; modo «Usar» para accionar los mandos.
export default function SceneView({ scene, onChange, worldState, values, time, variables, onAction, maximized, onToggleMaximize, onClose }) {
  const elements = scene?.elements ?? []
  const [mode, setMode] = useState('use')
  const [selected, setSelected] = useState(null)
  const [zoom, setZoom] = useState(0.8)
  const [drag, setDrag] = useState(null) // { id, dx, dy, x, y }
  const svgRef = useRef(null)
  const scrollRef = useRef(null)
  const state = worldState ?? { pos: {}, pressed: {}, pieces: [], counts: {} }
  const signals = sceneSignals(scene ?? { elements: [] }, state)
  const selectedElement = elements.find((e) => e.id === selected)
  const detected = mode === 'edit' ? detectScene(variables, scene) : []

  const save = (list) => onChange({ ...(scene ?? {}), elements: list })
  const update = (element) => save(elements.map((e) => (e.id === element.id ? element : e)))
  const remove = (id) => {
    save(elements.filter((e) => e.id !== id))
    setSelected(null)
  }
  const rotateSelected = () => selectedElement && update({ ...selectedElement, rot: ((selectedElement.rot ?? 0) + 90) % 360 })

  // Nuevo elemento en el centro de lo que se ve.
  const add = (type) => {
    const el = scrollRef.current
    const x = snap(el ? (el.scrollLeft + el.clientWidth / 2) / zoom : W / 2)
    const y = snap(el ? (el.scrollTop + el.clientHeight / 2) / zoom : H / 2)
    const element = { id: newId(), type, x, y, rot: 0, ...SCENE_TYPES[type].defaults }
    save([...elements, element])
    setSelected(element.id)
    setMode('edit')
  }

  // Teclado en modo edición: R gira, Supr borra.
  useEffect(() => {
    if (mode !== 'edit' || !selected) return
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'r' || e.key === 'R') rotateSelected()
      if (e.key === 'Delete') remove(selected)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toScene = (ev) => {
    const point = svgRef.current.createSVGPoint()
    point.x = ev.clientX
    point.y = ev.clientY
    const p = point.matrixTransform(svgRef.current.getScreenCTM().inverse())
    return { x: p.x, y: p.y }
  }

  // Accionar un mando (modo «Usar»).
  const operate = (e, phase) => {
    if (e.type === 'button') onAction(e.id, phase === 'down' ? 'press' : 'release')
    else if (phase === 'down' && (e.type === 'switch' || e.type === 'emergency')) onAction(e.id, 'toggle')
    else if (phase === 'down' && e.type === 'feeder') onAction(e.id, 'feed')
  }

  const onPointerDown = (ev, e) => {
    ev.stopPropagation()
    if (mode === 'use') {
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      if (operable(e)) operate(e, 'down')
      else setSelected(e.id)
      return
    }
    setSelected(e.id)
    const p = toScene(ev)
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    setDrag({ id: e.id, dx: p.x - e.x, dy: p.y - e.y, x: e.x, y: e.y })
  }
  const onPointerMove = (ev) => {
    if (!drag) return
    const p = toScene(ev)
    setDrag({ ...drag, x: snap(p.x - drag.dx), y: snap(p.y - drag.dy) })
  }
  const onPointerUp = (ev, e) => {
    if (mode === 'use') {
      operate(e, 'up')
      return
    }
    if (drag) {
      const el = elements.find((x) => x.id === drag.id)
      if (el && (el.x !== drag.x || el.y !== drag.y)) update({ ...el, x: drag.x, y: drag.y })
      setDrag(null)
    }
  }

  const shown = elements.map((e) => (drag?.id === e.id ? { ...e, x: drag.x, y: drag.y } : e))
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
      default:
        return null
    }
  }
  // Los mandos y pilotos no se giran (su rótulo se lee siempre).
  const turns = (e) => !['button', 'switch', 'emergency', 'lamp', 'sink', 'feeder', 'tank', 'motor', 'display'].includes(e.type)
  const operable = (e) => ['button', 'switch', 'emergency', 'feeder'].includes(e.type)

  return (
    <section
      aria-label="Escena de la planta"
      className={`side-panel flex min-w-0 flex-col border-l border-slate-200 bg-white ${maximized ? 'absolute inset-y-0 left-0 right-80 z-20' : 'w-1/2 shrink-0'}`}
    >
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
        <button type="button" onClick={() => onAction(null, 'clear')} title="Quitar todas las piezas" className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
          Vaciar piezas
        </button>
        <span className="ml-auto" />
        <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} title="Alejar" className="rounded p-1 hover:bg-slate-100">
          <Minus size={13} />
        </button>
        <span className="w-9 text-center tabular-nums">{Math.round(zoom * 100)} %</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Acercar" className="rounded p-1 hover:bg-slate-100">
          <Plus size={13} />
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
                {types.map((type) => (
                  <button key={type} type="button" onClick={() => add(type)} className="block w-full rounded px-1 py-0.5 text-left hover:bg-blue-50">
                    + {SCENE_TYPES[type].label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}
        <div ref={scrollRef} className="paper min-w-0 flex-1 overflow-auto">
          <svg
            ref={svgRef}
            width={W * zoom}
            height={H * zoom}
            viewBox={`0 0 ${W} ${H}`}
            className="block select-none"
            onPointerMove={onPointerMove}
            onPointerDown={() => setSelected(null)}
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
            {elements.length === 0 && (
              <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="16" fill="#94a3b8">
                Pulsa «Editar» y añade elementos: pulsadores, cilindros, cintas, detectores…
              </text>
            )}
            {/* Las cintas y recogidas, debajo de todo (las piezas van encima). */}
            {[...shown].sort((a, b) => (a.type === 'conveyor' || a.type === 'sink' ? -1 : 0) - (b.type === 'conveyor' || b.type === 'sink' ? -1 : 0)).map((e) => (
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
              <rect key={p.id} data-piece={p.id} x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={COLORS[p.color] ?? COLORS.amber} stroke={INK} pointerEvents="none" />
            ))}
            {/* Rótulos (sin girar) */}
            {shown.map((e) => {
              const b = boundsOf(e, state.pos[e.id] ?? 0)
              return (
                <text key={`l-${e.id}`} x={b.x + b.w / 2} y={b.y + b.h + 13} textAnchor="middle" fontSize="11" fill="#334155" pointerEvents="none">
                  {labelOf(e)}
                </text>
              )
            })}
            {selected &&
              shown
                .filter((e) => e.id === selected)
                .map((e) => {
                  const b = boundsOf(e, state.pos[e.id] ?? 0)
                  return <rect key="sel" x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} fill="none" stroke="#3b82f6" strokeDasharray="4 3" pointerEvents="none" />
                })}
          </svg>
        </div>
        {selectedElement && (
          <aside className="w-48 shrink-0 overflow-y-auto border-l border-slate-200 p-2">
            {mode === 'edit' ? (
              <Properties element={selectedElement} variables={variables} onChange={update} onDelete={() => remove(selectedElement.id)} onRotate={rotateSelected} />
            ) : (
              <Faults element={selectedElement} fault={state.faults?.[selectedElement.id]} onAction={onAction} />
            )}
          </aside>
        )}
      </div>
      {mode === 'edit' && (
        <p className="border-t border-slate-200 px-2 py-1 text-[11px] text-slate-500">
          Arrastra para mover · R gira · Supr borra · asigna las variables en el panel de la derecha. Piezas de {PIECE_SIZES.small[0]} y{' '}
          {PIECE_SIZES.large[0]} px.
        </p>
      )}
    </section>
  )
}
