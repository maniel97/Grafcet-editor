import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, ConnectionMode, ReactFlow, ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react'
import { AlertTriangle, Minus, Plus, Maximize2, Minimize2, MousePointer2, Hand, Scan, Trash2, WandSparkles, X, Zap } from 'lucide-react'
import ElecNode from './ElecNode'
import { ElecSymbol } from './ElecSymbols'
import { potentialColor } from './elecColors'
import { ELEC_TYPES, GRID, POTENTIALS, contactNumbers, crossReferences, nextTag, showTag, sizeOf, terminalsOf } from '../../lib/elec/catalog'
import { generatePlcWiring } from '../../lib/elec/generate'
import { ELEC_TEMPLATES, insertTemplate } from '../../lib/elec/templates'

const nodeTypes = { elec: ElecNode }
const EMPTY = { enabled: false, components: [], wires: [] }
const HISTORY_LIMIT = 100
const DRAG_TYPE = 'application/x-grafcet-elec'
const snap = (v) => Math.round(v / GRID) * GRID
const PREVIEW_DELAY = 450
// Ancho del panel (arrastrando el separador), recordado entre sesiones.
const WIDTH_KEY = 'grafcet-editor:elec-width'
const MIN_WIDTH = 360
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
const newId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// Paleta: embarrados de cada potencial y el resto de aparatos por grupos.
const PALETTE = [
  {
    group: 'Alimentación',
    items: [
      ...Object.keys(POTENTIALS).map((p) => ({ key: `rail:${p}`, type: 'rail', label: `Embarrado ${p}`, preset: { potential: p } })),
      { key: 'transformer', type: 'transformer', label: 'Transformador de mando', preset: {} },
      { key: 'mainswitch', type: 'mainswitch', label: 'Interruptor general', preset: {}, prefix: 'Q' },
      { key: 'psu', type: 'psu', label: 'Fuente 24 V DC', preset: {} },
      { key: 'phasemonitor', type: 'phasemonitor', label: 'Relé de control de fases', preset: {} },
    ],
  },
  {
    group: 'Seguridad',
    items: [
      { key: 'safetyrelay', type: 'safetyrelay', label: 'Relé de seguridad', preset: {} },
      { key: 'emergency:2', type: 'emergency', label: 'Seta de doble canal', preset: { channels: 2 } },
      { key: 'doorswitch', type: 'doorswitch', label: 'Interruptor de puerta', preset: {} },
      { key: 'lightcurtain', type: 'lightcurtain', label: 'Cortina fotoeléctrica', preset: {} },
    ],
  },
  {
    group: 'Vivienda',
    items: [
      { key: 'changeover', type: 'changeover', label: 'Conmutador', preset: {} },
      { key: 'crossover', type: 'crossover', label: 'Cruzamiento', preset: {} },
      { key: 'coil:impulse', type: 'coil', label: 'Telerruptor', preset: { kind: 'impulse' }, prefix: 'KL' },
      { key: 'coil:stair', type: 'coil', label: 'Minutero de escalera', preset: { kind: 'tof', preset: 30 }, prefix: 'KT' },
      { key: 'lamp:home', type: 'lamp', label: 'Lámpara (punto de luz)', preset: { color: 'amber' }, prefix: 'E' },
      { key: 'socket', type: 'socket', label: 'Base de enchufe', preset: {} },
    ],
  },
  ...['Mando', 'Potencia', 'Autómata'].map((group) => ({
    group,
    items: Object.entries(ELEC_TYPES)
      .filter(([type, t]) => t.group === group && !['mainswitch', 'psu', 'phasemonitor'].includes(type))
      .flatMap(([type, t]) =>
        type === 'coil'
          ? [
              { key: 'coil:contactor', type, label: 'Contactor (bobina)', preset: { kind: 'contactor' } },
              { key: 'coil:relay', type, label: 'Relé auxiliar (bobina)', preset: { kind: 'relay' }, prefix: 'KA' },
              { key: 'coil:ton', type, label: 'Temporizador a la conexión', preset: { kind: 'ton', preset: 3 }, prefix: 'KT' },
              { key: 'coil:tof', type, label: 'Temporizador a la desconexión', preset: { kind: 'tof', preset: 3 }, prefix: 'KT' },
              { key: 'coil:flash', type, label: 'Relé intermitente', preset: { kind: 'flash', preset: 1 }, prefix: 'KF' },
            ]
          : type === 'limit'
            ? [
                { key: 'limit', type, label: 'Final de carrera', preset: { kind: 'limit' } },
                { key: 'limit:float', type, label: 'Flotador (nivel)', preset: { kind: 'float' } },
                { key: 'limit:pressure', type, label: 'Presostato', preset: { kind: 'pressure' } },
                { key: 'limit:thermostat', type, label: 'Termostato', preset: { kind: 'thermostat' } },
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
  selector3: 'Conmutador de 3 posiciones: en 1 cierra 13-14 y en 2, 23-24 (p. ej. manual / 0 / automático).',
  sensor3: 'Detector de proximidad de 3 hilos: BN (+), BU (−) y BK (salida). PNP da + a la entrada; NPN, −. Necesita su alimentación.',
  counter: 'Contador: cuenta los impulsos en A1-A2; al llegar a la preselección cambian sus contactos. R1-R2 lo pone a cero.',
  buzzer: 'Timbre o zumbador: suena mientras tiene tensión.',
  fuse: 'Fusible (en seccionador portafusibles): se funde con un cortocircuito; se repone con un clic. También se abre a mano.',
  rcd: 'Diferencial: salta con una derivación a tierra (fase con PE), no con un cortocircuito fase-neutro. Botón T de prueba.',
  transformer: 'Transformador de mando (230/24 V): el secundario S1-S2 es un circuito aparte, con tensión mientras el primario la tiene.',
  changeover: 'Conmutador de vivienda: el común C pasa de 1 a 2. Dos conmutadores: encender desde dos sitios.',
  crossover: 'Cruzamiento: une A1-B1 y A2-B2 o los cruza. Entre dos conmutadores: encender desde tres o más sitios.',
  socket: 'Base de enchufe (fase, neutro y tierra).',
  mainswitch: 'Interruptor general (seccionador de corte en carga): corta toda la máquina; se puede bloquear con candado para el mantenimiento.',
  psu: 'Fuente de alimentación: con 230 V~ en L-N da 24 V DC (L+ y M) para el mando, los detectores y el autómata.',
  phasemonitor: 'Relé de control de fases: su contacto (-KF1) cierra solo con las tres fases presentes y en orden L1-L2-L3 (evita el giro al revés).',
  safetyrelay: 'Relé de seguridad: con los dos canales cerrados (S11-S12 y S21-S22, o salidas OSSD) y el rearme S33-S34, cierra 13-14 y 23-24. Si un canal abre, para; vuelve solo con un nuevo rearme.',
  doorswitch: 'Interruptor de puerta de seguridad: dos contactos NC que abren al abrir el resguardo.',
  lightcurtain: 'Cortina fotoeléctrica: libre y alimentada, sus salidas OSSD1 y OSSD2 dan +24 V; al cortar el haz, se apagan.',
  vfd: 'Variador de frecuencia: DI1 adelante, DI2 atrás, DI3 2ª velocidad, AI1 consigna 0-10 V (manda sobre las velocidades). R1-R2 cierra con el motor en marcha. Sus +24/GND alimentan las entradas.',
  softstarter: 'Arrancador suave: con A1-A2 alimentado sube la tensión del motor en una rampa; su contacto (por su identificador) cierra al acabarla.',
  brake: 'Freno del motor (electrofreno): suelta con tensión y frena sin ella. Se conecta a los bornes del motor o con su propio contactor.',
  beacon: 'Columna de señalización: rojo (X1), ámbar (X2), verde (X3) y zumbador (X4) con el común X0.',
  litbutton: 'Pulsador luminoso: contacto 13-14 y piloto X1-X2 en el mismo aparato.',
  transmitter: 'Transmisor analógico: 4-20 mA a 2 hilos (+ a 24 V, − a la entrada) o 0-10 V a 3 hilos. Enlázalo con la analógica de la planta (nivel, temperatura…).',
  potentiometer: 'Potenciómetro de consigna: su cursor W da de 0 a 10 V (p. ej. a la entrada AI1 de un variador).',
}

// Referencia de cada aparato (identificador IEC 81346 y bornes).
const NORMS = {
  rail: 'Colores IEC 60445: L1 marrón, L2 negro, L3 gris, N azul, PE verde-amarillo.',
  pushbutton: 'Identificador -S · bornes 13-14 (NA), 11-12 (NC).',
  switch: 'Identificador -S · bornes 13-14 (NA), 11-12 (NC).',
  emergency: 'Identificador -S · NC 11-12 de apertura forzada (IEC 60947-5-5).',
  limit: 'Identificador -B (detectores) · 13-14 / 11-12.',
  contact: 'Lleva el identificador de su aparato · 13-14, 23-24… (NA); 11-12, 21-22… (NC); térmico 95-96 / 97-98.',
  coil: 'Contactor -KM, relé -KA, temporizador -KT · bobina A1-A2.',
  valve: 'Identificador -Y (válvula) · A1-A2.',
  lamp: 'Identificador -H (señalización) · X1-X2.',
  breaker: 'Identificador -Q · polos 1-2, 3-4, 5-6.',
  motorprotector: 'Identificador -Q · polos 1-2, 3-4, 5-6.',
  thermal: 'Identificador -F · polos 1-2, 3-4, 5-6; contactos 95-96 (NC) y 97-98 (NA).',
  maincontacts: 'Lleva el identificador del contactor (-KM) · 1-2, 3-4, 5-6.',
  motor3: 'Identificador -M · bornes U, V, W.',
  motor6: 'Identificador -M · U1 V1 W1 / U2 V2 W2.',
  plc: 'Identificador -A · entradas I con común 1M; salidas por relé Q con común 1L.',
  selector3: 'Identificador -S · 13-14 (posición 1) y 23-24 (posición 2).',
  sensor3: 'Identificador -B · cables BN marrón (+), BU azul (−), BK negro (salida), IEC 60947-5-2.',
  counter: 'Identificador -KC · A1-A2 (impulsos), R1-R2 (puesta a cero).',
  buzzer: 'Identificador -H · X1-X2.',
  fuse: 'Identificador -F · 1-2 (3-4, 5-6).',
  rcd: 'Identificador -Q · fase 1-2, neutro 3-4; 30 mA en viviendas (REBT ITC-BT-25).',
  transformer: 'Identificador -T · primario P1-P2, secundario S1-S2 (24 V~: muy baja tensión de seguridad).',
  changeover: 'Identificador -S · común C, viajeros 1 y 2.',
  crossover: 'Identificador -S · A1 A2 / B1 B2.',
  socket: 'Identificador -X · L, N y PE.',
  mainswitch: 'Identificador -Q0 · obligatorio en toda máquina (IEC 60204-1, 5.3), con bloqueo.',
  psu: 'Identificador -G · L, N / L+, M (muy baja tensión de protección, PELV).',
  phasemonitor: 'Identificador -KF · L1, L2, L3.',
  safetyrelay: 'Identificador -KS · ISO 13849-1: categoría 3 / PL d con doble canal y contactores redundantes.',
  doorswitch: 'Identificador -B · ISO 14119 (dispositivos de enclavamiento de resguardos).',
  lightcurtain: 'Identificador -B · IEC 61496 (equipos de protección electrosensibles).',
  vfd: 'Identificador -T · L1-L3 / U-V-W; mando DI1-DI3, AI1 (0-10 V), relé R1-R2.',
  softstarter: 'Identificador -T · 1L1-3L2-5L3 / 2T1-4T2-6T3 (aquí L1-L3 / T1-T3), mando A1-A2.',
  brake: 'Identificador -MB · A1-A2.',
  beacon: 'Identificador -P · colores IEC 60204-1 (rojo: peligro, ámbar: anormal, verde: normal).',
  litbutton: 'Identificador -S · 13-14 y X1-X2.',
  transmitter: 'Identificador -B · 4-20 mA (2 hilos) o 0-10 V (3 hilos).',
  potentiometer: 'Identificador -R · cursor W (0-10 V).',
}

// Vista previa de un aparato de la paleta: su símbolo (con sus bornes) tal como queda en el esquema.
function ElecPreview({ item }) {
  const c = { id: 'preview', type: item.type, x: 0, y: 0, tag: `${item.prefix ?? ELEC_TYPES[item.type].prefix}1`, ...ELEC_TYPES[item.type].defaults, ...item.preset }
  if (c.type === 'rail') c.length = 160
  if (c.type === 'plc') Object.assign(c, { inputs: 4, outputs: 3 })
  if (c.type === 'contact' || c.type === 'maincontacts') c.ref = 'KM1'
  const { w, h } = sizeOf(c)
  const label = (t) => (c.type === 'contact' ? (t.side === 'top' ? '13' : '14') : t.id)
  return (
    <svg viewBox={`-40 -14 ${w + 120} ${h + 28}`} className="mx-auto block max-h-28 w-full" aria-hidden="true">
      <ElecSymbol c={c} view={null} />
      {!['rail', 'plc'].includes(c.type) &&
        terminalsOf(c).map((t) => (
          <text key={t.id} x={t.x + 4} y={t.side === 'top' ? t.y + 11 : t.y - 4} fontSize="8.5" fontFamily="ui-monospace, monospace" fill="#475569">
            {label(t)}
          </text>
        ))}
      {c.type === 'rail' && (
        <text x="-6" y="14" textAnchor="end" fontSize="12" fontWeight="700" fill="#0f172a">
          {c.potential}
        </text>
      )}
      {!['rail', 'plc'].includes(c.type) && (
        <text x={w + 4} y="34" fontSize="11" fontWeight="700" fill="#0f172a">
          {showTag(c.type === 'contact' || c.type === 'maincontacts' ? c.ref : c.tag)}
        </text>
      )}
    </svg>
  )
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
  const { screenToFlowPosition, fitView, getNodes, zoomIn, zoomOut } = useReactFlow()
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
  const [width, setWidth] = useState(loadWidth)
  const resizing = useRef(null)
  const [preview, setPreview] = useState(null) // { item, x, y }
  const previewTimer = useRef(null)
  useEffect(() => () => clearTimeout(previewTimer.current), [])
  const { zoom } = useViewport()
  const view = elecState?.view ?? null
  // Al cambiar el tamaño del panel (vista dividida o completa, empezar a simular), reencuadrar. Se
  // observa el panel entero, no el lienzo: abrir las propiedades no debe mover la vista.
  const sectionRef = useRef(null)
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = ''
    let frame = 0
    const ro = new ResizeObserver(([entry]) => {
      const size = `${Math.round(entry.contentRect.width / 20)}x${Math.round(entry.contentRect.height / 20)}`
      if (size === last) return
      last = size
      cancelAnimationFrame(frame)
      // Vacío, no: React Flow lo dejaría en cola y reencuadraría al añadir el primer aparato.
      frame = requestAnimationFrame(() => getNodes().length && fitView({ padding: 0.15 }))
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [fitView, getNodes])

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
    // Sin caer encima de otro: al añadir con clic, el primer hueco libre hacia la derecha (y, si no,
    // en la fila de abajo), contando con el rótulo a su derecha.
    let x = snap(center.x)
    let y = snap(center.y)
    if (!at) {
      const probe = { type: item.type, ...t.defaults, ...item.preset }
      const { w, h } = sizeOf(probe)
      const box = (o) => {
        const sz = sizeOf(o)
        return { x: o.x, y: o.y, w: sz.w + (o.type === 'rail' ? 0 : 100), h: sz.h }
      }
      const hits = (px, py) => components.some((o) => {
        const b = box(o)
        return px < b.x + b.w && b.x < px + w + 100 && py < b.y + b.h + 20 && b.y < py + h + 20
      })
      const x0 = x
      for (let i = 0; i < 200 && hits(x, y); i++) {
        x += 7 * GRID
        if (x > x0 + 1200) {
          x = x0
          y += 6 * GRID
        }
      }
    }
    const c = {
      id: newId('e'),
      type: item.type,
      x,
      y,
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
          style: { stroke: sel ? '#2563eb' : potentialColor(p ?? ''), strokeWidth: p ? 2.6 : 1.6 },
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
      text: `Conexiones del autómata creadas (${r.components.length - 3} aparatos) y conectadas con el autómata y la planta.${r.skipped.length ? ` Sin borne: ${r.skipped.join(', ')}.` : ''}`,
    })
    requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15 })))
  }

  const selectedC = selected.length === 1 ? components.find((c) => c.id === selected[0]) : null
  const short = view?.short
  // Hay autómata o aparatos enlazados con la planta, pero el esquema no está conectado.
  const hiddenWarning = simulating && !sch.enabled && components.some((c) => c.type === 'plc' || c.signal)

  return (
    <section
      aria-label="Esquema eléctrico"
      ref={sectionRef}
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
      // relative y absolute no pueden ir juntas (en el CSS generado ganaría relative).
      className={`side-panel @container flex min-w-0 flex-col border-l border-slate-200 bg-white outline-none ${
        maximized ? `absolute inset-y-0 left-0 z-20 ${simulating ? 'right-80' : 'right-0'}` : 'relative shrink-0'
      }`}
      style={maximized ? undefined : { width: width ?? '50%' }}
    >
      {/* Separador: arrastrar para repartir el espacio con el grafcet (doble clic: mitad y mitad). */}
      {!maximized && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ancho del esquema"
          title="Arrastra para cambiar el ancho del esquema (doble clic: mitad y mitad)"
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
          }}
          onDoubleClick={() => {
            setWidth(null)
            saveWidth(0)
          }}
        />
      )}
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
        <label
          className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5"
          title="El esquema se simula siempre. Conectado, el autómata y la planta usan sus cables: las entradas del autómata son las de sus bornes, sus salidas cierran los bornes Q y la planta se mueve con las bobinas y motores enlazados"
        >
          <input type="checkbox" checked={Boolean(sch.enabled)} onChange={(e) => save({ enabled: e.target.checked })} />
          Conectar con el autómata y la planta
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
        {mode === 'edit' && (
          <select
            value=""
            aria-label="Insertar montaje"
            title="Montajes clásicos listos para simular y modificar"
            onChange={(e) => {
              const t = ELEC_TEMPLATES.find((x) => x.id === e.target.value)
              if (!t) return
              const r = insertTemplate(t, sch)
              save({ components: [...components, ...r.components], wires: [...wires, ...r.wires] })
              setMessage({ kind: 'ok', text: `${t.title}: ${t.description}` })
              requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15 })))
            }}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            <option value="">Insertar montaje…</option>
            {ELEC_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto" />
        <button type="button" onClick={() => zoomOut()} title="Alejar" aria-label="Alejar" className="rounded p-1 hover:bg-slate-100">
          <Minus size={13} />
        </button>
        <span className="w-11 text-center whitespace-nowrap tabular-nums">{Math.round(zoom * 100)} %</span>
        <button type="button" onClick={() => zoomIn()} title="Acercar" aria-label="Acercar" className="rounded p-1 hover:bg-slate-100">
          <Plus size={13} />
        </button>
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
          {hiddenWarning && (
            <p className="text-amber-700">El autómata y la planta no usan estos cables: marca «Conectar con el autómata y la planta».</p>
          )}
          {message && <p className={message.kind === 'ok' ? 'text-green-700' : 'text-amber-700'}>{message.text}</p>}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && (
          <nav className="w-44 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 p-1.5 text-xs" aria-label="Aparatos">
            {PALETTE.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{group}</p>
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                      e.dataTransfer.setData(DRAG_TYPE, item.key)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                      add(item)
                    }}
                    onMouseEnter={(ev) => {
                      const at = { x: ev.clientX, y: ev.clientY }
                      clearTimeout(previewTimer.current)
                      previewTimer.current = setTimeout(() => setPreview({ item, ...at }), PREVIEW_DELAY)
                    }}
                    onMouseMove={(ev) => setPreview((p) => (p ? { ...p, x: ev.clientX, y: ev.clientY } : p))}
                    onMouseLeave={() => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                    }}
                    title="Arrastra al esquema (o pulsa para ponerlo en el centro)"
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
        >
          <ReactFlow
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
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            // Con un manejador de clic, React Flow deja pasar el ratón a los nodos aunque (al simular)
            // no se puedan seleccionar ni arrastrar: así se pulsan los pulsadores.
            onNodeClick={() => {}}
            connectionMode={ConnectionMode.Loose}
            connectionLineStyle={{ stroke: '#2563eb', strokeWidth: 2 }}
            snapToGrid
            snapGrid={[GRID, GRID]}
            deleteKeyCode={null}
            // Sin fitView automático (reencuadraría al añadir el primer aparato): lo hace el observador
            // de tamaño al abrir el panel y el botón «Ajustar la vista».
            minZoom={0.2}
            maxZoom={3}
            // Desplazar arrastrando el fondo (como en el lienzo) o con la rueda pulsada.
            panOnDrag={[0, 1]}
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
      {preview && mode === 'edit' && (
        <div
          role="tooltip"
          aria-label={`Vista previa: ${preview.item.label}`}
          className="side-panel pointer-events-none fixed z-50 w-60 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg"
          style={{ left: Math.min(preview.x + 16, window.innerWidth - 250), top: Math.min(preview.y + 12, window.innerHeight - 240) }}
        >
          <p className="mb-1 font-semibold">{preview.item.label}</p>
          <div className="paper rounded border border-slate-100 bg-white p-1">
            <ElecPreview item={preview.item} />
          </div>
          <p className="mt-1 text-slate-600">{HINTS[preview.item.type]}</p>
          {NORMS[preview.item.type] && <p className="mt-0.5 text-[10px] text-slate-500">{NORMS[preview.item.type]}</p>}
        </div>
      )}
      <p className="border-t border-slate-200 px-3 py-1 text-[11px] text-slate-500">
        {mode === 'edit'
          ? 'Arrastra de borne a borne para cablear · rueda: zoom · arrastrar el fondo (o con la rueda pulsada): desplazar · Mayús+arrastrar: varios · Supr borra · Ctrl+C/V/D copia, pega, duplica · deshacer y rehacer: los de siempre · los cables se colorean con su potencial al simular.'
          : 'Pulsa los pulsadores (mantén), conmuta interruptores y protecciones; los cables con tensión toman el color de su potencial.'}
      </p>
    </section>
  )
}

const field = 'mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5'

// Propiedades del componente seleccionado.
function Properties({ c, components, variables, onChange, onDelete }) {
  const t = ELEC_TYPES[c.type]
  const isLoad = ['coil', 'valve', 'lamp', 'motor3', 'motor6', 'buzzer', 'brake'].includes(c.type)
  const isContact = ['pushbutton', 'switch', 'limit', 'emergency', 'sensor3', 'litbutton', 'doorswitch', 'lightcurtain', 'transmitter'].includes(c.type)
  const signals = variables.filter((v) =>
    c.type === 'transmitter' ? v.type === 'analogIn' : isLoad ? v.type === 'output' : v.type !== 'output' && v.type !== 'analogIn' && v.type !== 'analogOut',
  )
  const outputs = variables.filter((v) => v.type === 'output')
  const refs = components.filter(
    (x) => (c.type === 'maincontacts' ? x.type === 'coil' : ['coil', 'counter', 'thermal', 'motorprotector', 'breaker', 'rcd', 'fuse'].includes(x.type)) && x.tag,
  )
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
      {c.type === 'limit' &&
        select('kind', 'Tipo', [
          ['limit', 'Final de carrera'],
          ['float', 'Flotador (nivel)'],
          ['pressure', 'Presostato'],
          ['thermostat', 'Termostato'],
        ])}
      {c.type === 'sensor3' && (
        <>
          {select('output', 'Salida', [
            ['PNP', 'PNP (da + a la entrada)'],
            ['NPN', 'NPN (da − a la entrada)'],
          ])}
          {select('kind', 'Detecta', [
            ['inductive', 'Inductivo (metal)'],
            ['capacitive', 'Capacitivo'],
            ['optical', 'Óptico'],
          ])}
        </>
      )}
      {c.type === 'counter' && text('preset', 'Preselección (impulsos)', { type: 'number', min: 1, step: 1 })}
      {c.type === 'emergency' &&
        select('channels', 'Canales', [
          ['1', 'Uno (11-12)'],
          ['2', 'Doble canal (11-12 y 21-22)'],
        ])}
      {c.type === 'transmitter' &&
        select('output', 'Señal', [
          ['4-20mA', '4-20 mA (2 hilos)'],
          ['0-10V', '0-10 V (3 hilos)'],
        ])}
      {c.type === 'potentiometer' && text('initial', 'Posición al empezar (0 a 1)', { type: 'number', min: 0, max: 1, step: 0.05 })}
      {c.type === 'vfd' && text('speed2', '2ª velocidad (Hz)', { type: 'number', min: 1, max: 50, step: 1 })}
      {c.type === 'softstarter' && text('ramp', 'Rampa (s)', { type: 'number', min: 0.5, step: 0.5 })}
      {c.type === 'coil' &&
        (c.kind ?? 'contactor') === 'contactor' &&
        select('interlock', 'Enclavamiento mecánico con', [
          ['', '(ninguno)'],
          ...components.filter((x) => x.type === 'coil' && x.tag && x.tag !== c.tag && (x.kind ?? 'contactor') === 'contactor').map((x) => [x.tag, showTag(x.tag)]),
        ])}
      {c.type === 'beacon' &&
        ['red', 'amber', 'green', 'buzzer'].map((k) => (
          <label key={k} className="block">
            <span className="text-slate-500">{`${{ red: 'Rojo', amber: 'Ámbar', green: 'Verde', buzzer: 'Zumbador' }[k]} mueve en la planta`}</span>
            <select value={c[k] ?? ''} onChange={(e) => onChange({ [k]: e.target.value })} className={field}>
              {[['', '(sin enlazar)'], ...outputs.map((v) => [v.name, v.name])].map(([value, t]) => (
                <option key={value} value={value}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ))}
      {c.type === 'litbutton' &&
        select('light', 'Su piloto mueve en la planta', [['', '(sin enlazar)'], ...outputs.map((v) => [v.name, v.name])])}
      {c.type === 'buzzer' &&
        select('kind', 'Tipo', [
          ['bell', 'Timbre'],
          ['buzzer', 'Zumbador'],
        ])}
      {c.type === 'fuse' &&
        select('poles', 'Polos', [
          ['1', 'Unipolar'],
          ['3', 'Tripolar'],
        ])}
      {(isContact && !['emergency', 'sensor3', 'doorswitch', 'lightcurtain', 'transmitter', 'litbutton'].includes(c.type)) || c.type === 'contact'
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
            ['tof', 'Temporizador a la desconexión (o minutero)'],
            ['flash', 'Relé intermitente'],
            ['impulse', 'Telerruptor'],
          ])}
          {(c.kind === 'ton' || c.kind === 'tof') && text('preset', 'Tiempo (s)', { type: 'number', min: 0, step: 0.5 })}
          {c.kind === 'flash' && text('preset', 'Semiperiodo (s)', { type: 'number', min: 0.1, step: 0.1 })}
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
          {text('analogIn', 'Entradas analógicas (AIW)', { type: 'number', min: 0, max: 8 })}
          {text('analogOut', 'Salidas analógicas (AQW)', { type: 'number', min: 0, max: 4 })}
        </>
      )}
      {(isContact || isLoad) &&
        signalSelect('signal', c.type === 'transmitter' ? 'Mide en la planta (analógica)' : isLoad ? 'Mueve en la planta' : c.type === 'doorswitch' ? 'Puerta abierta en la planta' : 'Lo acciona en la planta')}
      {(c.type === 'motor3' || c.type === 'motor6') && signalSelect('reverse', 'Giro inverso en la planta')}
      {c.type !== 'rail' && text('text', 'Descripción')}
      <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-red-700 hover:bg-red-50">
        <Trash2 size={12} /> Eliminar
      </button>
    </aside>
  )
}
