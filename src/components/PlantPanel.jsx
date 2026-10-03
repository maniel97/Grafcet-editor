import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Factory, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PLANT_TYPES } from '../lib/sim/plant'

const POSITION_KEY = 'grafcet-editor:plant-panel'
const loadPosition = () => {
  try {
    const p = JSON.parse(localStorage.getItem(POSITION_KEY))
    if (Number.isFinite(p?.x) && Number.isFinite(p?.y)) return p
  } catch {
    /* sin almacenamiento */
  }
  return null
}
const savePosition = (p) => {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(p))
  } catch {
    /* sin almacenamiento */
  }
}

const ON = '#16a34a'
const OFF = '#cbd5e1'
const INK = 'currentColor'

// Campos de cada tipo: [clave, etiqueta, 'out' | 'in' | 'analog' | 'time'].
const FIELDS = {
  cylinder: [
    ['extend', 'Sale (A+)', 'out'],
    ['retract', 'Entra (A−, vacío = muelle)', 'out'],
    ['retracted', 'Final dentro (a0)', 'in'],
    ['extended', 'Final fuera (a1)', 'in'],
    ['time', 'Carrera (s)', 'time'],
  ],
  conveyor: [
    ['motor', 'Motor', 'out'],
    ['sensor', 'Sensor final', 'in'],
    ['entry', 'Sensor de entrada', 'in'],
    ['time', 'Recorrido (s)', 'time'],
  ],
  tank: [
    ['fill', 'Válvula de llenado', 'out'],
    ['drain', 'Válvula de vaciado', 'out'],
    ['low', 'Sensor nivel bajo', 'in'],
    ['high', 'Sensor nivel alto', 'in'],
    ['level', 'Nivel analógico', 'analog'],
    ['fillTime', 'Llenado (s)', 'time'],
    ['drainTime', 'Vaciado (s)', 'time'],
  ],
  lamp: [['output', 'Salida', 'out']],
}

const on = (values, name) => Boolean(name) && Number(values[name] ?? 0) !== 0
const Dot = ({ cx, cy, active, label }) => (
  <g>
    <circle cx={cx} cy={cy} r="4" fill={active ? ON : OFF} stroke={INK} strokeWidth="0.75" />
    {label && (
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize="9" fill={INK}>
        {label}
      </text>
    )}
  </g>
)

function CylinderDrawing({ e, s, values }) {
  const pos = s?.pos ?? 0
  const rod = 18 + pos * 70
  return (
    <svg viewBox="0 0 220 64" className="w-full" role="img" aria-label={`Cilindro ${e.name}: ${Math.round(pos * 100)} % fuera`}>
      <rect x="10" y="20" width="90" height="24" rx="2" fill="none" stroke={INK} strokeWidth="1.5" />
      <rect x={14 + pos * 70} y="22" width="6" height="20" fill={INK} />
      <rect x={20 + pos * 70} y="29" width={rod} height="6" fill={INK} opacity="0.7" />
      <text x="55" y="15" textAnchor="middle" fontSize="10" fontWeight="600" fill={INK}>
        {e.name}
      </text>
      <Dot cx={17} cy={54} active={pos <= 0.001} label="" />
      <text x="27" y="58" fontSize="9" fill={INK}>
        {e.retracted || '—'}
      </text>
      <Dot cx={160} cy={54} active={pos >= 0.999} />
      <text x="170" y="58" fontSize="9" fill={INK}>
        {e.extended || '—'}
      </text>
      <text x="150" y="15" fontSize="9" fill={on(values, e.extend) ? ON : INK}>
        {e.extend ? `${e.extend} ▶` : ''}
      </text>
      <text x="110" y="15" fontSize="9" fill={on(values, e.retract) ? ON : INK}>
        {e.retract ? `◀ ${e.retract}` : 'muelle'}
      </text>
    </svg>
  )
}

function ConveyorDrawing({ e, s, values }) {
  const running = on(values, e.motor)
  return (
    <svg viewBox="0 0 220 60" className="w-full" role="img" aria-label={`Cinta ${e.name}: ${s?.pieces.length ?? 0} piezas`}>
      <rect x="10" y="30" width="190" height="10" rx="5" fill="none" stroke={running ? ON : INK} strokeWidth="1.5" />
      <circle cx="15" cy="35" r="4" fill="none" stroke={INK} />
      <circle cx="195" cy="35" r="4" fill="none" stroke={INK} />
      {(s?.pieces ?? []).map((p, i) => (
        <rect key={i} x={12 + p * 170} y="16" width="14" height="14" rx="2" fill="#f59e0b" stroke={INK} strokeWidth="0.75" />
      ))}
      <text x="10" y="11" fontSize="10" fontWeight="600" fill={INK}>
        {e.name}
      </text>
      <text x="110" y="11" textAnchor="middle" fontSize="9" fill={running ? ON : INK}>
        {e.motor ? `${e.motor} ${running ? '▶' : '■'}` : ''}
      </text>
      {e.entry && <Dot cx={20} cy={52} active={(s?.pieces ?? []).some((p) => p <= 0.1)} />}
      {e.entry && (
        <text x="28" y="56" fontSize="9" fill={INK}>
          {e.entry}
        </text>
      )}
      {e.sensor && <Dot cx={180} cy={52} active={(s?.pieces ?? []).some((p) => p >= 0.85)} />}
      {e.sensor && (
        <text x="170" y="56" textAnchor="end" fontSize="9" fill={INK}>
          {e.sensor}
        </text>
      )}
    </svg>
  )
}

function TankDrawing({ e, s, values }) {
  const level = s?.level ?? 0
  return (
    <svg viewBox="0 0 220 90" className="w-full" role="img" aria-label={`Depósito ${e.name}: ${Math.round(level * 100)} %`}>
      <rect x="70" y="14" width="70" height="66" fill="none" stroke={INK} strokeWidth="1.5" />
      <rect x="71" y={15 + 64 * (1 - level)} width="68" height={64 * level} fill="#3b82f6" opacity="0.5" />
      <text x="105" y="10" textAnchor="middle" fontSize="10" fontWeight="600" fill={INK}>
        {e.name} · {Math.round(level * 100)} %
      </text>
      {e.fill && (
        <text x="10" y="22" fontSize="9" fill={on(values, e.fill) ? ON : INK}>
          ▼ {e.fill}
        </text>
      )}
      {e.drain && (
        <text x="10" y="86" fontSize="9" fill={on(values, e.drain) ? ON : INK}>
          ▼ {e.drain}
        </text>
      )}
      {e.high && <Dot cx={150} cy={15 + 64 * 0.1} active={level >= 0.9} />}
      {e.high && (
        <text x="158" y={19 + 64 * 0.1} fontSize="9" fill={INK}>
          {e.high}
        </text>
      )}
      {e.low && <Dot cx={150} cy={15 + 64 * 0.9} active={level >= 0.1} />}
      {e.low && (
        <text x="158" y={19 + 64 * 0.9} fontSize="9" fill={INK}>
          {e.low}
        </text>
      )}
      {e.level && (
        <text x="158" y="50" fontSize="9" fill={INK}>
          {e.level} = {values[e.level] ?? 0}
        </text>
      )}
    </svg>
  )
}

function LampDrawing({ e, values }) {
  const lit = on(values, e.output)
  return (
    <svg viewBox="0 0 220 34" className="w-full" role="img" aria-label={`Lámpara ${e.name}: ${lit ? 'encendida' : 'apagada'}`}>
      <circle cx="20" cy="17" r="11" fill={lit ? '#facc15' : OFF} stroke={INK} strokeWidth="1.5" />
      <text x="40" y="21" fontSize="10" fill={INK}>
        {e.name} {e.output ? `(${e.output})` : ''}
      </text>
    </svg>
  )
}

const DRAWINGS = { cylinder: CylinderDrawing, conveyor: ConveyorDrawing, tank: TankDrawing, lamp: LampDrawing }

function ElementEditor({ element, variables, onChange }) {
  const names = (kind) =>
    variables
      .filter((v) => (kind === 'out' ? v.type === 'output' || v.type === 'memory' : kind === 'analog' ? v.type === 'analogIn' : v.type === 'input'))
      .map((v) => v.name)
  return (
    <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
      <label className="col-span-2 flex items-center gap-1">
        <span className="w-14 text-slate-500">Nombre</span>
        <input value={element.name ?? ''} onChange={(e) => onChange({ ...element, name: e.target.value })} className="min-w-0 flex-1 rounded border border-slate-300 px-1" />
      </label>
      {FIELDS[element.type].map(([key, label, kind]) => (
        <label key={key} className="flex flex-col">
          <span className="text-slate-500">{label}</span>
          {kind === 'time' ? (
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={element[key]}
              onChange={(e) => onChange({ ...element, [key]: Number(e.target.value) || 0.1 })}
              className="rounded border border-slate-300 px-1"
            />
          ) : (
            <select value={element[key] ?? ''} onChange={(e) => onChange({ ...element, [key]: e.target.value })} className="rounded border border-slate-300 px-0.5">
              <option value="">—</option>
              {[...new Set([...names(kind), ...(element[key] ? [element[key]] : [])])].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
        </label>
      ))}
    </div>
  )
}

const nextName = (type, elements) => {
  if (type === 'cylinder') {
    for (const letter of 'ABCDEFGH') if (!elements.some((e) => e.name === letter)) return letter
  }
  const base = PLANT_TYPES[type].label
  let n = 1
  while (elements.some((e) => e.name === `${base} ${n}`)) n++
  return `${base} ${n}`
}

// Planta virtual (lib/sim/plant.js): panel flotante sobre el lienzo durante la simulación, con un
// dibujo animado de cada elemento y su configuración. Se arrastra por la cabecera, se pliega y
// recuerda su posición.
export default function PlantPanel({ elements, plantState, values, variables, onChange, onAction, onClose, extra }) {
  const [position, setPosition] = useState(() => loadPosition() ?? { x: Math.max(16, window.innerWidth - 360 - 300), y: 72 })
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState('cylinder')
  const drag = useRef(null)

  const update = (id, element) => onChange(elements.map((e) => (e.id === id ? element : e)))
  const add = () => {
    const id = `p${Date.now().toString(36)}`
    onChange([...elements, { id, type: adding, name: nextName(adding, elements), ...PLANT_TYPES[adding].defaults }])
    setEditing(id)
  }

  return (
    <section
      aria-label="Planta virtual"
      className="side-panel fixed z-30 w-72 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-xl"
      style={{ left: position.x, top: position.y }}
    >
      <header
        className="flex cursor-move items-center gap-1.5 rounded-t-lg border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-semibold select-none"
        onPointerDown={(e) => {
          if (e.target.closest('button')) return
          drag.current = { dx: e.clientX - position.x, dy: e.clientY - position.y }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          const x = Math.min(window.innerWidth - 80, Math.max(0, e.clientX - drag.current.dx))
          const y = Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.current.dy))
          setPosition({ x, y })
        }}
        onPointerUp={() => {
          if (drag.current) savePosition(position)
          drag.current = null
        }}
      >
        <Factory size={15} /> Planta virtual
        <span className="ml-auto" />
        <button type="button" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Desplegar' : 'Plegar'} className="rounded p-0.5 hover:bg-slate-200">
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
        <button type="button" onClick={onClose} title="Cerrar" className="rounded p-0.5 hover:bg-slate-200">
          <X size={15} />
        </button>
      </header>
      {!collapsed && (
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
          {extra}
          {elements.length === 0 && (
            <p className="text-xs text-slate-500">
              Añade cilindros, cintas o depósitos y asígnales las salidas y entradas: la simulación moverá la planta y sus
              sensores cambiarán solos.
            </p>
          )}
          {elements.map((e) => {
            const Drawing = DRAWINGS[e.type]
            return (
              <div key={e.id} className="rounded border border-slate-200 p-1.5" aria-label={`${PLANT_TYPES[e.type].label} ${e.name}`}>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <span>{PLANT_TYPES[e.type].label}</span>
                  <span className="ml-auto" />
                  {e.type === 'conveyor' && (
                    <>
                      <button type="button" onClick={() => onAction(e.id, 'add-piece')} className="rounded border border-slate-300 px-1 hover:bg-slate-100">
                        Nueva pieza
                      </button>
                      <button type="button" onClick={() => onAction(e.id, 'remove-piece')} className="rounded border border-slate-300 px-1 hover:bg-slate-100">
                        Retirar
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(editing === e.id ? null : e.id)}
                    aria-label={`Configurar ${e.name}`}
                    aria-expanded={editing === e.id}
                    className="rounded p-0.5 hover:bg-slate-100"
                  >
                    <Pencil size={12} />
                  </button>
                  <button type="button" onClick={() => onChange(elements.filter((x) => x.id !== e.id))} aria-label={`Quitar ${e.name}`} className="rounded p-0.5 hover:bg-red-500 hover:text-white">
                    <Trash2 size={12} />
                  </button>
                </div>
                <Drawing e={e} s={plantState?.[e.id]} values={values} />
                {editing === e.id && <ElementEditor element={e} variables={variables} onChange={(x) => update(e.id, x)} />}
              </div>
            )
          })}
          <div className="flex items-center gap-1 text-xs">
            <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Tipo de elemento" className="flex-1 rounded border border-slate-300 px-1 py-0.5">
              {Object.entries(PLANT_TYPES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={add} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
              <Plus size={12} /> Añadir
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
