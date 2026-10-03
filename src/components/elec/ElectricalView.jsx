import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, ConnectionMode, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { AlertTriangle, Maximize2, Minimize2, MousePointer2, Hand, Scan, Trash2, WandSparkles, X, Zap } from 'lucide-react'
import ElecNode from './ElecNode'
import { INK, POTENTIAL_COLORS } from './elecColors'
import { ELEC_TYPES, GRID, POTENTIALS, contactNumbers, crossReferences, nextTag, showTag, sizeOf } from '../../lib/elec/catalog'
import { generatePlcWiring } from '../../lib/elec/generate'

const nodeTypes = { elec: ElecNode }
const EMPTY = { enabled: false, components: [], wires: [] }
const HISTORY_LIMIT = 100
const DRAG_TYPE = 'application/x-grafcet-elec'
const snap = (v) => Math.round(v / GRID) * GRID
const newId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Paleta: embarrados de cada potencial y el resto de aparatos por grupos.
const PALETTE = [
  {
    group: 'Alimentación',
    items: Object.keys(POTENTIALS).map((p) => ({ key: `rail:${p}`, type: 'rail', label: `Embarrado ${p}`, preset: { potential: p } })),
  },
  ...['Mando', 'Potencia', 'Autómata'].map((group) => ({
    group,
    items: Object.entries(ELEC_TYPES)
      .filter(([, t]) => t.group === group)
      .flatMap(([type, t]) =>
        type === 'coil'
          ? [
              { key: 'coil:contactor', type, label: 'Contactor (bobina)', preset: { kind: 'contactor' } },
              { key: 'coil:relay', type, label: 'Relé auxiliar (bobina)', preset: { kind: 'relay' }, prefix: 'KA' },
              { key: 'coil:ton', type, label: 'Temporizador a la conexión', preset: { kind: 'ton', preset: 3 }, prefix: 'KT' },
              { key: 'coil:tof', type, label: 'Temporizador a la desconexión', preset: { kind: 'tof', preset: 3 }, prefix: 'KT' },
            ]
          : [{ key: type, type, label: t.label, preset: {} }],
      ),
  })),
]
const HINTS = {
  rail: 'Embarrado: da su potencial (fase, neutro, 24 V…) a lo que se conecta a sus tomas.',
  pushbutton: 'Pulsador NA o NC. Enlázalo con un pulsador de la planta para que lo accione.',
  switch: 'Interruptor o selector: se queda en su posición.',
  emergency: 'Seta de emergencia (NC, con enclavamiento).',
  limit: 'Final de carrera o detector: lo acciona la planta (enlázalo con su señal).',
  contact: 'Contacto auxiliar de un contactor, relé, temporizador o relé térmico (por su identificador).',
  coil: 'Bobina A1-A2. Sus contactos llevan su mismo identificador (-KM1).',
  valve: 'Electroválvula: enlázala con la orden del cilindro de la planta.',
  lamp: 'Piloto de señalización.',
  breaker: 'Magnetotérmico: protege; salta si hay un cortocircuito aguas abajo.',
  motorprotector: 'Guardamotor: magnetotérmico con protección térmica.',
  thermal: 'Relé térmico: sus contactos 95-96 (NC) y 97-98 (NA) cambian al dispararse.',
  maincontacts: 'Contactos principales (1-2, 3-4, 5-6) de un contactor.',
  motor3: 'Motor trifásico U V W: el orden de las fases da el sentido de giro.',
  motor6: 'Motor con las seis puntas: arranque estrella-triángulo.',
  plc: 'Autómata: entradas I (con 1M a M) y salidas Q por relé (1L común).',
}

// Esquema eléctrico (lib/elec): mando, potencia y autómata, editable y simulable.
// schematic: plc.electrical; elecState: estado de la simulación (o null); onAction(id, action).
// onHistory: como en la planta, deshacer/rehacer/copiar/pegar de siempre actúan aquí (modo Editar).
export default function ElectricalView(props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  )
}

function Inner({ schematic, onChange, elecState, onAction, variables = [], buildVariables, scene, simulating, onHistory, onActivate, maximized, onToggleMaximize, onClose }) {
  const sch = schematic ?? EMPTY
  const components = useMemo(() => sch.components ?? [], [sch.components])
  const wires = useMemo(() => sch.wires ?? [], [sch.wires])
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapperRef = useRef(null)
  // Al empezar o acabar la simulación, Usar o Editar (se puede cambiar a mano).
  const [mode, setMode] = useState(simulating ? 'use' : 'edit')
  const [wasSimulating, setWasSimulating] = useState(simulating)
  if (wasSimulating !== simulating) {
    setWasSimulating(simulating)
    setMode(simulating ? 'use' : 'edit')
  }
  const [selected, setSelected] = useState([])
  const [selectedWires, setSelectedWires] = useState([])
  const [dragPos, setDragPos] = useState({})
  const [message, setMessage] = useState(null)
  const view = elecState?.view ?? null
  // Al cambiar el tamaño del panel (vista dividida o completa, empezar a simular), reencuadrar.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = ''
    let frame = 0
    const ro = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width / 20)}x${Math.round(entry.contentRect.height / 20)}`
      if (size === last) return
      last = size
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => fitView({ padding: 0.15 }))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [fitView])

  // Historial propio (los botones y atajos de siempre lo usan con onHistory).
  const history = useRef({ past: [], future: [] })
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 })
  const save = (next) => {
    const h = history.current
    h.past = [...h.past.slice(-(HISTORY_LIMIT - 1)), sch]
    h.future = []
    setHistorySize({ past: h.past.length, future: 0 })
    onChange({ ...sch, ...next })
  }
  const travel = (from, to) => {
    const h = history.current
    if (!h[from].length) return
    h[to] = [...h[to], sch]
    const prev = h[from][h[from].length - 1]
    h[from] = h[from].slice(0, -1)
    setHistorySize({ past: h.past.length, future: h.future.length })
    onChange(prev)
  }

  const add = (item, at = null) => {
    const t = ELEC_TYPES[item.type]
    const center = at ?? screenToFlowPosition({ x: (wrapperRef.current?.getBoundingClientRect().left ?? 0) + 200, y: (wrapperRef.current?.getBoundingClientRect().top ?? 0) + 120 })
    const coils = components.filter((c) => c.type === 'coil')
    const ref =
      item.type === 'contact' ? coils[0]?.tag ?? 'KM1' : item.type === 'maincontacts' ? coils.find((c) => c.kind === 'contactor')?.tag ?? 'KM1' : undefined
    const c = {
      id: newId('e'),
      type: item.type,
      x: snap(center.x),
      y: snap(center.y),
      tag: nextTag(components, item.prefix ?? t.prefix),
      ...t.defaults,
      ...item.preset,
      ...(ref ? { ref } : {}),
    }
    save({ components: [...components, c] })
    setSelected([c.id])
    setSelectedWires([])
  }

  const removeSelected = () => {
    if (!selected.length && !selectedWires.length) return
    const gone = new Set(selected)
    save({
      components: components.filter((c) => !gone.has(c.id)),
      wires: wires.filter((w) => !selectedWires.includes(w.id) && !gone.has(w.from.c) && !gone.has(w.to.c)),
    })
    setSelected([])
    setSelectedWires([])
  }

  // Copiar / pegar: los componentes seleccionados y los cables entre ellos.
  const clipboard = useRef(null)
  const copy = () => {
    const ids = new Set(selected)
    if (!ids.size) return false
    clipboard.current = { components: components.filter((c) => ids.has(c.id)), wires: wires.filter((w) => ids.has(w.from.c) && ids.has(w.to.c)) }
    return true
  }
  const paste = () => {
    const clip = clipboard.current
    if (!clip) return
    const map = new Map()
    let all = [...components]
    const pasted = clip.components.map((c) => {
      const id = newId('e')
      map.set(c.id, id)
      const prefix = ELEC_TYPES[c.type]?.prefix
      const tag = c.type === 'contact' || c.type === 'maincontacts' || c.type === 'rail' ? c.tag : nextTag(all, (c.tag ?? '').replace(/\d+$/, '') || prefix)
      const copyC = { ...c, id, x: c.x + 40, y: c.y + 40, tag }
      all = [...all, copyC]
      return copyC
    })
    const pastedWires = clip.wires.map((w) => ({ id: newId('w'), from: { ...w.from, c: map.get(w.from.c) }, to: { ...w.to, c: map.get(w.to.c) } }))
    save({ components: all, wires: [...wires, ...pastedWires] })
    setSelected(pasted.map((c) => c.id))
  }

  const latest = useRef({})
  useEffect(() => {
    latest.current = {
      undo: () => travel('past', 'future'),
      redo: () => travel('future', 'past'),
      copy,
      cut: () => copy() && removeSelected(),
      paste,
      duplicate: () => copy() && paste(),
      selectAll: () => setSelected(components.map((c) => c.id)),
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

  // Nodos y cables para React Flow.
  const numbers = useMemo(() => contactNumbers(components), [components])
  const xrefs = useMemo(() => crossReferences(components), [components])
  const timers = useMemo(() => new Set(components.filter((c) => c.type === 'coil' && (c.kind === 'ton' || c.kind === 'tof')).map((c) => c.tag)), [components])
  const act = useCallback((id, action) => onAction?.(id, action), [onAction])
  const nodes = useMemo(
    () =>
      components.map((c) => ({
        id: c.id,
        type: 'elec',
        position: dragPos[c.id] ?? { x: c.x, y: c.y },
        data: { c, view, numbers: numbers[c.id], xref: xrefs[c.tag], timed: c.type === 'contact' && timers.has(c.ref), mode, onAction: act },
        selected: selected.includes(c.id),
        draggable: mode === 'edit',
        selectable: mode === 'edit',
        connectable: mode === 'edit',
        zIndex: c.type === 'rail' ? 0 : 1,
        // Tamaño conocido: sin esperar a medirlo (si no, React Flow oculta los nodos nuevos que le
        // llegan en cada paso de la simulación hasta volver a medirlos).
        measured: (({ w, h }) => ({ width: w, height: h }))(sizeOf(c)),
      })),
    [components, dragPos, view, numbers, xrefs, timers, mode, act, selected],
  )
  const edges = useMemo(
    () =>
      wires.map((w) => {
        const p = view?.pot?.[`${w.from.c}:${w.from.t}`]
        const sel = selectedWires.includes(w.id)
        return {
          id: w.id,
          source: w.from.c,
          sourceHandle: w.from.t,
          target: w.to.c,
          targetHandle: w.to.t,
          type: 'step',
          selected: sel,
          selectable: mode === 'edit',
          style: { stroke: sel ? '#2563eb' : p ? (POTENTIAL_COLORS[p] ?? INK) : INK, strokeWidth: p ? 2.6 : 1.6 },
          data: { potential: p ?? null },
        }
      }),
    [wires, view, selectedWires, mode],
  )

  const onNodesChange = (changes) => {
    let sel = selected
    let moved = null
    for (const ch of changes) {
      if (ch.type === 'select') sel = ch.selected ? [...new Set([...sel, ch.id])] : sel.filter((id) => id !== ch.id)
      if (ch.type === 'position' && ch.position && ch.dragging) moved = { ...(moved ?? dragPos), [ch.id]: ch.position }
    }
    if (sel !== selected) setSelected(sel)
    if (moved) setDragPos(moved)
  }
  const onNodeDragStop = (_, __, dragged) => {
    const pos = new Map(dragged.map((n) => [n.id, { x: snap(n.position.x), y: snap(n.position.y) }]))
    setDragPos({})
    if (![...pos].some(([id, p]) => components.find((c) => c.id === id && (c.x !== p.x || c.y !== p.y)))) return
    save({ components: components.map((c) => (pos.has(c.id) ? { ...c, ...pos.get(c.id) } : c)) })
  }
  const onEdgesChange = (changes) => {
    let sel = selectedWires
    for (const ch of changes) if (ch.type === 'select') sel = ch.selected ? [...new Set([...sel, ch.id])] : sel.filter((id) => id !== ch.id)
    if (sel !== selectedWires) setSelectedWires(sel)
  }
  const onConnect = ({ source, sourceHandle, target, targetHandle }) => {
    if (source === target && sourceHandle === targetHandle) return
    const same = (w) =>
      (w.from.c === source && w.from.t === sourceHandle && w.to.c === target && w.to.t === targetHandle) ||
      (w.to.c === source && w.to.t === sourceHandle && w.from.c === target && w.from.t === targetHandle)
    if (wires.some(same)) return
    save({ wires: [...wires, { id: newId('w'), from: { c: source, t: sourceHandle }, to: { c: target, t: targetHandle } }] })
  }

  const generate = () => {
    const vars = buildVariables?.() ?? []
    const withAddress = vars.filter((v) => (v.type === 'input' || v.type === 'output') && v.address?.trim())
    if (!withAddress.length) {
      setMessage({ kind: 'warn', text: 'Ninguna entrada ni salida tiene dirección: asígnalas en Variables («Rellenar vacías»).' })
      return
    }
    const r = generatePlcWiring(vars, scene, sch)
    save({ components: [...components, ...r.components], wires: [...wires, ...r.wires], enabled: true })
    setMessage({
      kind: r.skipped.length ? 'warn' : 'ok',
      text: `Conexiones del autómata creadas (${r.components.length - 3} aparatos) y simulación con el esquema activada.${r.skipped.length ? ` Sin borne: ${r.skipped.join(', ')}.` : ''}`,
    })
    requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15 })))
  }

  const selectedC = selected.length === 1 ? components.find((c) => c.id === selected[0]) : null
  const short = view?.short
  const hiddenWarning = simulating && !sch.enabled && components.length > 0

  return (
    <section
      aria-label="Esquema eléctrico"
      tabIndex={-1}
      onPointerDownCapture={onActivate}
      onKeyDown={(e) => {
        if (mode !== 'edit') return
        if (e.target.closest?.('input, select, textarea')) return
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          e.stopPropagation()
          removeSelected()
        }
      }}
      className={`side-panel @container relative flex min-w-0 flex-col border-l border-slate-200 bg-white outline-none ${
        maximized ? `absolute inset-y-0 left-0 z-20 ${simulating ? 'right-80' : 'right-0'}` : 'w-1/2 shrink-0'
      }`}
    >
      <header className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2 py-1.5 text-xs">
        <span className="mr-1 flex items-center gap-1 text-sm font-semibold">
          <Zap size={14} /> Esquema eléctrico
        </span>
        {simulating && (
          <div className="flex rounded-md border border-slate-300 p-0.5" role="radiogroup" aria-label="Modo del esquema">
            {[
              ['use', 'Usar', Hand],
              ['edit', 'Editar', MousePointer2],
            ].map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={mode === id}
                onClick={() => setMode(id)}
                className={`flex items-center gap-1 rounded px-2 py-0.5 ${mode === id ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5" title="Al simular, las señales pasan por los cables: si hay autómata, sus entradas y salidas son las de sus bornes">
          <input type="checkbox" checked={Boolean(sch.enabled)} onChange={(e) => save({ enabled: e.target.checked })} />
          Simular con el esquema
        </label>
        <button
          type="button"
          onClick={generate}
          title="Crea el autómata con un aparato en cada entrada y salida de la tabla de variables, ya cableado"
          aria-label="Conexiones del autómata"
          className="flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-800 hover:bg-blue-100"
        >
          <WandSparkles size={12} /> <span className="hidden @2xl:inline">Conexiones del autómata</span>
          <span className="@2xl:hidden">Autómata</span>
        </button>
        <span className="ml-auto" />
        <button type="button" onClick={() => fitView({ padding: 0.15 })} title="Ajustar la vista" aria-label="Ajustar la vista" className="rounded p-1 hover:bg-slate-100">
          <Scan size={14} />
        </button>
        <button type="button" onClick={onToggleMaximize} title={maximized ? 'Vista dividida' : 'Pantalla completa'} className="rounded p-1 hover:bg-slate-100">
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button type="button" onClick={onClose} title="Cerrar el esquema" className="rounded p-1 hover:bg-slate-100">
          <X size={14} />
        </button>
      </header>
      {(short || view?.oscillating || message || hiddenWarning) && (
        <div className="space-y-0.5 border-b border-slate-200 px-3 py-1 text-xs" role="status">
          {short && (
            <p className="flex items-center gap-1 font-semibold text-red-700">
              <AlertTriangle size={13} /> {short}
            </p>
          )}
          {view?.oscillating && <p className="text-amber-700">El circuito no se estabiliza (unos relés se activan y desactivan entre sí).</p>}
          {hiddenWarning && <p className="text-amber-700">Activa «Simular con el esquema» para que la simulación pase por estos cables.</p>}
          {message && <p className={message.kind === 'ok' ? 'text-green-700' : 'text-amber-700'}>{message.text}</p>}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && (
          <nav className="w-36 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 p-1.5 text-xs" aria-label="Aparatos">
            {PALETTE.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{group}</p>
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DRAG_TYPE, item.key)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => add(item)}
                    title={HINTS[item.type]}
                    className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-slate-100"
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}
        <div
          ref={wrapperRef}
          className="paper relative min-h-0 min-w-0 flex-1"
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            const key = e.dataTransfer.getData(DRAG_TYPE)
            const item = PALETTE.flatMap((g) => g.items).find((i) => i.key === key)
            if (!item) return
            e.preventDefault()
            add(item, screenToFlowPosition({ x: e.clientX, y: e.clientY }))
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2 }}
            snapToGrid
            snapGrid={[GRID, GRID]}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.2}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
            onPaneClick={() => {
              setSelected([])
              setSelectedWires([])
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={GRID} size={1} color="#cbd5e1" />
          </ReactFlow>
          {components.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 px-6 text-center text-sm text-slate-500">
              Añade embarrados y aparatos desde la paleta y únelos arrastrando de borne a borne, o pulsa «Conexiones del autómata» para crear el cableado del autómata desde la tabla de variables.
            </p>
          )}
        </div>
        {mode === 'edit' && selectedC && (
          <Properties
            key={selectedC.id}
            c={selectedC}
            components={components}
            variables={variables}
            onChange={(patch) => save({ components: components.map((c) => (c.id === selectedC.id ? { ...c, ...patch } : c)) })}
            onDelete={removeSelected}
          />
        )}
      </div>
      <p className="border-t border-slate-200 px-3 py-1 text-[11px] text-slate-500">
        {mode === 'edit'
          ? 'Arrastra de borne a borne para cablear · Supr borra · Ctrl+C/V/D copia, pega, duplica · deshacer y rehacer: los de siempre · los cables se colorean con su potencial al simular.'
          : 'Pulsa los pulsadores (mantén), conmuta interruptores y protecciones; los cables con tensión toman el color de su potencial.'}
      </p>
    </section>
  )
}

const field = 'mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5'

// Propiedades del componente seleccionado.
function Properties({ c, components, variables, onChange, onDelete }) {
  const t = ELEC_TYPES[c.type]
  const isLoad = ['coil', 'valve', 'lamp', 'motor3', 'motor6'].includes(c.type)
  const isContact = ['pushbutton', 'switch', 'limit', 'emergency'].includes(c.type)
  const signals = variables.filter((v) => (isLoad ? v.type === 'output' : v.type !== 'output'))
  const refs = components.filter((x) => (c.type === 'maincontacts' ? x.type === 'coil' : ['coil', 'thermal', 'motorprotector', 'breaker'].includes(x.type)) && x.tag)
  const text = (key, label, props = {}) => (
    <label className="block">
      <span className="text-slate-500">{label}</span>
      <input value={c[key] ?? ''} onChange={(e) => onChange({ [key]: e.target.value })} className={field} {...props} />
    </label>
  )
  const select = (key, label, options) => (
    <label className="block">
      <span className="text-slate-500">{label}</span>
      <select value={c[key] ?? ''} onChange={(e) => onChange({ [key]: e.target.value })} className={field}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  )
  const signalSelect = (key, label) =>
    select(key, label, [['', '(sin enlazar)'], ...signals.map((v) => [v.name, v.name]), ...(c[key] && !signals.some((v) => v.name === c[key]) ? [[c[key], c[key]]] : [])])

  return (
    <aside className="w-48 shrink-0 space-y-2 overflow-y-auto border-l border-slate-200 p-2 text-xs" aria-label="Propiedades del aparato">
      <p className="font-semibold">
        {t?.label} {showTag(c.type === 'contact' || c.type === 'maincontacts' ? c.ref : c.tag)}
      </p>
      {!['rail', 'contact', 'maincontacts'].includes(c.type) && text('tag', 'Identificador (sin el guion)')}
      {c.type === 'rail' && (
        <>
          {select('potential', 'Potencial', Object.entries(POTENTIALS).map(([k, v]) => [k, v.label]))}
          {text('length', 'Largo (px)', { type: 'number', min: 40, step: 20 })}
        </>
      )}
      {(isContact && c.type !== 'emergency') || c.type === 'contact'
        ? select('contact', 'Contacto', [
            ['NO', 'NA (normalmente abierto)'],
            ['NC', 'NC (normalmente cerrado)'],
          ])
        : null}
      {(c.type === 'contact' || c.type === 'maincontacts') &&
        select('ref', 'Del aparato', [...refs.map((x) => [x.tag, showTag(x.tag)]), ...(refs.some((x) => x.tag === c.ref) ? [] : [[c.ref ?? '', showTag(c.ref) || '—']])])}
      {c.type === 'coil' && (
        <>
          {select('kind', 'Tipo', [
            ['contactor', 'Contactor'],
            ['relay', 'Relé auxiliar'],
            ['ton', 'Temporizador a la conexión'],
            ['tof', 'Temporizador a la desconexión'],
          ])}
          {(c.kind === 'ton' || c.kind === 'tof') && text('preset', 'Tiempo (s)', { type: 'number', min: 0, step: 0.5 })}
        </>
      )}
      {c.type === 'lamp' &&
        select('color', 'Color', [
          ['green', 'Verde'],
          ['red', 'Rojo'],
          ['amber', 'Ámbar'],
          ['white', 'Blanco'],
          ['blue', 'Azul'],
        ])}
      {c.type === 'breaker' &&
        select('poles', 'Polos', [
          ['3', 'Tripolar'],
          ['1', 'Unipolar'],
        ])}
      {c.type === 'plc' && (
        <>
          {text('inputs', 'Entradas', { type: 'number', min: 1, max: 24 })}
          {text('outputs', 'Salidas', { type: 'number', min: 1, max: 16 })}
        </>
      )}
      {(isContact || isLoad) && signalSelect('signal', isLoad ? 'Mueve en la planta' : 'Lo acciona en la planta')}
      {(c.type === 'motor3' || c.type === 'motor6') && signalSelect('reverse', 'Giro inverso en la planta')}
      {c.type !== 'rail' && text('text', 'Descripción')}
      <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-red-700 hover:bg-red-50">
        <Trash2 size={12} /> Eliminar
      </button>
    </aside>
  )
}
