import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, ConnectionMode, ReactFlow, ReactFlowProvider, useReactFlow, useViewport } from '@xyflow/react'
import { AlertTriangle, Download, Gauge, Minus, Plus, Wrench, Maximize2, Minimize2, MousePointer2, Hand, Scan, Trash2, WandSparkles, X, Zap } from 'lucide-react'
import ElecNode from './ElecNode'
import WireEdge from './WireEdge'
import { ElecSymbol } from './ElecSymbols'
import { potentialColor } from './elecColors'
import { ELEC_TYPES, GRID, LOWER_RAILS, POTENTIALS, contactNumbers, cylinderSignals, isMotor, isPneumatic, newTag, nextTag, showTag, sizeOf, terminalsOf } from '../../lib/elec/catalog'
import { COLUMN_WIDTH, FRAME_HEIGHT, FRAME_TOP, crossReferenceMap, elecSheetsOf, frameColumns, sheetOfComponent } from '../../lib/elec/sheet'
import SheetTabs from '../SheetTabs'
import { ElecFrameNode } from './ElecFrame'
import ElecStatic from './ElecStatic'
import ExportDialog from '../ExportDialog'
import { svgMarkupSource } from '../../lib/svgExport'
import { fileName } from '../../lib/fileNames'
import { generatePlcWiring } from '../../lib/elec/generate'
import { voltageBetween } from '../../lib/elec/solve'
import { ELEC_TEMPLATES, insertTemplate } from '../../lib/elec/templates'
import { WIRE_COLORS, WIRE_SECTIONS, junctions as findJunctions, nextTerminalNumber, sectionWidth, wireNumbers } from '../../lib/elec/wiring'
import { N_, t as tr } from '../../lib/i18n'

const nodeTypes = { elec: ElecNode, elecframe: ElecFrameNode }
const edgeTypes = { wire: WireEdge }
const FRAME_NODE = 'elec-frame'
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
    group: N_('Alimentación'),
    items: [
      ...Object.keys(POTENTIALS).map((p) => ({ key: `rail:${p}`, type: 'rail', label: N_('Embarrado {potencial}'), vars: { potencial: p }, preset: { potential: p } })),
      { key: 'transformer', type: 'transformer', label: N_('Transformador de mando'), preset: {} },
      { key: 'mainswitch', type: 'mainswitch', label: N_('Interruptor general'), preset: {}, prefix: 'Q' },
      { key: 'psu', type: 'psu', label: N_('Fuente 24 V DC'), preset: {} },
      { key: 'phasemonitor', type: 'phasemonitor', label: N_('Relé de control de fases'), preset: {} },
    ],
  },
  {
    group: N_('Bornas'),
    items: [
      { key: 'terminal', type: 'terminal', label: N_('Borna (regleta -X)'), preset: { kind: 'normal' } },
      { key: 'terminal:pe', type: 'terminal', label: N_('Borna de tierra (PE)'), preset: { kind: 'pe' } },
    ],
  },
  {
    group: N_('Seguridad'),
    items: [
      { key: 'safetyrelay', type: 'safetyrelay', label: N_('Relé de seguridad'), preset: {} },
      { key: 'emergency:2', type: 'emergency', label: N_('Seta de doble canal'), preset: { channels: 2 } },
      { key: 'doorswitch', type: 'doorswitch', label: N_('Interruptor de puerta'), preset: {} },
      { key: 'lightcurtain', type: 'lightcurtain', label: N_('Cortina fotoeléctrica'), preset: {} },
    ],
  },
  {
    group: N_('Vivienda'),
    items: [
      { key: 'changeover', type: 'changeover', label: N_('Conmutador'), preset: {} },
      { key: 'crossover', type: 'crossover', label: N_('Cruzamiento'), preset: {} },
      { key: 'coil:impulse', type: 'coil', label: N_('Telerruptor'), preset: { kind: 'impulse' }, prefix: 'KL' },
      { key: 'coil:stair', type: 'coil', label: N_('Minutero de escalera'), preset: { kind: 'tof', preset: 30 }, prefix: 'KT' },
      { key: 'lamp:home', type: 'lamp', label: N_('Lámpara (punto de luz)'), preset: { color: 'amber' }, prefix: 'E' },
      { key: 'socket', type: 'socket', label: N_('Base de enchufe'), preset: {} },
    ],
  },
  {
    group: N_('Neumática'),
    items: [
      { key: 'airsource', type: 'airsource', label: N_('Fuente de aire comprimido'), preset: {} },
      { key: 'frl', type: 'frl', label: N_('Unidad de mantenimiento'), preset: {} },
      { key: 'pvalve:52', type: 'pvalve', label: N_('Válvula 5/2 monoestable (bobina y muelle)'), preset: { ways: '5/2' } },
      { key: 'pvalve:52b', type: 'pvalve', label: N_('Válvula 5/2 biestable (dos bobinas)'), preset: { ways: '5/2', bistable: true } },
      { key: 'pvalve:32', type: 'pvalve', label: N_('Válvula 3/2 NC (bobina y muelle)'), preset: { ways: '3/2' } },
      { key: 'pvalve:53', type: 'pvalve', label: N_('Válvula 5/3 centro cerrado'), preset: { ways: '5/3', center: 'closed', bistable: true } },
      { key: 'pvalve:32m', type: 'pvalve', label: N_('Válvula 3/2 de pulsador'), preset: { ways: '3/2', manual: 'button' } },
      { key: 'pvalve:52m', type: 'pvalve', label: N_('Válvula 5/2 de palanca'), preset: { ways: '5/2', manual: 'lever' } },
      { key: 'pcylinder', type: 'pcylinder', label: N_('Cilindro de doble efecto'), preset: { acting: 'double' } },
      { key: 'pcylinder:1', type: 'pcylinder', label: N_('Cilindro de simple efecto'), preset: { acting: 'single' } },
      { key: 'throttle', type: 'throttle', label: N_('Regulador de caudal'), preset: {} },
    ],
  },
  ...['Mando', 'Potencia', N_('Autómata')].map((group) => ({
    group,
    items: Object.entries(ELEC_TYPES)
      .filter(([type, t]) => t.group === group && !['mainswitch', 'psu', 'phasemonitor', 'terminal'].includes(type))
      .flatMap(([type, t]) =>
        type === 'coil'
          ? [
              { key: 'coil:contactor', type, label: N_('Contactor (bobina)'), preset: { kind: 'contactor' } },
              { key: 'coil:relay', type, label: N_('Relé auxiliar (bobina)'), preset: { kind: 'relay' }, prefix: 'KA' },
              { key: 'coil:ton', type, label: N_('Temporizador a la conexión'), preset: { kind: 'ton', preset: 3 }, prefix: 'KT' },
              { key: 'coil:tof', type, label: N_('Temporizador a la desconexión'), preset: { kind: 'tof', preset: 3 }, prefix: 'KT' },
              { key: 'coil:flash', type, label: N_('Relé intermitente'), preset: { kind: 'flash', preset: 1 }, prefix: 'KF' },
            ]
          : type === 'limit'
            ? [
                { key: 'limit', type, label: N_('Final de carrera'), preset: { kind: 'limit' } },
                { key: 'limit:float', type, label: N_('Flotador (nivel)'), preset: { kind: 'float' } },
                { key: 'limit:pressure', type, label: N_('Presostato'), preset: { kind: 'pressure' } },
                { key: 'limit:thermostat', type, label: N_('Termostato'), preset: { kind: 'thermostat' } },
              ]
          : [{ key: type, type, label: t.label, preset: {} }],
      ),
  })),
]
const HINTS = {
  rail: N_('Embarrado: da su potencial (fase, neutro, 24 V…) a lo que se conecta a sus tomas.'),
  pushbutton: N_('Pulsador NA o NC. Enlázalo con un pulsador de la planta para que lo accione.'),
  switch: N_('Interruptor o selector: se queda en su posición.'),
  emergency: N_('Seta de emergencia (NC, con enclavamiento).'),
  limit: N_('Final de carrera o detector: lo acciona la planta (enlázalo con su señal).'),
  contact: N_('Contacto auxiliar de un contactor, relé, temporizador o relé térmico (por su identificador).'),
  coil: N_('Bobina A1-A2. Sus contactos llevan su mismo identificador (-KM1).'),
  valve: N_('Electroválvula: enlázala con la orden del cilindro de la planta.'),
  lamp: N_('Piloto de señalización.'),
  breaker: N_('Magnetotérmico: protege; salta si hay un cortocircuito aguas abajo.'),
  motorprotector: N_('Guardamotor: magnetotérmico con protección térmica.'),
  thermal: N_('Relé térmico: sus contactos 95-96 (NC) y 97-98 (NA) cambian al dispararse.'),
  maincontacts: N_('Contactos principales (1-2, 3-4, 5-6) de un contactor.'),
  motor3: N_('Motor trifásico U V W: el orden de las fases da el sentido de giro.'),
  motor6: N_('Motor con las seis puntas: arranque estrella-triángulo.'),
  motor1: N_('Motor monofásico: principal U1-U2 y auxiliar Z1-Z2 con condensador. Sin el auxiliar no arranca (zumba); para invertir el giro se cambia la conexión del auxiliar.'),
  dahlander: N_('Motor Dahlander: lenta (triángulo) alimentando 1U-1V-1W; rápida (doble estrella) alimentando 2U-2V-2W con 1U-1V-1W puenteados. Nunca las dos a la vez.'),
  motor2w: N_('Motor de dos devanados separados: lenta por 1U-1V-1W, rápida por 2U-2V-2W. Nunca los dos a la vez.'),
  plc: N_('Autómata: entradas I (con 1M a M) y salidas Q por relé (1L común).'),
  selector3: N_('Conmutador de 3 posiciones: en 1 cierra 13-14 y en 2, 23-24 (p. ej. manual / 0 / automático).'),
  sensor3: N_('Detector de proximidad de 3 hilos: BN (+), BU (−) y BK (salida). PNP da + a la entrada; NPN, −. Necesita su alimentación.'),
  counter: N_('Contador: cuenta los impulsos en A1-A2; al llegar a la preselección cambian sus contactos. R1-R2 lo pone a cero.'),
  buzzer: N_('Timbre o zumbador: suena mientras tiene tensión.'),
  fuse: N_('Fusible (en seccionador portafusibles): se funde con un cortocircuito; se repone con un clic. También se abre a mano.'),
  rcd: N_('Diferencial: salta con una derivación a tierra (fase con PE), no con un cortocircuito fase-neutro. Botón T de prueba.'),
  transformer: N_('Transformador de mando (230/24 V): el secundario S1-S2 es un circuito aparte, con tensión mientras el primario la tiene.'),
  changeover: N_('Conmutador de vivienda: el común C pasa de 1 a 2. Dos conmutadores: encender desde dos sitios.'),
  crossover: N_('Cruzamiento: une A1-B1 y A2-B2 o los cruza. Entre dos conmutadores: encender desde tres o más sitios.'),
  socket: N_('Base de enchufe (fase, neutro y tierra).'),
  terminal: N_('Borna de la regleta: une el cable de dentro del cuadro con el de fuera (campo). Se numeran solas: -X1:1, -X1:2…'),
  mainswitch: N_('Interruptor general (seccionador de corte en carga): corta toda la máquina; se puede bloquear con candado para el mantenimiento.'),
  psu: N_('Fuente de alimentación: con 230 V~ en L-N da 24 V DC (L+ y M) para el mando, los detectores y el autómata.'),
  phasemonitor: N_('Relé de control de fases: su contacto (-KF1) cierra solo con las tres fases presentes y en orden L1-L2-L3 (evita el giro al revés).'),
  safetyrelay: N_('Relé de seguridad: con los dos canales cerrados (S11-S12 y S21-S22, o salidas OSSD) y el rearme S33-S34, cierra 13-14 y 23-24. Si un canal abre, para; vuelve solo con un nuevo rearme.'),
  doorswitch: N_('Interruptor de puerta de seguridad: dos contactos NC que abren al abrir el resguardo.'),
  lightcurtain: N_('Cortina fotoeléctrica: libre y alimentada, sus salidas OSSD1 y OSSD2 dan +24 V; al cortar el haz, se apagan.'),
  vfd: N_('Variador de frecuencia: DI1 adelante, DI2 atrás, DI3 2ª velocidad, AI1 consigna 0-10 V (manda sobre las velocidades). R1-R2 cierra con el motor en marcha. Sus +24/GND alimentan las entradas.'),
  softstarter: N_('Arrancador suave: con A1-A2 alimentado sube la tensión del motor en una rampa; su contacto (por su identificador) cierra al acabarla.'),
  brake: N_('Freno del motor (electrofreno): suelta con tensión y frena sin ella. Se conecta a los bornes del motor o con su propio contactor.'),
  beacon: N_('Columna de señalización: rojo (X1), ámbar (X2), verde (X3) y zumbador (X4) con el común X0.'),
  litbutton: N_('Pulsador luminoso: contacto 13-14 y piloto X1-X2 en el mismo aparato.'),
  transmitter: N_('Transmisor analógico: 4-20 mA a 2 hilos (+ a 24 V, − a la entrada) o 0-10 V a 3 hilos. Enlázalo con la analógica de la planta (nivel, temperatura…).'),
  potentiometer: N_('Potenciómetro de consigna: su cursor W da de 0 a 10 V (p. ej. a la entrada AI1 de un variador).'),
  airsource: N_('Fuente de aire comprimido (compresor): da presión a lo que se une a ella con tubos.'),
  frl: N_('Unidad de mantenimiento (filtro, regulador y lubricador) con llave de paso: al simular, un clic corta o da el aire.'),
  pvalve: N_('Válvula distribuidora: la bobina 14 es una electroválvula del esquema (-Y1); sin bobina 12, vuelve con su muelle (monoestable); con las dos, se queda donde está (biestable, memoria).'),
  pcylinder: N_('Cilindro: sale con presión en A y escape en B. Sus detectores (a0 dentro, a1 fuera) accionan los finales de carrera del esquema enlazados con esa señal.'),
  throttle: N_('Regulador de caudal unidireccional: frena el cilindro (mejor en el escape). Al simular, un clic lo abre más.'),
}

// Referencia de cada aparato (identificador IEC 81346 y bornes).
const NORMS = {
  rail: N_('Colores IEC 60445: L1 marrón, L2 negro, L3 gris, N azul, PE verde-amarillo.'),
  pushbutton: N_('Identificador -S · bornes 13-14 (NA), 11-12 (NC).'),
  switch: N_('Identificador -S · bornes 13-14 (NA), 11-12 (NC).'),
  emergency: N_('Identificador -S · NC 11-12 de apertura forzada (IEC 60947-5-5).'),
  limit: N_('Identificador -B (detectores) · 13-14 / 11-12.'),
  contact: N_('Lleva el identificador de su aparato · 13-14, 23-24… (NA); 11-12, 21-22… (NC); térmico 95-96 / 97-98.'),
  coil: N_('Contactor -KM, relé -KA, temporizador -KT · bobina A1-A2.'),
  valve: N_('Identificador -Y (válvula) · A1-A2.'),
  lamp: N_('Identificador -H (señalización) · X1-X2.'),
  breaker: N_('Identificador -Q · polos 1-2, 3-4, 5-6.'),
  motorprotector: N_('Identificador -Q · polos 1-2, 3-4, 5-6.'),
  thermal: N_('Identificador -F · polos 1-2, 3-4, 5-6; contactos 95-96 (NC) y 97-98 (NA).'),
  maincontacts: N_('Lleva el identificador del contactor (-KM) · 1-2, 3-4, 5-6.'),
  motor3: N_('Identificador -M · bornes U, V, W.'),
  motor6: N_('Identificador -M · U1 V1 W1 / U2 V2 W2.'),
  motor1: N_('Identificador -M · principal U1-U2, auxiliar Z1-Z2 (IEC 60034-8); condensador -C.'),
  dahlander: N_('Identificador -M · 1U 1V 1W (lenta) / 2U 2V 2W (rápida), IEC 60034-8.'),
  motor2w: N_('Identificador -M · 1U 1V 1W / 2U 2V 2W, IEC 60034-8.'),
  plc: N_('Identificador -A · entradas I con común 1M; salidas por relé Q con común 1L.'),
  selector3: N_('Identificador -S · 13-14 (posición 1) y 23-24 (posición 2).'),
  sensor3: N_('Identificador -B · cables BN marrón (+), BU azul (−), BK negro (salida), IEC 60947-5-2.'),
  counter: N_('Identificador -KC · A1-A2 (impulsos), R1-R2 (puesta a cero).'),
  buzzer: N_('Identificador -H · X1-X2.'),
  fuse: N_('Identificador -F · 1-2 (3-4, 5-6).'),
  rcd: N_('Identificador -Q · fase 1-2, neutro 3-4; 30 mA en viviendas (REBT ITC-BT-25).'),
  transformer: N_('Identificador -T · primario P1-P2, secundario S1-S2 (24 V~: muy baja tensión de seguridad).'),
  changeover: N_('Identificador -S · común C, viajeros 1 y 2.'),
  crossover: N_('Identificador -S · A1 A2 / B1 B2.'),
  socket: N_('Identificador -X · L, N y PE.'),
  terminal: N_('Regleta -X1, borna :n (IEC 81346 / IEC 60947-7-1); las de tierra, verde-amarillo.'),
  mainswitch: N_('Identificador -Q0 · obligatorio en toda máquina (IEC 60204-1, 5.3), con bloqueo.'),
  psu: N_('Identificador -G · L, N / L+, M (muy baja tensión de protección, PELV).'),
  phasemonitor: N_('Identificador -KF · L1, L2, L3.'),
  safetyrelay: N_('Identificador -KS · ISO 13849-1: categoría 3 / PL d con doble canal y contactores redundantes.'),
  doorswitch: N_('Identificador -B · ISO 14119 (dispositivos de enclavamiento de resguardos).'),
  lightcurtain: N_('Identificador -B · IEC 61496 (equipos de protección electrosensibles).'),
  vfd: N_('Identificador -T · L1-L3 / U-V-W; mando DI1-DI3, AI1 (0-10 V), relé R1-R2.'),
  softstarter: N_('Identificador -T · 1L1-3L2-5L3 / 2T1-4T2-6T3 (aquí L1-L3 / T1-T3), mando A1-A2.'),
  brake: N_('Identificador -MB · A1-A2.'),
  beacon: N_('Identificador -P · colores IEC 60204-1 (rojo: peligro, ámbar: anormal, verde: normal).'),
  litbutton: N_('Identificador -S · 13-14 y X1-X2.'),
  transmitter: N_('Identificador -B · 4-20 mA (2 hilos) o 0-10 V (3 hilos).'),
  potentiometer: N_('Identificador -R · cursor W (0-10 V).'),
  airsource: N_('ISO 1219-1 (triángulo blanco: neumática) · identificación ISO 1219-2: 0P1.'),
  frl: N_('ISO 1219-1, símbolo simplificado · 0Z1 · conexiones 1 (entrada) y 2 (salida).'),
  pvalve: N_('ISO 1219-1 · conexiones ISO 5599: 1 presión, 2 y 4 utilización, 3 y 5 escape; pilotajes 14 (abre 1→4) y 12 (abre 1→2) · 1V1.'),
  pcylinder: N_('ISO 1219-1 · ISO 1219-2 lo identifica 1A1; aquí, con letra (A, B…) para escribir las secuencias A+ B+ A− B−.'),
  throttle: N_('ISO 1219-1: estrangulación regulable con antirretorno en paralelo · 1V2.'),
}

// Bobinas de una válvula nueva: las primeras electroválvulas -Y libres (las que no mueve ya otra
// válvula), existan ya en el esquema o no; las de accionamiento manual no llevan bobina.
function solenoidsFor(components, preset) {
  if (preset.manual && preset.manual !== 'none') return { sol14: '', sol12: '' }
  const taken = new Set(components.filter((c) => c.type === 'pvalve').flatMap((c) => [c.sol14, c.sol12]).filter(Boolean))
  const pick = () => {
    const free = components.filter((c) => c.type === 'valve' && c.tag && !taken.has(c.tag)).map((c) => c.tag)
    const tag = free[0] ?? nextTag([...components, ...[...taken].map((t) => ({ tag: t }))], 'Y')
    taken.add(tag)
    return tag
  }
  const sol14 = pick()
  return { sol14, sol12: preset.bistable ? pick() : '' }
}

// Vista previa de un aparato de la paleta: su símbolo (con sus bornes) tal como queda en el esquema.
function ElecPreview({ item }) {
  const c = { id: 'preview', type: item.type, x: 0, y: 0, tag: ELEC_TYPES[item.type].letterTag ? 'A' : `${item.prefix ?? ELEC_TYPES[item.type].prefix}1`, ...ELEC_TYPES[item.type].defaults, ...item.preset }
  if (c.type === 'pvalve' && (c.manual ?? 'none') === 'none') Object.assign(c, { sol14: 'Y1', ...(c.bistable ? { sol12: 'Y2' } : {}) })
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

function Inner({ schematic, onChange, elecState, onAction, variables = [], buildVariables, scene, simulating, onHistory, onActivate, maximized, onToggleMaximize, onClose, titleInfo = {}, exportProps = {} }) {
  const sch = schematic ?? EMPTY
  const allComponents = useMemo(() => sch.components ?? [], [sch.components])
  const allWires = useMemo(() => sch.wires ?? [], [sch.wires])
  // Hojas: se dibuja (y se edita) la actual; la simulación tiene en cuenta todas.
  const sheets = elecSheetsOf(sch)
  const [sheetChoice, setSheetChoice] = useState(sheets[0].id)
  const sheetId = sheets.some((s) => s.id === sheetChoice) ? sheetChoice : sheets[0].id
  const components = useMemo(() => allComponents.filter((c) => sheetOfComponent(sch, c) === sheetId), [allComponents, sch, sheetId])
  const wires = useMemo(() => {
    const here = new Set(components.map((c) => c.id))
    return allWires.filter((w) => here.has(w.from.c) && here.has(w.to.c))
  }, [allWires, components])
  // Lo de las otras hojas no se toca al guardar los cambios de esta.
  const others = useMemo(() => allComponents.filter((c) => sheetOfComponent(sch, c) !== sheetId), [allComponents, sch, sheetId])
  const otherWires = useMemo(() => {
    const here = new Set(components.map((c) => c.id))
    return allWires.filter((w) => !(here.has(w.from.c) && here.has(w.to.c)))
  }, [allWires, components])
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
  const [exporting, setExporting] = useState(null) // fuente del diálogo de exportación
  // Herramientas al simular: polímetro (dos puntas) y averías (menú sobre aparato o cable).
  const [tool, setTool] = useState(null) // null | 'meter' | 'faults'
  const [probes, setProbes] = useState([]) // ['componente:borne', …] (2 como mucho)
  const [faultMenu, setFaultMenu] = useState(null) // { id, wire, x, y }
  if (!elecState && (tool || probes.length)) {
    setTool(null)
    setProbes([])
  }
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
    // next.components / next.wires son los de la hoja actual (lo nuevo, a esta hoja).
    const merged = { ...sch, ...next }
    if (next.components) merged.components = [...others, ...next.components.map((c) => (c.sheet ? c : { ...c, sheet: sheetId }))]
    if (next.wires) merged.wires = [...otherWires, ...next.wires]
    onChange(merged)
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
    const strip = item.type === 'terminal' ? ([...components].reverse().find((o) => o.type === 'terminal')?.tag ?? 'X1') : null
    const c = {
      id: newId('e'),
      type: item.type,
      x,
      y,
      tag: strip ?? newTag(allComponents, item.type, item.prefix ?? t.prefix),
      ...t.defaults,
      ...(t.defaults?.text ? { text: tr(t.defaults.text) } : {}),
      ...item.preset,
      ...(item.type === 'pvalve' ? solenoidsFor(allComponents, item.preset) : {}),
      ...(ref ? { ref } : {}),
      ...(strip ? { n: nextTerminalNumber(components, strip) } : {}),
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
      const tag = c.type === 'contact' || c.type === 'maincontacts' || c.type === 'rail' ? c.tag : ELEC_TYPES[c.type]?.letterTag ? newTag(all, c.type) : nextTag(all, (c.tag ?? '').replace(/\d+$/, '') || prefix)
      const copyC = { ...c, id, x: c.x + 40, y: c.y + 40, tag, sheet: sheetId }
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
  const joints = useMemo(() => findJunctions(sch), [sch])
  const wireLabels = useMemo(() => (sch.wireNumbers ? wireNumbers(sch) : {}), [sch])
  // Referencias cruzadas con hoja y columna (de todo el esquema, no solo de esta hoja).
  // Polímetro: cada clic en un borne pone una punta (la tercera vuelve a empezar).
  const probe = useCallback((c, t) => setProbes((p) => (p.length >= 2 ? [`${c}:${t}`] : [...p.filter((x) => x !== `${c}:${t}`), `${c}:${t}`])), [])
  const openFaultMenu = useCallback((id, x, y, wire = false) => setFaultMenu({ id, x, y, wire }), [])
  const xrefMap = useMemo(() => crossReferenceMap(sch, contactNumbers(allComponents)), [sch, allComponents])
  const timers = useMemo(() => new Set(components.filter((c) => c.type === 'coil' && (c.kind === 'ton' || c.kind === 'tof')).map((c) => c.tag)), [components])
  const act = useCallback((id, action) => onAction?.(id, action), [onAction])
  const nodes = useMemo(
    () =>
      components.map((c) => ({
        id: c.id,
        type: 'elec',
        position: dragPos[c.id] ?? { x: c.x, y: c.y },
        data: {
          c,
          view,
          numbers: numbers[c.id],
          xref: xrefMap.byTag[c.tag],
          where: xrefMap.ownerOf[c.id],
          timed: c.type === 'contact' && timers.has(c.ref),
          mode,
          onAction: act,
          junctions: Object.fromEntries(Object.keys(joints).filter((k) => k.startsWith(`${c.id}:`)).map((k) => [k.slice(c.id.length + 1), true])),
          tool: mode === 'use' ? tool : null,
          probes: probes.filter((p) => p.startsWith(`${c.id}:`)).map((p) => p.slice(c.id.length + 1)),
          firstProbe: probes[0],
          onProbe: probe,
          onFaultMenu: openFaultMenu,
        },
        selected: selected.includes(c.id),
        draggable: mode === 'edit',
        selectable: mode === 'edit',
        connectable: mode === 'edit',
        zIndex: c.type === 'rail' ? 0 : 1,
        // Tamaño conocido: sin esperar a medirlo (si no, React Flow oculta los nodos nuevos que le
        // llegan en cada paso de la simulación hasta volver a medirlos).
        measured: (({ w, h }) => ({ width: w, height: h }))(sizeOf(c)),
      })),
    [components, dragPos, view, numbers, xrefMap, timers, mode, act, selected, joints, tool, probes, probe, openFaultMenu],
  )
  // Marco de la hoja (detrás de todo).
  const cols = frameColumns(sch)
  const frameNode = useMemo(
    () =>
      sch.frame
        ? [
            {
              id: FRAME_NODE,
              type: 'elecframe',
              position: { x: 0, y: -FRAME_TOP },
              data: {
                cols,
                info: { ...titleInfo, sheet: sheets.find((s) => s.id === sheetId)?.name, index: sheets.findIndex((s) => s.id === sheetId) + 1, count: sheets.length },
              },
              draggable: false,
              selectable: false,
              connectable: false,
              focusable: false,
              zIndex: -1,
              measured: { width: cols * COLUMN_WIDTH, height: FRAME_HEIGHT + FRAME_TOP },
            },
          ]
        : [],
    [sch.frame, cols, titleInfo, sheets, sheetId],
  )
  const allNodes = useMemo(() => [...frameNode, ...nodes], [frameNode, nodes])
  const pneumaticIds = useMemo(() => new Set(components.filter((c) => isPneumatic(c.type)).map((c) => c.id)), [components])
  const edges = useMemo(
    () =>
      wires.map((w) => {
        const p = view?.pot?.[`${w.from.c}:${w.from.t}`]
        const sel = selectedWires.includes(w.id)
        if (pneumaticIds.has(w.from.c)) {
          // Tubo de aire: azul con presión; gris a escape o sin aire.
          const air = view?.pneu?.ports?.[`${w.from.c}:${w.from.t}`]
          return {
            id: w.id,
            source: w.from.c,
            sourceHandle: w.from.t,
            target: w.to.c,
            targetHandle: w.to.t,
            type: 'wire',
            selected: sel,
            selectable: mode === 'edit',
            style: {
              stroke: view?.faults?.[w.id] ? '#dc2626' : sel ? '#2563eb' : air === 'P' ? '#0284c7' : '#64748b',
              strokeWidth: air === 'P' ? 2.6 : 1.6,
              ...(view?.faults?.[w.id] ? { strokeDasharray: '6 4' } : {}),
            },
            data: { air: air ?? null, bend: w.bend, bendX: w.bendX },
          }
        }
        return {
          id: w.id,
          source: w.from.c,
          sourceHandle: w.from.t,
          target: w.to.c,
          targetHandle: w.to.t,
          type: 'wire',
          selected: sel,
          selectable: mode === 'edit',
          // Al simular, el color de su potencial (con tensión); si no, el que se le haya dado.
          style: {
            stroke: view?.faults?.[w.id] ? '#dc2626' : sel ? '#2563eb' : p ? potentialColor(p) : (WIRE_COLORS[w.color]?.stroke ?? potentialColor('')),
            strokeWidth: Math.max(sectionWidth(w.section), p ? 2.4 : 0),
            ...(view?.faults?.[w.id] ? { strokeDasharray: '6 4' } : {}),
          },
          ...(wireLabels[w.id]
            ? {
                label: wireLabels[w.id],
                labelStyle: { fontSize: 9, fontFamily: 'ui-monospace, monospace', fill: '#0f172a' },
                labelBgStyle: { fill: '#ffffff' },
                labelBgPadding: [2, 1],
              }
            : {}),
          data: { potential: p ?? null, bend: w.bend, bendX: w.bendX },
        }
      }),
    [wires, view, selectedWires, mode, wireLabels, pneumaticIds],
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
    // Tubos de aire entre conexiones neumáticas; cables entre bornes eléctricos.
    const isAir = (id, t) => Boolean(terminalsOf(components.find((c) => c.id === id) ?? {}).find((x) => x.id === t)?.pneu)
    if (isAir(source, sourceHandle) !== isAir(target, targetHandle)) {
      setMessage({ kind: 'warn', text: tr('Un tubo de aire solo une conexiones neumáticas (y un cable, bornes eléctricos).') })
      return
    }
    save({ wires: [...wires, { id: newId('w'), from: { c: source, t: sourceHandle }, to: { c: target, t: targetHandle } }] })
  }

  const generate = () => {
    // Un solo autómata: si ya está (p. ej. en los ejemplos, que traen su esquema), no se duplica.
    if (allComponents.some((c) => c.type === 'plc')) {
      setMessage({ kind: 'warn', text: tr('El esquema ya tiene su autómata y sus conexiones. Para volver a crearlas, borra antes el autómata y sus aparatos.') })
      return
    }
    const vars = buildVariables?.() ?? []
    const withAddress = vars.filter((v) => (v.type === 'input' || v.type === 'output') && v.address?.trim())
    if (!withAddress.length) {
      setMessage({ kind: 'warn', text: tr('Ninguna entrada ni salida tiene dirección: asígnalas en Variables («Rellenar vacías»).') })
      return
    }
    const r = generatePlcWiring(vars, scene, { components, wires })
    save({ components: [...components, ...r.components], wires: [...wires, ...r.wires], enabled: true })
    setMessage({
      kind: r.skipped.length ? 'warn' : 'ok',
      text: tr('Conexiones del autómata creadas ({n} aparatos) y conectadas con el autómata y la planta.', { n: r.devices }) + (r.skipped.length ? ' ' + tr('Sin borne: {lista}.', { lista: r.skipped.join(', ') }) : ''),
    })
    requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15 })))
  }

  const selectedC = selected.length === 1 ? components.find((c) => c.id === selected[0]) : null
  const short = view?.short
  // Hay autómata o aparatos enlazados con la planta, pero el esquema no está conectado.
  // (Los detectores de los cilindros neumáticos, a0 / a1…, son del propio esquema: no cuentan.)
  const ownSignals = new Set(allComponents.filter((c) => c.type === 'pcylinder').flatMap((c) => cylinderSignals(c.tag)))
  const hiddenWarning = simulating && !sch.enabled && components.some((c) => c.type === 'plc' || (c.signal && !ownSignals.has(c.signal)))

  return (
    <section
      aria-label={tr('Esquema eléctrico')}
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
          aria-label={tr('Ancho del esquema')}
          title={tr('Arrastra para cambiar el ancho del esquema (doble clic: mitad y mitad)')}
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
          <Zap size={14} />{' '}{tr('Esquema eléctrico')}
        </span>
        {simulating && (
          <div className="flex rounded-md border border-slate-300 p-0.5" role="radiogroup" aria-label={tr('Modo del esquema')}>
            {[
              ['use', tr('Usar'), Hand],
              ['edit', tr('Editar'), MousePointer2],
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
        {elecState && mode === 'use' && (
          <>
            {[
              ['meter', tr('Polímetro'), Gauge, tr('Medir la tensión entre dos bornes: pulsa un borne (punta roja) y otro (punta negra)')],
              ['faults', tr('Averías'), Wrench, tr('Provocar averías: pulsa un aparato o un cable; o una avería al azar, oculta, para buscarla')],
            ].map(([id, label, Icon, title]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tool === id}
                title={title}
                onClick={() => {
                  setTool((t) => (t === id ? null : id))
                  setProbes([])
                  setFaultMenu(null)
                }}
                className={`flex items-center gap-1 rounded border px-2 py-0.5 ${tool === id ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-300 hover:bg-slate-100'}`}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </>
        )}
        <label
          className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5"
          title={tr('El esquema se simula siempre. Conectado, el autómata y la planta usan sus cables: las entradas del autómata son las de sus bornes, sus salidas cierran los bornes Q y la planta se mueve con las bobinas y motores enlazados')}
        >
          <input type="checkbox" checked={Boolean(sch.enabled)} onChange={(e) => save({ enabled: e.target.checked })} />
          {tr('Conectar con el autómata y la planta')}
        </label>
        <button
          type="button"
          onClick={generate}
          title={tr('Crea el autómata con un aparato en cada entrada y salida de la tabla de variables, ya cableado')}
          aria-label={tr('Conexiones del autómata')}
          className="flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-0.5 text-blue-800 hover:bg-blue-100"
        >
          <WandSparkles size={12} /> <span className="hidden @2xl:inline">{tr('Conexiones del autómata')}</span>
          <span className="@2xl:hidden">{tr('Autómata')}</span>
        </button>
        <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5" title={tr('Marco de la hoja: columnas numeradas (para las referencias cruzadas /hoja.columna) y cajetín')}>
          <input type="checkbox" checked={Boolean(sch.frame)} onChange={(e) => save({ frame: e.target.checked })} />
          {tr('Marco')}
        </label>
        <label className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5" title={tr('Un número por red equipotencial (los de los embarrados, su potencial)')}>
          <input type="checkbox" checked={Boolean(sch.wireNumbers)} onChange={(e) => save({ wireNumbers: e.target.checked })} />
          {tr('Nº de cable')}
        </label>
        {mode === 'edit' && (
          <select
            value=""
            aria-label={tr('Insertar montaje')}
            title={tr('Montajes clásicos listos para simular y modificar')}
            onChange={(e) => {
              const t = ELEC_TEMPLATES.find((x) => x.id === e.target.value)
              if (!t) return
              const r = insertTemplate(t, { components }, allComponents)
              save({ components: [...components, ...r.components], wires: [...wires, ...r.wires] })
              setMessage({ kind: 'ok', text: `${tr(t.title)}: ${tr(t.description)}` })
              requestAnimationFrame(() => requestAnimationFrame(() => fitView({ padding: 0.15 })))
            }}
            className="rounded border border-slate-300 px-1 py-0.5"
          >
            <option value="">{tr('Insertar montaje…')}</option>
            {ELEC_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {tr(t.title)}
              </option>
            ))}
          </select>
        )}
        <span className="ml-auto" />
        <button
          type="button"
          onClick={() => {
            const sheetName = sheets.find((s) => s.id === sheetId)?.name ?? ''
            setExporting(
              svgMarkupSource(
                async () => {
                  const { renderToStaticMarkup } = await import('react-dom/server')
                  return renderToStaticMarkup(<ElecStatic schematic={sch} sheetId={sheetId} info={titleInfo} />)
                },
                { kind: 'esquema', title: `${titleInfo.project?.trim() || tr('Esquema eléctrico')} · ${sheetName}`, name: (ext) => fileName(ext, 'esquema') },
              ),
            )
          }}
          title={tr('Exportar esta hoja del esquema (PDF vectorial, PNG o SVG)')}
          aria-label={tr('Exportar el esquema')}
          className="rounded p-1 hover:bg-slate-100"
        >
          <Download size={14} />
        </button>
        <button type="button" onClick={() => zoomOut()} title={tr('Alejar')} aria-label={tr('Alejar')} className="rounded p-1 hover:bg-slate-100">
          <Minus size={13} />
        </button>
        <span className="w-11 text-center whitespace-nowrap tabular-nums">{Math.round(zoom * 100)} %</span>
        <button type="button" onClick={() => zoomIn()} title={tr('Acercar')} aria-label={tr('Acercar')} className="rounded p-1 hover:bg-slate-100">
          <Plus size={13} />
        </button>
        <button type="button" onClick={() => fitView({ padding: 0.15 })} title={tr('Ajustar la vista')} aria-label={tr('Ajustar la vista')} className="rounded p-1 hover:bg-slate-100">
          <Scan size={14} />
        </button>
        <button type="button" onClick={onToggleMaximize} title={maximized ? tr('Vista dividida') : tr('Pantalla completa')} className="rounded p-1 hover:bg-slate-100">
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button type="button" onClick={onClose} title={tr('Cerrar el esquema')} className="rounded p-1 hover:bg-slate-100">
          <X size={14} />
        </button>
      </header>
      {elecState && mode === 'use' && tool === 'meter' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1 text-xs" role="status" aria-label={tr('Lectura del polímetro')}>
          <Gauge size={13} />
          {probes.length < 2 ? (
            <span className="text-slate-600">{probes.length ? tr('Pulsa el segundo borne (punta negra).') : tr('Pulsa un borne para poner la punta roja.')}</span>
          ) : (
            (() => {
              const [a, b] = probes
              const reading = voltageBetween(view?.pot?.[a], view?.pot?.[b])
              const analog = view?.analog?.[a] ?? view?.analog?.[b]
              const name = (k) => {
                const [cid, t] = k.split(':')
                const c = allComponents.find((x) => x.id === cid)
                return `${showTag(c?.tag ?? c?.ref ?? '') || ELEC_TYPES[c?.type]?.label || ''}:${t}`
              }
              return (
                <span>
                  <span className="text-red-700">{name(a)}</span> ↔ <span className="font-medium">{name(b)}</span>:{' '}
                  <strong className="font-mono text-sm">{reading.text}</strong>
                  {analog && <span className="ml-2 font-mono text-blue-700">{tr('(señal: {valor} {unidad})', { valor: analog.value, unidad: analog.unit })}</span>}
                </span>
              )
            })()
          )}
        </div>
      )}
      {elecState && mode === 'use' && tool === 'faults' && (
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-red-50/60 px-3 py-1 text-xs" aria-label={tr('Averías')}>
          <Wrench size={13} />
          <span className="text-slate-600">{tr('Pulsa un aparato o un cable para averiarlo.')}</span>
          <button type="button" onClick={() => onAction(null, 'random-fault')} className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100">
            {tr('Avería al azar (oculta)')}
          </button>
          {view?.hiddenFaults && (
            <button type="button" onClick={() => onAction(null, 'reveal')} className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100">
              {tr('Mostrar la avería')}
            </button>
          )}
          <button type="button" onClick={() => onAction(null, 'repair-all')} className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-100">
            {tr('Reparar todo')}
          </button>
          {view?.hiddenFaults && <span className="font-medium text-red-700">{tr('Hay una avería oculta: búscala con el polímetro.')}</span>}
        </div>
      )}
      {faultMenu && (
        <FaultMenu
          menu={faultMenu}
          component={allComponents.find((c) => c.id === faultMenu.id)}
          current={view?.faults?.[faultMenu.id]}
          onPick={(f) => {
            onAction(faultMenu.id, `fault:${f}`)
            setFaultMenu(null)
          }}
          onClose={() => setFaultMenu(null)}
        />
      )}
      {(short || view?.oscillating || message || hiddenWarning) && (
        <div className="space-y-0.5 border-b border-slate-200 px-3 py-1 text-xs" role="status">
          {short && (
            <p className="flex items-center gap-1 font-semibold text-red-700">
              <AlertTriangle size={13} /> {short}
            </p>
          )}
          {view?.oscillating && <p className="text-amber-700">{tr('El circuito no se estabiliza (unos relés se activan y desactivan entre sí).')}</p>}
          {hiddenWarning && (
            <p className="text-amber-700">{tr('El autómata y la planta no usan estos cables: marca «Conectar con el autómata y la planta».')}</p>
          )}
          {message && <p className={message.kind === 'ok' ? 'text-green-700' : 'text-amber-700'}>{message.text}</p>}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && (
          <nav className="w-44 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 p-1.5 text-xs" aria-label={tr('Aparatos')}>
            {PALETTE.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{tr(group)}</p>
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
                    title={tr('Arrastra al esquema (o pulsa para ponerlo en el centro)')}
                    className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-slate-100"
                  >
                    + {tr(item.label, item.vars)}
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
            nodes={allNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            // Con un manejador de clic, React Flow deja pasar el ratón a los nodos aunque (al simular)
            // no se puedan seleccionar ni arrastrar: así se pulsan los pulsadores.
            onNodeClick={() => {}}
            onEdgeClick={(e, edge) => {
              if (mode !== 'use' || tool !== 'faults') return
              e.stopPropagation()
              openFaultMenu(edge.id, e.clientX, e.clientY, true)
            }}
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
          <SheetTabs
            sheets={sheets}
            current={sheetId}
            counts={new Map(sheets.map((s) => [s.id, allComponents.filter((c) => sheetOfComponent(sch, c) === s.id).length]))}
            onSelect={(id) => {
              setSheetChoice(id)
              setSelected([])
              setSelectedWires([])
              requestAnimationFrame(() => requestAnimationFrame(() => getNodes().length && fitView({ padding: 0.15 })))
            }}
            onAdd={() => {
              const used = new Set(sheets.map((s) => s.id))
              let n = sheets.length + 1
              while (used.has(`e${n}`)) n++
              const sheet = { id: `e${n}`, name: tr('Hoja {n}', { n: sheets.length + 1 }) }
              save({ sheets: [...sheets, sheet], components: [...components] })
              setSheetChoice(sheet.id)
            }}
            onRename={(id, name) => save({ sheets: sheets.map((s) => (s.id === id ? { ...s, name } : s)) })}
            onDelete={(id) => {
              const gone = new Set(allComponents.filter((c) => sheetOfComponent(sch, c) === id).map((c) => c.id))
              const rest = sheets.filter((s) => s.id !== id)
              const h = history.current
              h.past = [...h.past.slice(-(HISTORY_LIMIT - 1)), sch]
              h.future = []
              setHistorySize({ past: h.past.length, future: 0 })
              onChange({
                ...sch,
                sheets: rest,
                // Lo que quedara sin hoja (de la primera, por defecto), a la primera que queda.
                components: allComponents.filter((c) => !gone.has(c.id)).map((c) => (c.sheet ? c : { ...c, sheet: sheets[0].id })),
                wires: allWires.filter((w) => !gone.has(w.from.c) && !gone.has(w.to.c)),
              })
              setSheetChoice(rest[0].id)
            }}
            readOnly={mode !== 'edit'}
          />
          {components.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 px-6 text-center text-sm text-slate-500">
              {tr('Añade embarrados y aparatos desde la paleta y únelos arrastrando de borne a borne, o pulsa «Conexiones del autómata» para crear el cableado del autómata desde la tabla de variables.')}
            </p>
          )}
        </div>
        {mode === 'edit' && !selectedC && selected.length === 0 && selectedWires.length === 1 && (
          <WireProperties
            key={selectedWires[0]}
            wire={wires.find((w) => w.id === selectedWires[0])}
            number={wireLabels[selectedWires[0]]}
            onChange={(patch) => save({ wires: wires.map((w) => (w.id === selectedWires[0] ? { ...w, ...patch } : w)) })}
            onDelete={removeSelected}
          />
        )}
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
          aria-label={tr('Vista previa: {elemento}', { elemento: tr(preview.item.label, preview.item.vars) })}
          className="side-panel pointer-events-none fixed z-50 w-60 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg"
          style={{ left: Math.min(preview.x + 16, window.innerWidth - 250), top: Math.min(preview.y + 12, window.innerHeight - 240) }}
        >
          <p className="mb-1 font-semibold">{tr(preview.item.label, preview.item.vars)}</p>
          <div className="paper rounded border border-slate-100 bg-white p-1">
            <ElecPreview item={preview.item} />
          </div>
          <p className="mt-1 text-slate-600">{tr(HINTS[preview.item.type])}</p>
          {NORMS[preview.item.type] && <p className="mt-0.5 text-[10px] text-slate-500">{tr(NORMS[preview.item.type])}</p>}
        </div>
      )}
      {exporting && (
        <ExportDialog source={exporting} initialFormat="pdf" fileName={(ext) => fileName(ext, 'esquema')} {...exportProps} onClose={() => setExporting(null)} />
      )}
      <p className="border-t border-slate-200 px-3 py-1 text-[11px] text-slate-500">
        {mode === 'edit'
          ? tr('Arrastra de borne a borne para cablear · rueda: zoom · arrastrar el fondo (o con la rueda pulsada): desplazar · Mayús+arrastrar: varios · Supr borra · Ctrl+C/V/D copia, pega, duplica · deshacer y rehacer: los de siempre · los cables se colorean con su potencial al simular.')
          : tr('Pulsa los pulsadores (mantén), conmuta interruptores y protecciones; los cables con tensión toman el color de su potencial.')}
      </p>
    </section>
  )
}

const field = 'mt-0.5 w-full rounded border border-slate-300 px-1.5 py-0.5'

// Menú de averías de un aparato o de un cable (junto al ratón).
function FaultMenu({ menu, component, current, onPick, onClose }) {
  const loads = ['coil', 'valve', 'lamp', 'buzzer', 'brake', 'motor3', 'motor6', 'motor1', 'dahlander', 'motor2w']
  const contacts = ['pushbutton', 'switch', 'limit', 'litbutton', 'contact', 'emergency', 'doorswitch', 'maincontacts']
  const options = menu.wire
    ? [['cut', 'Cable cortado']]
    : loads.includes(component?.type)
      ? [['open', component?.type === 'lamp' ? tr('Lámpara fundida') : component?.type?.startsWith('motor') ? tr('Motor quemado (devanado cortado)') : tr('Bobina cortada')]]
      : contacts.includes(component?.type)
        ? [
            ['open', tr('Contacto quemado (no cierra)')],
            ['welded', tr('Contacto soldado (no abre)')],
          ]
        : component?.type === 'terminal'
          ? [['open', tr('Borna floja (no hace contacto)')]]
          : []
  return (
    <div
      role="menu"
      aria-label={tr('Avería')}
      className="fixed z-50 w-60 rounded-md border border-slate-200 bg-white p-1 text-xs shadow-lg"
      style={{ left: Math.min(menu.x + 8, window.innerWidth - 250), top: Math.min(menu.y + 8, window.innerHeight - 160) }}
      onMouseLeave={onClose}
    >
      <p className="px-2 py-1 font-semibold">{menu.wire ? tr('Cable') : `${tr(ELEC_TYPES[component?.type]?.label) ?? ''} ${showTag(component?.tag ?? component?.ref ?? '')}`}</p>
      {options.length === 0 && <p className="px-2 py-1 text-slate-500">{tr('Este aparato no tiene averías simulables.')}</p>}
      {options.map(([f, label]) => (
        <button key={f} type="button" role="menuitem" onClick={() => onPick(f)} className={`block w-full rounded px-2 py-1 text-left hover:bg-red-50 ${current === f ? 'font-semibold text-red-700' : ''}`}>
          {label}
        </button>
      ))}
      {current && (
        <button type="button" role="menuitem" onClick={() => onPick('')} className="block w-full rounded px-2 py-1 text-left text-green-700 hover:bg-green-50">
          {tr('Reparar')}
        </button>
      )}
    </div>
  )
}

// Propiedades de un cable: color (IEC 60445) y sección.
function WireProperties({ wire, number, onChange, onDelete }) {
  if (!wire) return null
  return (
    <aside className="w-48 shrink-0 space-y-2 overflow-y-auto border-l border-slate-200 p-2 text-xs" aria-label={tr('Propiedades del cable')}>
      <p className="font-semibold">Cable {number ? `nº ${number}` : ''}</p>
      <label className="block">
        <span className="text-slate-500">{tr('Color')}</span>
        <select value={wire.color ?? 'auto'} onChange={(e) => onChange({ color: e.target.value === 'auto' ? undefined : e.target.value })} className={field}>
          {Object.entries(WIRE_COLORS).map(([k, v]) => (
            <option key={k} value={k}>
              {tr(v.label)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-slate-500">{tr('Sección (mm²)')}</span>
        <select value={wire.section ?? ''} onChange={(e) => onChange({ section: e.target.value || undefined })} className={field}>
          <option value="">{tr('Sin indicar')}</option>
          {WIRE_SECTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace('.', ',')}
            </option>
          ))}
        </select>
      </label>
      <p className="text-slate-500">Mando: 0,75–1 mm²; potencia de motores pequeños: 1,5–2,5 mm².</p>
      <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-red-700 hover:bg-red-50">
        <Trash2 size={12} />{' '}{tr('Eliminar el cable')}
      </button>
    </aside>
  )
}

// Propiedades del componente seleccionado.
function Properties({ c, components, variables, onChange, onDelete }) {
  const t = ELEC_TYPES[c.type]
  const isLoad = ['coil', 'valve', 'lamp', 'buzzer', 'brake', 'pcylinder'].includes(c.type) || isMotor(c.type)
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
  // Los contactos también pueden accionarlos los detectores de los cilindros neumáticos (a0, a1…).
  const cylSignals = isContact && c.type !== 'transmitter' ? components.filter((x) => x.type === 'pcylinder').flatMap((x) => cylinderSignals(x.tag)) : []
  const signalSelect = (key, label) =>
    select(key, label, [
      ['', tr('(sin enlazar)')],
      ...cylSignals.map((n) => [n, `${n} (cilindro ${n[0].toUpperCase()})`]),
      ...signals.filter((v) => !cylSignals.includes(v.name)).map((v) => [v.name, v.name]),
      ...(c[key] && !signals.some((v) => v.name === c[key]) && !cylSignals.includes(c[key]) ? [[c[key], c[key]]] : []),
    ])
  const solenoidSelect = (key, label, none) =>
    select(key, label, [
      ['', none],
      ...components.filter((x) => x.type === 'valve' && x.tag).map((x) => [x.tag, showTag(x.tag)]),
      ...(c[key] && !components.some((x) => x.type === 'valve' && x.tag === c[key]) ? [[c[key], tr('{aparato} (falta en el esquema)', { aparato: showTag(c[key]) })]] : []),
    ])

  return (
    <aside className="w-48 shrink-0 space-y-2 overflow-y-auto border-l border-slate-200 p-2 text-xs" aria-label={tr('Propiedades del aparato')}>
      <p className="font-semibold">
        {tr(t?.label)} {showTag(c.type === 'contact' || c.type === 'maincontacts' ? c.ref : c.tag)}
      </p>
      {!['rail', 'contact', 'maincontacts'].includes(c.type) && text('tag', c.type === 'terminal' ? tr('Regleta (sin el guion)') : tr('Identificador (sin el guion)'))}
      {c.type === 'terminal' && (
        <>
          {text('n', tr('Número de borna'), { type: 'number', min: 1, step: 1 })}
          {select('kind', 'Tipo', [
            ['normal', tr('De paso')],
            ['pe', tr('De tierra (PE)')],
          ])}
        </>
      )}
      {c.type === 'rail' && (
        <>
          {select('potential', 'Potencial', Object.entries(POTENTIALS).map(([k, v]) => [k, v.label]))}
          {text('length', 'Largo (px)', { type: 'number', min: 40, step: 20 })}
          {select('wires', tr('Los cables salen'), [
            ['', LOWER_RAILS.has(c.potential) ? tr('Hacia arriba (embarrado de abajo)') : tr('Hacia abajo (embarrado de arriba)')],
            ['down', 'Hacia abajo'],
            ['up', 'Hacia arriba'],
          ])}
        </>
      )}
      {c.type === 'limit' &&
        select('kind', 'Tipo', [
          ['limit', tr('Final de carrera')],
          ['float', 'Flotador (nivel)'],
          ['pressure', 'Presostato'],
          ['thermostat', 'Termostato'],
        ])}
      {c.type === 'sensor3' && (
        <>
          {select('output', 'Salida', [
            ['PNP', tr('PNP (da + a la entrada)')],
            ['NPN', tr('NPN (da − a la entrada)')],
          ])}
          {select('kind', 'Detecta', [
            ['inductive', 'Inductivo (metal)'],
            ['capacitive', 'Capacitivo'],
            ['optical', tr('Óptico')],
          ])}
        </>
      )}
      {c.type === 'counter' && text('preset', tr('Preselección (impulsos)'), { type: 'number', min: 1, step: 1 })}
      {c.type === 'emergency' &&
        select('channels', 'Canales', [
          ['1', 'Uno (11-12)'],
          ['2', 'Doble canal (11-12 y 21-22)'],
        ])}
      {c.type === 'transmitter' &&
        select('output', tr('Señal'), [
          ['4-20mA', '4-20 mA (2 hilos)'],
          ['0-10V', '0-10 V (3 hilos)'],
        ])}
      {c.type === 'pvalve' && (
        <>
          {select('ways', tr('Vías / posiciones'), [
            ['5/2', '5/2'],
            ['3/2', '3/2'],
            ['5/3', '5/3'],
          ])}
          {c.ways === '3/2' &&
            select('normally', tr('En reposo'), [
              ['NC', 'Cerrada (NC)'],
              ['NO', 'Abierta (NA)'],
            ])}
          {c.ways === '5/3' &&
            select('center', tr('Posición central'), [
              ['closed', 'Cerrada'],
              ['exhaust', 'A escape'],
              ['pressure', tr('A presión')],
            ])}
          {select('manual', 'Accionamiento manual', [
            ['none', '(ninguno)'],
            ['button', 'Pulsador'],
            ['lever', tr('Palanca (se queda)')],
          ])}
          {solenoidSelect('sol14', tr('Bobina 14 (electroválvula)'), tr('(sin bobina)'))}
          {solenoidSelect('sol12', c.ways === '5/3' ? tr('Bobina 12') : tr('Bobina 12 (sin ella: muelle)'), '(muelle)')}
        </>
      )}
      {c.type === 'pcylinder' && (
        <>
          {select('acting', 'Tipo', [
            ['double', 'Doble efecto'],
            ['single', 'Simple efecto (muelle)'],
          ])}
          {text('time', tr('Tiempo de carrera (s)'), { type: 'number', min: 0.1, step: 0.1 })}
          {select('initial', tr('Al empezar'), [
            ['0', 'Dentro'],
            ['1', 'Fuera'],
          ])}
          <p className="text-slate-500">{`Detectores: ${cylinderSignals(c.tag).join(' (dentro) y ')} (fuera)`}</p>
        </>
      )}
      {c.type === 'throttle' && text('setting', 'Apertura (0,05 a 1)', { type: 'number', min: 0.05, max: 1, step: 0.05 })}
      {c.type === 'potentiometer' && text('initial', tr('Posición al empezar (0 a 1)'), { type: 'number', min: 0, max: 1, step: 0.05 })}
      {c.type === 'vfd' && text('speed2', '2ª velocidad (Hz)', { type: 'number', min: 1, max: 50, step: 1 })}
      {c.type === 'softstarter' && text('ramp', 'Rampa (s)', { type: 'number', min: 0.5, step: 0.5 })}
      {c.type === 'coil' &&
        (c.kind ?? 'contactor') === 'contactor' &&
        select('interlock', tr('Enclavamiento mecánico con'), [
          ['', '(ninguno)'],
          ...components.filter((x) => x.type === 'coil' && x.tag && x.tag !== c.tag && (x.kind ?? 'contactor') === 'contactor').map((x) => [x.tag, showTag(x.tag)]),
        ])}
      {c.type === 'beacon' &&
        ['red', 'amber', 'green', 'buzzer'].map((k) => (
          <label key={k} className="block">
            <span className="text-slate-500">{tr('{luz} mueve en la planta', { luz: { red: tr('Rojo'), amber: tr('Ámbar'), green: tr('Verde'), buzzer: tr('Zumbador') }[k] })}</span>
            <select value={c[k] ?? ''} onChange={(e) => onChange({ [k]: e.target.value })} className={field}>
              {[['', tr('(sin enlazar)')], ...outputs.map((v) => [v.name, v.name])].map(([value, t]) => (
                <option key={value} value={value}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ))}
      {c.type === 'litbutton' &&
        select('light', tr('Su piloto mueve en la planta'), [['', tr('(sin enlazar)')], ...outputs.map((v) => [v.name, v.name])])}
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
        select('ref', tr('Del aparato'), [...refs.map((x) => [x.tag, showTag(x.tag)]), ...(refs.some((x) => x.tag === c.ref) ? [] : [[c.ref ?? '', showTag(c.ref) || '—']])])}
      {c.type === 'coil' && (
        <>
          {select('kind', 'Tipo', [
            ['contactor', 'Contactor'],
            ['relay', tr('Relé auxiliar')],
            ['ton', tr('Temporizador a la conexión')],
            ['tof', tr('Temporizador a la desconexión (o minutero)')],
            ['flash', tr('Relé intermitente')],
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
          ['amber', tr('Ámbar')],
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
          {text('analogIn', tr('Entradas analógicas (AIW)'), { type: 'number', min: 0, max: 8 })}
          {text('analogOut', tr('Salidas analógicas (AQW)'), { type: 'number', min: 0, max: 4 })}
        </>
      )}
      {(isContact || isLoad) &&
        signalSelect('signal', c.type === 'transmitter' ? tr('Mide en la planta (analógica)') : c.type === 'pcylinder' ? tr('Al salir, mueve en la planta') : isLoad ? tr('Mueve en la planta') : c.type === 'doorswitch' ? tr('Puerta abierta en la planta') : tr('Lo acciona en la planta'))}
      {isMotor(c.type) && signalSelect('reverse', tr('Giro inverso en la planta'))}
      {c.type === 'motor1' &&
        select('capacitor', 'Condensador', [
          ['permanent', 'Permanente'],
          ['start', tr('De arranque (con interruptor centrífugo)')],
        ])}
      {c.type === 'pcylinder' && c.acting !== 'single' && signalSelect('reverse', tr('Al entrar, mueve en la planta'))}
      {c.type !== 'rail' && text('text', tr('Descripción'))}
      <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-red-700 hover:bg-red-50">
        <Trash2 size={12} />{' '}{tr('Eliminar')}
      </button>
    </aside>
  )
}
