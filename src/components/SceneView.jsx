import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { closest } from '../lib/autocomplete'
import { ArrowLeft, ArrowRight, BookmarkPlus, Box, Boxes, Cable, ChevronDown, Copy, Download, Hand, Maximize2, Upload, Tag, Minimize2, Minus, MousePointer2, Plus, RotateCw, Scan, Trash2, WandSparkles, X, ArrowDownToLine } from 'lucide-react'
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
  placed,
  sceneIO,
  sceneInit,
  weighed,
  sceneFaults,
  sceneSignals,
  sensorZone,
  sinkRect,
  distanceBeam,
  worldRect,
  platformRect,
  SCENE_FLOOR,
} from '../lib/sim/scene'
import { copyToClipboard, pasteFromClipboard } from '../lib/sim/sceneClipboard'
import { faces, pieceBox, reliefBoxes, reliefOrder } from '../lib/sim/relief'
import { ISO_MATRIX, isoBoxes, isoKey, isoPrism, isoProject, isoScreenBox, lift, pieceLift } from '../lib/sim/iso'
import { exportGroups, importGroups, loadGroups, makeGroup, placeGroup, storeGroups } from '../lib/sim/sceneLibrary'
import { downloadFile } from '../lib/projectFile'
import { N_, t as tr } from '../lib/i18n'
import { maxPanelWidth } from './panelWidth'
import { applyResize, resizeHandles, resizeMeasure } from '../lib/sim/sceneHandles'
import { collides, freeSpot, stampRow } from '../lib/sim/sceneStamp'

// Pantalla táctil o pizarra digital (puntero «grueso»): tiradores y botones más grandes.
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

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
const COLOR_NAMES = { green: N_('Verde'), red: N_('Rojo'), yellow: N_('Amarillo'), blue: N_('Azul'), black: N_('Negro'), white: N_('Blanco') }
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
          {tr('NC')}
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
          {tr('PULSADA')}
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
      {/* Ventosa: verde con vacío */}
      {e.vacuum && (
        <path
          d={`M ${88 + pos * stroke} -9 L ${94 + pos * stroke} -13 L ${94 + pos * stroke} 13 L ${88 + pos * stroke} 9 Z`}
          fill={isOn(values, e.vacuum) ? ON : '#94a3b8'}
          stroke={INK}
          strokeWidth="0.75"
        />
      )}
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
// Desviador: su zona y una compuerta que, activa, se cruza para empujar las piezas en el sentido
// de la flecha.
function DiverterShape({ e, active }) {
  const len = Number(e.length) || 80
  return (
    <g>
      <rect x="0" y="-25" width={len} height="50" rx="3" fill={active ? ON : '#94a3b8'} fillOpacity={active ? 0.18 : 0.08} stroke="#64748b" strokeDasharray="4 3" />
      <line x1={8} y1="0" x2={len - 10} y2="0" stroke={active ? ON : '#94a3b8'} strokeWidth="2.5" />
      <path d={`M ${len - 16} -6 L ${len - 6} 0 L ${len - 16} 6`} fill="none" stroke={active ? ON : '#94a3b8'} strokeWidth="2.5" />
      {/* Compuerta: abierta, en el borde; activa, cruzada sobre la zona. */}
      <line x1="-4" y1="-25" x2={active ? len * 0.7 : -4} y2={active ? 25 : 25} stroke="#334155" strokeWidth="5" strokeLinecap="round" />
      <circle cx="-4" cy="-25" r="5" fill="#475569" />
    </g>
  )
}
// Rampa: superficie inclinada (más alta al principio) por la que resbalan las piezas.
// Plataforma: superficie fija (mesa, suelo, pared si se gira).
function PlatformShape({ e }) {
  const len = Number(e.length) || 160
  return (
    <g>
      <rect x="0" y="0" width={len} height="14" fill="#cbd5e1" stroke={INK} />
      {Array.from({ length: Math.floor(len / 12) }, (_, i) => (
        <line key={i} x1={6 + i * 12} y1="14" x2={14 + i * 12} y2="2" stroke="#94a3b8" />
      ))}
    </g>
  )
}
function RampShape({ e }) {
  const len = Number(e.length) || 120
  return (
    <g>
      <rect x="0" y="-20" width={len} height="40" rx="2" fill="#e2e8f0" stroke={INK} />
      <rect x="0" y="-20" width="8" height="40" fill="#94a3b8" />
      {Array.from({ length: Math.max(1, Math.floor((len - 20) / 26)) }, (_, i) => (
        <path key={i} d={`M ${18 + i * 26} -8 L ${26 + i * 26} 0 L ${18 + i * 26} 8`} fill="none" stroke="#94a3b8" strokeWidth="2" />
      ))}
    </g>
  )
}
function SirenShape({ on }) {
  return (
    <g>
      <rect x="-18" y="-6" width="10" height="12" rx="2" fill="#475569" />
      <polygon points="-8,-6 8,-16 8,16 -8,6" fill={on ? '#dc2626' : '#cbd5e1'} stroke={INK} />
      {on && [12, 18].map((r) => <path key={r} d={`M ${r} -${r * 0.7} A ${r} ${r} 0 0 1 ${r} ${r * 0.7}`} fill="none" stroke="#dc2626" strokeWidth="2" />)}
    </g>
  )
}
function TrafficLightShape({ e, values }) {
  const lights = [
    ['red', '#dc2626', -24],
    ['amber', '#f59e0b', 0],
    ['green', '#16a34a', 24],
  ]
  return (
    <g>
      <rect x="-15" y="-38" width="30" height="76" rx="6" fill="#1e293b" />
      {lights.map(([key, color, y]) => (
        <circle key={key} cy={y} r="9" fill={isOn(values, e[key]) ? color : '#475569'} stroke="#0f172a" />
      ))}
      <rect x="-3" y="38" width="6" height="22" fill="#475569" />
    </g>
  )
}
function ValveShape({ open }) {
  return (
    <g>
      <line x1="-24" y1="0" x2="-14" y2="0" stroke="#64748b" strokeWidth="6" />
      <line x1="14" y1="0" x2="24" y2="0" stroke="#64748b" strokeWidth="6" />
      <polygon points="-14,-10 14,10 14,-10 -14,10" fill={open ? '#3b82f6' : '#e2e8f0'} stroke={INK} strokeWidth="1.2" />
      <line x1="0" y1="0" x2="0" y2="-14" stroke={INK} strokeWidth="1.5" />
      <rect x="-8" y="-24" width="16" height="10" rx="2" fill={open ? ON : '#94a3b8'} stroke={INK} />
    </g>
  )
}
function PipeShape({ e, flowing, t }) {
  const len = Number(e.length) || 160
  return (
    <g>
      <line x1="0" y1="0" x2={len} y2="0" stroke={flowing ? '#3b82f6' : '#94a3b8'} strokeWidth="8" strokeLinecap="round" />
      {flowing && <line x1="0" y1="0" x2={len} y2="0" stroke="#bfdbfe" strokeWidth="2" strokeDasharray="6 8" strokeDashoffset={-((t * 40) % 14)} />}
    </g>
  )
}
function BarrierShape({ e, pos }) {
  const len = Number(e.length) || 140
  return (
    <g>
      <g transform={`rotate(${-pos * 85} 0 -18)`}>
        <rect x="0" y="-22" width={len} height="8" rx="3" fill="white" stroke={INK} />
        {Array.from({ length: Math.floor(len / 24) }, (_, i) => (
          <rect key={i} x={6 + i * 24} y="-22" width="12" height="8" fill="#dc2626" />
        ))}
      </g>
      <rect x="-9" y="-28" width="18" height="44" rx="3" fill="#475569" />
      <circle cx="0" cy="-18" r="3" fill="#cbd5e1" />
    </g>
  )
}
function LabelShape({ e }) {
  return (
    <text x="0" y="0" fontSize={Number(e.size) || 16} fontWeight="600" fill={INK}>
      {e.text}
    </text>
  )
}
function ImageShape({ e }) {
  const w = Number(e.width) || 300
  const h = Number(e.height) || 200
  return e.src ? (
    <image href={e.src} x="0" y="0" width={w} height={h} preserveAspectRatio="xMidYMid meet" opacity="0.9" />
  ) : (
    <g>
      <rect x="0" y="0" width={w} height={h} fill="#f8fafc" stroke="#94a3b8" strokeDasharray="6 4" />
      <text x={w / 2} y={h / 2 - 4} textAnchor="middle" fontSize="13" fill="#64748b">
        {tr('Imagen')}
      </text>
      <text x={w / 2} y={h / 2 + 12} textAnchor="middle" fontSize="10" fill="#94a3b8">
        {tr('(elígela en sus propiedades)')}
      </text>
    </g>
  )
}
// Vista en relieve (lib/sim/relief.js): caras de arriba y de la derecha, detrás de los dibujos.
const RELIEF_TONES = {
  belt: ['#cbd5e1', '#94a3b8'],
  body: ['#f1f5f9', '#cbd5e1'],
  rod: ['#94a3b8', '#64748b'],
  plate: ['#64748b', '#475569'],
  steel: ['#e2e8f0', '#94a3b8'],
  bin: ['#f1f5f9', '#cbd5e1'],
  arm: ['#fecaca', '#f87171'],
  tank: ['#f8fafc', '#cbd5e1'],
}
const pts = (list) => list.map(([x, y]) => `${x},${y}`).join(' ')
// La isométrica solo en la vista desde arriba (la de frente ya es un alzado).
const isIso = (scene) => scene?.view === 'iso' && !scene?.gravity
function BoxFaces({ box, color, of }) {
  const { top, side } = faces(box)
  const [light, dark] = color ? [color, color] : (RELIEF_TONES[box.tone] ?? RELIEF_TONES.steel)
  return (
    <g data-relief-of={of}>
      <polygon points={pts(top)} fill={light} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
      {color && <polygon points={pts(top)} fill="white" opacity="0.35" />}
      <polygon points={pts(side)} fill={dark} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
      {color && <polygon points={pts(side)} fill="black" opacity="0.22" />}
    </g>
  )
}
function ReliefLayer({ scene, state, elements }) {
  const boxes = elements.flatMap((e) => reliefBoxes(scene, state, e).map((box) => ({ ...box, of: e.id }))).sort(reliefOrder)
  return (
    <g data-relief="" pointerEvents="none">
      {boxes.map((box, i) => (
        <BoxFaces key={i} box={box} of={box.of} />
      ))}
    </g>
  )
}
// Contorno de un elemento con su volumen (para colocar los rótulos sin pisarlo).
const withRelief = (b, on) => (on ? { x: b.x, y: b.y - 25, w: b.w + 25, h: b.h + 25 } : b)

function PieceShape({ p, relief = false }) {
  const metal = p.material === 'metal'
  return (
    <g pointerEvents="none" data-piece={p.id} data-material={p.material ?? 'plastic'}>
      {relief && <BoxFaces box={pieceBox(p)} color={COLORS[p.color] ?? COLORS.amber} />}
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="3" fill={COLORS[p.color] ?? COLORS.amber} stroke={metal ? '#334155' : INK} />
      {metal && <line x1={p.x + 4} y1={p.y + p.h - 5} x2={p.x + p.w - 5} y2={p.y + 4} stroke="white" strokeWidth="2" opacity="0.6" />}
    </g>
  )
}
// Vista isométrica (lib/sim/iso.js): la cara de arriba de cada volumen y las dos de delante (sur y
// este, más oscura), debajo del dibujo del elemento, que va encima a su altura.
function IsoFaces({ boxes, color }) {
  return boxes.map((box, i) => {
    const { top, south, east } = isoPrism(box)
    const [light, dark] = color ? [color, color] : (RELIEF_TONES[box.tone] ?? RELIEF_TONES.steel)
    return (
      <g key={i} data-iso-box={box.tone ?? ''}>
        <polygon points={pts(south)} fill={dark} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
        <polygon points={pts(east)} fill={dark} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
        <polygon points={pts(east)} fill="black" opacity={color ? 0.3 : 0.18} />
        {color && <polygon points={pts(south)} fill="black" opacity="0.12" />}
        <polygon points={pts(top)} fill={light} stroke={INK} strokeWidth="0.8" strokeLinejoin="round" />
      </g>
    )
  })
}
function IsoPiece({ p, z }) {
  const color = COLORS[p.color] ?? COLORS.amber
  const o = lift(z + Math.min(p.w, p.h, 30))
  return (
    <g pointerEvents="none" data-piece={p.id} data-material={p.material ?? 'plastic'}>
      <IsoFaces boxes={[{ r: { x: p.x, y: p.y, w: p.w, h: p.h }, base: z, h: Math.min(p.w, p.h, 30) }]} color={color} />
      {p.material === 'metal' && (
        <line x1={p.x + 4 + o.x} y1={p.y + p.h - 5 + o.y} x2={p.x + p.w - 5 + o.x} y2={p.y + 4 + o.y} stroke="white" strokeWidth="2" opacity="0.6" />
      )}
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
    case 'diverter': {
      const z = worldRect(e, -10, -30, (Number(e.length) || 80) + 10, 60)
      return z
    }
    case 'ramp':
      return worldRect(e, 0, -20, Number(e.length) || 120, 40)
    case 'platform':
      return platformRect(e)
    case 'siren':
      return r(-20, -20, 44, 40)
    case 'trafficlight':
      return r(-16, -40, 32, 100)
    case 'valve':
      return worldRect(e, -26, -26, 52, 38)
    case 'pipe':
      return worldRect(e, -4, -6, (Number(e.length) || 160) + 8, 12)
    case 'barrier': {
      const len = Number(e.length) || 140
      return r(-10, -24 - (pos > 0.01 ? len : 0), len + 12, 42 + (pos > 0.01 ? len : 0))
    }
    case 'label': {
      const size = Number(e.size) || 16
      return r(0, -size, Math.max(20, String(e.text ?? '').length * size * 0.6), size * 1.3)
    }
    case 'image':
      return r(0, 0, Number(e.width) || 300, Number(e.height) || 200)
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

// Rótulos de la escena (sin girar), colocados para que no pisen otros elementos ni otros rótulos:
// se prueba debajo (lo normal), encima, a la derecha y a la izquierda, y se queda el primer sitio
// libre (si no hay ninguno, debajo). En la vista de frente, el de un alimentador va primero a su
// derecha: debajo es por donde caen las piezas. Los cilindros cuentan con toda su carrera, para que
// el rótulo no salte mientras se mueve el vástago. items: [{ e, b (contorno), text, lines }].
const CHAR_W = 6.3
function layoutLabels(items, gravity) {
  const boxes = items.map(({ b }) => b)
  const placed = []
  const out = new Map()
  const hits = (r, own) =>
    items.some((it, i) => it.e.id !== own && overlapsRect(r, boxes[i])) || placed.some((q) => overlapsRect(r, q))
  for (const { e, b, text, lines = 0 } of items) {
    if (!String(text ?? '').trim()) continue // sin rótulo (sigue contando como obstáculo)
    const w = Math.max(8, String(text ?? '').length * CHAR_W)
    const h = 12 + lines * 12
    const spots = [
      { x: b.x + b.w / 2, y: b.y + b.h + 13, anchor: 'middle', r: { x: b.x + b.w / 2 - w / 2, y: b.y + b.h + 2, w, h } },
      { x: b.x + b.w / 2, y: b.y - 5 - lines * 12, anchor: 'middle', r: { x: b.x + b.w / 2 - w / 2, y: b.y - 4 - h, w, h } },
      { x: b.x + b.w + 10, y: b.y + b.h / 2 + 4, anchor: 'start', r: { x: b.x + b.w + 8, y: b.y + b.h / 2 - 7, w, h } },
      { x: b.x - 10, y: b.y + b.h / 2 + 4, anchor: 'end', r: { x: b.x - 8 - w, y: b.y + b.h / 2 - 7, w, h } },
      // En las esquinas de los lados, arriba y abajo.
      { x: b.x + b.w + 10, y: b.y + 10, anchor: 'start', r: { x: b.x + b.w + 8, y: b.y, w, h } },
      { x: b.x + b.w + 10, y: b.y + b.h, anchor: 'start', r: { x: b.x + b.w + 8, y: b.y + b.h - 10, w, h } },
      { x: b.x - 10, y: b.y + 10, anchor: 'end', r: { x: b.x - 8 - w, y: b.y, w, h } },
      { x: b.x - 10, y: b.y + b.h, anchor: 'end', r: { x: b.x - 8 - w, y: b.y + b.h - 10, w, h } },
      // Más lejos, por si a los lados hay algo pegado (un final de carrera en el recorrido de la cabina).
      { x: b.x - 40, y: b.y + b.h / 2 + 4, anchor: 'end', r: { x: b.x - 38 - w, y: b.y + b.h / 2 - 7, w, h } },
      { x: b.x + b.w + 40, y: b.y + b.h / 2 + 4, anchor: 'start', r: { x: b.x + b.w + 38, y: b.y + b.h / 2 - 7, w, h } },
      { x: b.x + b.w / 2, y: b.y + b.h + 33, anchor: 'middle', r: { x: b.x + b.w / 2 - w / 2, y: b.y + b.h + 22, w, h } },
    ]
    if (gravity && e.type === 'feeder') spots.unshift(spots.splice(2, 1)[0])
    // El primero libre; si no hay ninguno, el que menos pisa.
    const covered = (r) =>
      [...items.filter((it) => it.e.id !== e.id).map((it) => it.b), ...placed].reduce((sum, o) => {
        const x = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)
        const y = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)
        return sum + (x > 0 && y > 0 ? x * y : 0)
      }, 0)
    const spot = spots.find((c) => !hits(c.r, e.id)) ?? spots.reduce((best, c) => (covered(c.r) < covered(best.r) ? c : best))
    placed.push(spot.r)
    out.set(e.id, spot)
  }
  return out
}
// Rótulos de la isométrica: en el suelo, delante de su elemento (bajo el centro de su borde de
// delante); si ahí pisan a otro rótulo o el volumen de otro elemento (obstacles: [{ id, r }]), se
// prueba encima, a la derecha, a la izquierda y cada vez más abajo, y se queda el primer sitio libre
// (si no hay, el que menos pisa). screen(e): su contorno en la pantalla. Nunca fuera del lienzo.
function isoLabels(elements, textOf, linesOf, obstacles, screen) {
  const placedRects = []
  const out = new Map()
  const items = elements
    .map((e) => {
      // Los cilindros, bajo el cuerpo (no bajo toda su carrera).
      const b = e.type === 'cylinder' ? worldRect(e, 0, -12, 80, 24) : boundsOf(e, 1)
      return { e, b, p: isoProject({ x: b.x + b.w / 2, y: b.y + b.h }) }
    })
    .sort((a, b) => a.p.y - b.p.y)
  for (const { e, b, p } of items) {
    const text = String(textOf(e) ?? '')
    if (!text.trim()) continue
    const w = Math.max(8, text.length * CHAR_W)
    const h = 12 + linesOf(e) * 12
    const sb = screen(e)
    const long = ISO_LONG.includes(e.type)
    // Las alargadas (una cinta), en cualquier punto de sus dos bordes de delante.
    const along = [0.5, 0.3, 0.7, 0.15, 0.85].flatMap((t) => [isoProject({ x: b.x + t * b.w, y: b.y + b.h }), isoProject({ x: b.x + b.w, y: b.y + t * b.h })])
    const spots = [
      { x: p.x, y: p.y + 16 },
      ...(long
        ? along.flatMap((q) => [{ x: q.x, y: q.y + 16 }, { x: q.x, y: q.y + 30 }])
        : [-6, -20, -34].flatMap((d) => [
            { x: sb.x + sb.w / 2, y: sb.y + d - linesOf(e) * 12 },
            { x: sb.x + sb.w - 6 * d / 6 + 8 + w / 2, y: sb.y + sb.h / 2 + 4 },
            { x: sb.x + 6 * d / 6 - 8 - w / 2, y: sb.y + sb.h / 2 + 4 },
          ])),
      ...Array.from({ length: 10 }, (_, i) => ({ x: p.x, y: p.y + 29 + 13 * i })),
    ].map((c) => ({ x: Math.max(4 + w / 2, c.x), y: c.y }))
    // Con un margen de 6 px para que dos rótulos no queden pegados.
    const rect = (c) => ({ x: c.x - w / 2 - 6, y: c.y - 11, w: w + 12, h: h + 2 })
    const others = (c) => [...placedRects, ...obstacles.filter((o) => o.id !== e.id).map((o) => o.r)].filter((q) => overlapsRect(rect(c), q))
    const area = (c) =>
      others(c).reduce((sum, q) => {
        const r = rect(c)
        return sum + (Math.min(r.x + r.w, q.x + q.w) - Math.max(r.x, q.x)) * (Math.min(r.y + r.h, q.y + q.h) - Math.max(r.y, q.y))
      }, 0)
    const at = spots.find((c) => !others(c).length) ?? spots.reduce((best, c) => (area(c) < area(best) ? c : best))
    placedRects.push(rect(at))
    out.set(e.id, { ...at, anchor: 'middle' })
  }
  return out
}
const overlapsRect = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function labelOf(e) {
  const vars = (SCENE_VARS[e.type] ?? []).map(([key]) => e[key]).filter(Boolean)
  // Detector sin variable: su tipo, corto (los rótulos largos se solapan entre detectores juntos).
  const fallback = e.type === 'sensor' ? { optical: tr('Óptico'), inductive: tr('Inductivo'), capacitive: tr('Capacitivo'), color: tr('Color') }[e.kind ?? 'optical'] : null
  // Una plataforma sin texto (pared, base, tope) no lleva rótulo: son estructura y, con el nombre
  // del tipo, los rótulos se montarían sobre lo que sostienen.
  if (e.type === 'platform') return e.text ?? ''
  return e.text || vars[0] || fallback || tr(SCENE_TYPES[e.type].label)
}

// --- Propiedades -------------------------------------------------------------------------------

// Tipo de la variable nueva según el campo: lo que la escena escribe es una entrada, lo que lee
// una salida; las analógicas, entradas analógicas; el visualizador, una marca.
const NEW_TYPE = { in: 'input', out: 'output', analog: 'analogIn', any: 'memory', trigger: 'input' }
const TYPE_NAMES = { input: 'entrada', output: 'salida', analogIn: N_('entrada analógica'), memory: 'marca' }

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
            placeholder={tr('— (elige o escribe)')}
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
        fresh && <p className="mt-0.5 text-[11px] text-blue-700">{tr('Nueva: se añadirá a la tabla como {tipo}.', { tipo: tr(TYPE_NAMES[NEW_TYPE[dir]]) })}</p>
      )}
    </div>
  )
}

// Entradas y salidas de la planta: lo conectado (con su dirección) y los avisos. Un clic en un
// elemento lo selecciona.
function IOPanel({ io, elements, onSelect }) {
  const label = (id) => {
    const e = elements.find((x) => x.id === id)
    return e ? `${tr(SCENE_TYPES[e.type].label)} ${labelOf(e)}` : id
  }
  // Función, no componente: definido dentro de IOPanel, React lo montaría de nuevo en cada paso de la
  // simulación (y el botón «se movería» bajo el ratón).
  const elementLink = (id) => (
    <button type="button" onClick={() => onSelect(id)} className="text-left text-blue-700 hover:underline">
      {label(id)}
    </button>
  )
  const warnings = io.unassigned.length + io.unusedOutputs.length + io.notInGrafcet.length
  return (
    <div className="space-y-3 text-xs" aria-label={tr('Conexiones de la planta')}>
      <p className="font-semibold">{tr('Entradas y salidas de la planta')}</p>
      {io.signals.length === 0 ? (
        <p className="text-slate-500">{tr('Ningún elemento tiene variables todavía.')}</p>
      ) : (
        <ul className="space-y-1" aria-label={tr('Conectadas')}>
          {io.signals.map((sig) => (
            <li key={sig.name}>
              <span className="flex items-center gap-1 font-mono">
                {sig.dir === 'out' ? (
                  <ArrowRight size={12} className="shrink-0 text-green-600" aria-label={tr('salida del grafcet hacia la planta')} />
                ) : (
                  <ArrowLeft size={12} className="shrink-0 text-blue-600" aria-label={tr('entrada del grafcet desde la planta')} />
                )}
                <span className="font-semibold">{sig.name}</span>
                <span className="text-slate-500">{sig.address || tr('sin dirección')}</span>
              </span>
              <span className="block pl-4">
                {sig.elements.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    {elementLink(id)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {warnings + io.manual.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-2" aria-label={tr('Avisos de conexión')}>
          {io.unassigned.length > 0 && (
            <div>
              <p className="font-medium text-amber-700">{tr('Sin variable (no hacen nada):')}</p>
              {io.unassigned.map((id) => (
                <p key={id} className="pl-2">
                  {elementLink(id)}
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
              <span className="font-medium">{tr('Entradas que se cambian a mano')}</span> (en el panel de simulación):{' '}
              <span className="font-mono">{io.manual.join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Properties({ element, variables, onChange, onDelete, onRotate, onCreateVariable, onMoveInDesk, cylinders = [] }) {
  const names = (dir) =>
    variables
      .filter((v) =>
        dir === 'any'
          ? true
          : dir === 'trigger'
            ? ['input', 'output', 'memory'].includes(v.type)
            : dir === 'analog'
              ? v.type === 'analogIn'
              : dir === 'out'
                ? v.type === 'output' || v.type === 'memory'
                : v.type === 'input',
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
    <div className="space-y-2 text-xs" aria-label={tr('Propiedades del elemento')}>
      <div className="flex items-center gap-1">
        <span className="font-semibold">{tr(SCENE_TYPES[element.type].label)}</span>
        <span className="ml-auto" />
        <button type="button" onClick={onRotate} title={tr('Girar 90° (R)')} className="rounded p-1 hover:bg-slate-100">
          <RotateCw size={14} />
        </button>
        <button type="button" onClick={onDelete} title={tr('Borrar (Supr)')} className="rounded p-1 hover:bg-red-500 hover:text-white">
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
            <span className="text-slate-500">{tr('Ubicación')}</span>
            <select value={element.place === 'desk' ? 'desk' : 'machine'} onChange={(ev) => set({ place: ev.target.value })} className={field}>
              <option value="desk">{tr('En el panel de control')}</option>
              <option value="machine">{tr('En la máquina')}</option>
            </select>
          </label>
          {element.place === 'desk' && (
            <>
              <button type="button" onClick={() => onMoveInDesk(-1)} title={tr('Mover a la izquierda en el panel')} className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100">
                ◀
              </button>
              <button type="button" onClick={() => onMoveInDesk(1)} title={tr('Mover a la derecha en el panel')} className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-100">
                ▶
              </button>
            </>
          )}
        </div>
      )}
      {['button', 'switch', 'limit', 'sensor'].includes(element.type) && (
        <label className="block">
          <span className="text-slate-500">{tr('Contacto')}</span>
          <select value={element.contact ?? 'NO'} onChange={(ev) => set({ contact: ev.target.value })} className={field}>
            <option value="NO">{tr('Normalmente abierto (NA)')}</option>
            <option value="NC">{tr('Normalmente cerrado (NC)')}</option>
          </select>
        </label>
      )}
      {(element.type === 'button' || element.type === 'lamp') && (
        <label className="block">
          <span className="text-slate-500">{tr('Color')}</span>
          <select value={element.color ?? 'green'} onChange={(ev) => set({ color: ev.target.value })} className={field}>
            {Object.entries(COLOR_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {tr(name)}
              </option>
            ))}
          </select>
        </label>
      )}
      {element.type === 'cylinder' && (
        <>
          <label className="block">
            <span className="text-slate-500">{tr('Montado en el vástago de')}</span>
            <select value={element.mountedOn ?? ''} onChange={(ev) => set({ mountedOn: ev.target.value })} className={field}>
              <option value="">{tr('— (fijo)')}</option>
              {cylinders
                .filter((c) => c.id !== element.id && c.mountedOn !== element.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    Cilindro {labelOf(c)}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={Number(element.initial) === 1} onChange={(ev) => set({ initial: ev.target.checked ? 1 : 0 })} />
            {tr('Empieza con el vástago fuera')}
          </label>
          {number('stroke', 'Carrera (px)', 20, 10)}
          {number('time', tr('Tiempo de carrera (s)'), 0.1, 0.1)}
        </>
      )}
      {element.type === 'conveyor' && (
        <>
          {number('length', 'Largo (px)', 60, 10)}
          {number('time', tr('Tiempo de recorrido (s)'), 0.2, 0.1)}
        </>
      )}
      {element.type === 'sensor' && (
        <>
          <label className="block">
            <span className="text-slate-500">{tr('Tipo de detector')}</span>
            <select
              value={element.kind ?? 'optical'}
              onChange={(ev) => set({ kind: ev.target.value, range: SENSOR_KINDS[ev.target.value].range })}
              className={field}
            >
              {Object.entries(SENSOR_KINDS).map(([id, k]) => (
                <option key={id} value={id}>
                  {tr(k.label)}
                </option>
              ))}
            </select>
          </label>
          {element.kind === 'color' && (
            <label className="block">
              <span className="text-slate-500">{tr('Color que detecta')}</span>
              <select value={element.color ?? 'amber'} onChange={(ev) => set({ color: ev.target.value })} className={field}>
                {Object.entries(PIECE_COLORS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {tr(name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {number('range', 'Alcance (px)', 10, 10)}
        </>
      )}
      {element.type === 'distance' && number('range', tr('Alcance (px) = valor máximo'), 20, 10)}
      {element.type === 'siren' && (
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={Boolean(element.sound)} onChange={(ev) => set({ sound: ev.target.checked })} />
          {tr('Con sonido (al simular)')}
        </label>
      )}
      {element.type === 'pipe' && number('length', 'Largo (px)', 20, 10)}
      {element.type === 'barrier' && (
        <>
          {number('length', tr('Largo del brazo (px)'), 40, 10)}
          {number('time', tr('Tiempo en abrirse (s)'), 0.2, 0.1)}
        </>
      )}
      {element.type === 'label' && number('size', tr('Tamaño de letra (px)'), 8, 1)}
      {element.type === 'image' && (
        <>
          <label className="block">
            <span className="text-slate-500">{tr('Imagen (se reduce a 1200 px)')}</span>
            <input
              type="file"
              accept="image/*"
              aria-label={tr('Elegir imagen')}
              onChange={async (ev) => {
                const file = ev.target.files?.[0]
                ev.target.value = ''
                if (!file) return
                const { src, width, height } = await loadImage(file)
                set({ src, width, height })
              }}
              className="block w-full text-[11px]"
            />
          </label>
          {number('width', 'Ancho (px)', 20, 10)}
          {number('height', 'Alto (px)', 20, 10)}
        </>
      )}
      {element.type === 'platform' && number('length', 'Largo (px)', 30, 10)}
      {(element.type === 'diverter' || element.type === 'ramp') && (
        <>
          {number('length', 'Largo (px)', 30, 10)}
          {number('time', tr('Tiempo en recorrerla (s)'), 0.1, 0.1)}
        </>
      )}
      {element.type === 'potentiometer' && (
        <label className="block">
          <span className="text-slate-500">{tr('Posición al empezar (%)')}</span>
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
          {number('maxTemp', tr('Temperatura máxima (°C)'), 30, 5)}
          {number('tau', tr('Inercia: constante de tiempo (s)'), 1, 1)}
        </>
      )}
      {element.type === 'tank' && (
        <>
          {number('fillTime', tr('Llenado de vacío a lleno (s)'), 0.5, 0.5)}
          {number('drainTime', tr('Vaciado de lleno a vacío (s)'), 0.5, 0.5)}
          <label className="block">
            <span className="text-slate-500">{tr('Nivel al empezar (%)')}</span>
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
            <span className="text-slate-500">{tr('Piezas')}</span>
            <select value={element.sizes ?? 'small'} onChange={(ev) => set({ sizes: ev.target.value })} className={field}>
              <option value="small">{tr('Pequeñas')}</option>
              <option value="large">{tr('Grandes')}</option>
              <option value="mixed">{tr('Alternas (pequeña, grande…)')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-slate-500">{tr('Material')}</span>
            <select value={element.material ?? 'plastic'} onChange={(ev) => set({ material: ev.target.value })} className={field}>
              <option value="plastic">{tr('Plástico')}</option>
              <option value="metal">{tr('Metal')}</option>
              <option value="mixed">{tr('Alterno (plástico, metal…)')}</option>
            </select>
          </label>
          {element.material !== 'metal' && (
            <label className="block">
              <span className="text-slate-500">{tr('Color del plástico')}</span>
              <select value={element.color ?? 'amber'} onChange={(ev) => set({ color: ev.target.value })} className={field}>
                {Object.entries(PIECE_COLORS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {tr(name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!element.trigger && (
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={Boolean(element.auto)} onChange={(ev) => set({ auto: ev.target.checked })} />
              {tr('Siempre una pieza esperando')}
            </label>
          )}
          {!element.trigger && element.auto && number('spacing', tr('Hueco hasta la siguiente (px)'), 0, 10)}
        </>
      )}
      {!['limit', 'sensor', 'distance'].includes(element.type) && (
        <label className="block">
          <span className="text-slate-500">{tr('Rótulo')}</span>
          <input value={element.text ?? ''} onChange={(ev) => set({ text: ev.target.value })} placeholder={tr('(el nombre de la variable)')} className={field} />
        </label>
      )}
    </div>
  )
}

function Faults({ element, fault, onAction }) {
  const options = sceneFaults(element)
  return (
    <div className="space-y-2 text-xs" aria-label={tr('Averías del elemento')}>
      <p className="font-semibold">{labelOf(element)}</p>
      {options.length ? (
        <label className="block">
          <span className="text-slate-500">{tr('Avería (solo en esta simulación)')}</span>
          <select
            value={fault ?? ''}
            onChange={(ev) => onAction(element.id, `fault:${ev.target.value}`)}
            aria-label={tr('Avería de {elemento}', { elemento: labelOf(element) })}
            className={`w-full rounded border px-1 py-0.5 ${fault ? 'border-red-400 text-red-700' : 'border-slate-300'}`}
          >
            <option value="">{tr('Ninguna')}</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {tr(f.label)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-slate-500">{tr('Este elemento no tiene averías.')}</p>
      )}
      <p className="text-[11px] text-slate-500">{tr('Mira en «Qué espera el grafcet» cómo reacciona el programa.')}</p>
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
  button: N_('Pulsador: da 1 mientras lo mantienes pulsado (o 0 si es NC). Para Marcha, Paro, Rearme…'),
  switch: N_('Interruptor: se queda en la posición elegida. Para selectores Manual/Automático, pieza colocada…'),
  emergency: N_('Seta de emergencia: contacto NC enclavado; al pulsarla da 0 hasta que se rearma.'),
  lamp: N_('Piloto: se enciende con una salida del grafcet.'),
  cylinder: N_('Cilindro: sale con A+ y entra con A− (o con muelle). Lleva detectores a0/a1 o pisa finales de carrera; empuja las piezas.'),
  conveyor: N_('Cinta: con su motor en marcha lleva las piezas que tiene encima.'),
  limit: N_('Final de carrera: se acciona cuando lo pisa el vástago de un cilindro o una pieza.'),
  'sensor:optical': N_('Detector óptico (réflex): su haz ve cualquier pieza (y los vástagos) que pase por delante.'),
  'sensor:inductive': N_('Detector inductivo: solo detecta metal y a poca distancia. Para separar piezas de metal de las de plástico.'),
  'sensor:capacitive': N_('Detector capacitivo: detecta cualquier material (plástico, metal…) a poca distancia.'),
  'sensor:color': N_('Detector de color: solo da 1 con piezas del color elegido. Para clasificar por colores.'),
  distance: N_('Sensor de distancia (ultrasonidos): valor analógico proporcional a la distancia al primer objeto de su haz.'),
  pickplace:
    N_('Pick & place: cilindro horizontal X y vertical Z montado en su vástago. Asigna a Z la ventosa (vacío) para coger la pieza que toca y llevarla con los dos vástagos.'),
  diverter: N_('Desviador: mientras su salida está activa, empuja las piezas de su zona hacia donde apunta la flecha (para sacarlas de una cinta).'),
  ramp: N_('Rampa: las piezas resbalan solas hasta su extremo (a la salida de una cinta, hacia una recogida…).'),
  platform: N_('Plataforma: superficie fija (mesa, estante, suelo). Las piezas no la atraviesan y, en la vista de frente, se apoyan en ella.'),
  stop: N_('Tope / pared: para las piezas (en una cinta se acumulan detrás). Un cilindro que empuja una pieza contra él se queda a medio recorrido y su final de carrera no llega.'),
  siren: N_('Sirena: avisa (con sonido, si se activa en sus propiedades) mientras su salida está activa.'),
  trafficlight: N_('Semáforo: tres luces (rojo, ámbar y verde), cada una con su salida.'),
  valve: N_('Electroválvula: abierta (azul) mientras su salida está activa. Para dibujar el circuito de un depósito.'),
  barrier: N_('Barrera: se abre con su orden y se cierra con la suya o por su peso; finales de carrera de abierta y cerrada. Mientras no está abierta, para las piezas.'),
  pipe: N_('Tubería: decoración; se pinta de azul, con el fluido moviéndose, mientras la variable elegida está activa.'),
  label: N_('Rótulo: texto libre en la escena (nombre de la estación, zonas…).'),
  image: N_('Imagen: una foto o un plano de fondo (se dibuja debajo de todo).'),
  scale: N_('Báscula: valor analógico con el peso (kg) de las piezas que tiene encima; el metal pesa el triple.'),
  potentiometer: N_('Potenciómetro: entrada analógica manual (consignas, velocidades…). En modo Usar, arrastra a izquierda o derecha.'),
  heater: N_('Calentador: la resistencia sube la temperatura (analógica, °C) con inercia; termostato digital opcional.'),
  feeder: N_('Alimentador: suelta piezas solo, con una salida del grafcet o al pulsarlo en modo Usar.'),
  sink: N_('Recogida: retira y cuenta las piezas que caen dentro.'),
  tank: N_('Depósito: se llena y vacía con sus válvulas; sensores de nivel bajo y alto y nivel analógico.'),
  motor: N_('Motor: gira mientras su salida está activa (al revés con la salida de giro inverso).'),
  display: N_('Visualizador: muestra el valor de una variable (contador, analógica…).'),
}
const PREVIEW_DELAY = 450

// Dibujo de muestra de un módulo (con sus valores por defecto y «en marcha»).
function ModulePreview({ item }) {
  const { type } = item
  if (item.key === 'pickplace') {
    const base = { type: 'cylinder', rot: 0, ...SCENE_TYPES.cylinder.defaults }
    const values = { E: 1, V: 1 }
    return (
      <svg viewBox="-10 -30 270 140" className="mx-auto block max-h-28 w-full" aria-hidden="true">
        <CylinderShape e={{ ...base, stroke: 160 }} pos={0.4} values={{}} />
        <g transform="translate(152 0) rotate(90)">
          <CylinderShape e={{ ...base, stroke: 40, vacuum: 'V', extend: 'E' }} pos={0.6} values={values} />
        </g>
        <rect x="139" y="102" width="28" height="28" rx="3" fill={COLORS.amber} stroke={INK} />
      </svg>
    )
  }
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
    diverter: <DiverterShape e={e} active />,
    ramp: <RampShape e={e} />,
    platform: <PlatformShape e={e} />,
    siren: <SirenShape on />,
    trafficlight: <TrafficLightShape e={{ ...e, green: 'V' }} values={values} />,
    valve: <ValveShape open />,
    pipe: <PipeShape e={{ ...e, length: 120 }} flowing t={0} />,
    barrier: <BarrierShape e={e} pos={0.4} />,
    label: <LabelShape e={{ ...e, text: tr('Estación 1') }} />,
    image: <ImageShape e={{ ...e, width: 160, height: 100 }} />,
  }
  const b = boundsOf(
    type === 'conveyor' ? { ...e, length: 160 } : type === 'distance' ? { ...e, range: 120 } : type === 'pipe' ? { ...e, length: 120 } : type === 'image' ? { ...e, width: 160, height: 100 } : type === 'label' ? { ...e, text: tr('Estación 1') } : e,
    type === 'barrier' ? 0.4 : 1,
  )
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
const SENSOR_PALETTE = { optical: N_('Detector óptico'), inductive: N_('Detector inductivo'), capacitive: N_('Detector capacitivo'), color: N_('Detector de color') }
const PALETTE_ITEMS = Object.entries(SCENE_TYPES).flatMap(([type, t]) =>
  type === 'sensor'
    ? Object.entries(SENSOR_KINDS).map(([kind, k]) => ({
        key: `sensor:${kind}`,
        type,
        group: t.group,
        label: SENSOR_PALETTE[kind],
        preset: { kind, range: k.range },
      }))
    : type === 'cylinder'
      ? [
          { key: type, type, group: t.group, label: t.label, preset: {} },
          { key: 'pickplace', type, group: t.group, label: N_('Pick & place (2 cilindros)'), preset: {} },
        ]
      : type === 'platform'
        ? [
            { key: type, type, group: t.group, label: t.label, preset: {} },
            { key: 'stop', type, group: t.group, label: N_('Tope / pared'), preset: { length: 40, rot: 90, text: tr('Tope') } },
          ]
          : [{ key: type, type, group: t.group, label: t.label, preset: {} }],
)
const PALETTE = PALETTE_ITEMS.reduce((groups, item) => ({ ...groups, [item.group]: [...(groups[item.group] ?? []), item] }), {})
// Imagen elegida para la escena: reducida (lado mayor ≤ 1200 px) para que el proyecto no pese
// demasiado (se guarda dentro de él); PNG si es pequeña (conserva transparencias), si no JPEG.
async function loadImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.round(img.naturalWidth * k)
    const height = Math.round(img.naturalHeight * k)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    const png = file.type === 'image/png' && file.size < 400_000
    const src = canvas.toDataURL(png ? 'image/png' : 'image/jpeg', 0.85)
    // En la escena, a un tamaño cómodo (lo más ancho, 400 px).
    const show = Math.min(1, 400 / width)
    return { src, width: Math.round(width * show), height: Math.round(height * show) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Elementos por los que pasan las piezas: se dibujan debajo de todo.
const UNDER = ['image', 'pipe', 'conveyor', 'sink', 'ramp', 'diverter', 'platform']

// Panel de control: los mandos y la señalización pueden ir en un panel fijo, aparte del
// mecanismo (como el cuadro eléctrico real). e.place: 'desk' | 'machine' (por defecto, máquina).
// En la isométrica, los rótulos esquivan los volúmenes salvo los alargados (van en el suelo delante).
const ISO_LONG = ['conveyor', 'platform', 'ramp', 'pipe', 'image']
const DESK_TYPES = ['button', 'switch', 'emergency', 'potentiometer', 'lamp', 'display']
const isDesk = (e) => DESK_TYPES.includes(e.type) && e.place === 'desk'


// Dibujo de un elemento en un estado dado (lo usan la escena interactiva y la estática).
function drawElement(e, { scene, state, values, time, signals }) {
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
    case 'diverter':
      return <DiverterShape e={e} active={isOn(values, e.gate) && state.faults?.[e.id] !== 'stuck'} />
    case 'ramp':
      return <RampShape e={e} />
    case 'platform':
      return <PlatformShape e={e} />
    case 'siren':
      return <SirenShape on={isOn(values, e.variable)} />
    case 'trafficlight':
      return <TrafficLightShape e={e} values={values} />
    case 'valve':
      return <ValveShape open={isOn(values, e.variable)} />
    case 'pipe':
      return <PipeShape e={e} flowing={isOn(values, e.variable)} t={time} />
    case 'barrier':
      return <BarrierShape e={e} pos={pos} />
    case 'label':
      return <LabelShape e={e} />
    case 'image':
      return <ImageShape e={e} />
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

// Escena estática (sin interacción), en su estado inicial y encuadrada: para el dossier.
// Con rótulos y, debajo, las variables de cada elemento con su dirección. Los del panel, en una
// fila aparte debajo de la máquina.
export function SceneStatic({ scene, variables = [] }) {
  const elements = scene?.elements ?? []
  const state = sceneInit(scene)
  const signals = sceneSignals(scene ?? { elements: [] }, state)
  const address = new Map(variables.map((v) => [v.name, v.address]))
  // Variables con su dirección, de dos en dos por línea (como en la escena interactiva).
  const io = (e) => {
    const items = (SCENE_VARS[e.type] ?? [])
      .map(([key]) => e[key])
      .filter(Boolean)
      .map((n) => (address.get(n) ? `${n} ${address.get(n)}` : n))
    const lines = []
    for (let i = 0; i < items.length; i += 2) lines.push(items.slice(i, i + 2).join(' · '))
    return lines
  }
  const turns = (e) => !['button', 'switch', 'emergency', 'lamp', 'sink', 'feeder', 'tank', 'motor', 'display', 'scale', 'potentiometer', 'heater', 'siren', 'trafficlight', 'label', 'image'].includes(e.type)
  const desk = elements.filter((e) => DESK_TYPES.includes(e.type) && e.place === 'desk')
  const machine = elements.filter((e) => !desk.includes(e))
  const boxes = machine.map((e) => boundsOf(placed(scene, state, e), 1))
  const spots = layoutLabels(
    machine.map((e, i) => ({ e, b: withRelief(boxes[i], scene?.relief), text: labelOf(e), lines: io(e).length })),
    scene?.gravity,
  )
  // Recortada a lo que hay (antes incluía siempre el origen y un mínimo: en el PDF, mucho blanco
  // sobre una máquina dibujada lejos del origen o sobre un pupitre sin máquina).
  const any = boxes.length > 0
  const minX = (any ? Math.min(...boxes.map((b) => b.x)) : 0) - 20
  const minY = (any ? Math.min(...boxes.map((b) => b.y)) : 0) - 20
  const maxX = (any ? Math.max(...boxes.map((b) => b.x + b.w)) : 200) + 40
  const machineBottom = any ? Math.max(...boxes.map((b) => b.y + b.h + 34 + 11 * Math.max(0, io(machine[boxes.indexOf(b)]).length - 1))) + 10 : -20
  // Ancho: también el de las líneas de variables (≈ 5,5 px por carácter a 9 px).
  const textRight = Math.max(0, ...machine.map((e, i) => boxes[i].x + boxes[i].w / 2 + Math.max(0, ...io(e).map((l) => l.length)) * 2.8))
  const deskY = machineBottom + 30
  const width = Math.max(maxX - minX, textRight + 20 - minX, desk.length * 100 + 40)
  const height = deskY - minY + (desk.length ? 110 : 0)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox={`${minX} ${minY} ${width} ${height}`} fontFamily="Inter, Helvetica, Arial, sans-serif">
      <rect x={minX} y={minY} width={width} height={height} fill="white" />
      {scene?.relief && <ReliefLayer scene={scene} state={state} elements={machine} />}
      {[...machine]
        .sort((a, b) => (UNDER.includes(a.type) ? -1 : 0) - (UNDER.includes(b.type) ? -1 : 0))
        .map((raw) => {
          const e = placed(scene, state, raw)
          const at = spots.get(e.id)
          return (
            <g key={e.id}>
              <g transform={`translate(${e.x} ${e.y})${turns(e) ? ` rotate(${e.rot ?? 0})` : ''}`}>{drawElement(e, { scene, state, values: {}, time: 0, signals })}</g>
              {at && e.type !== 'label' && !((e.type === 'image' || e.type === 'pipe') && !e.text) && (
                <text x={at.x} y={at.y} textAnchor={at.anchor} fontSize="11" fill="#334155">
                  {labelOf(e)}
                </text>
              )}
              {at && io(e).map((line, i) => (
                <text key={line} x={at.x} y={at.y + 12 + i * 11} textAnchor={at.anchor} fontSize="9" fontFamily="Courier New, monospace" fill="#2563eb">
                  {line}
                </text>
              ))}
            </g>
          )
        })}
      {desk.length > 0 && (
        <g>
          <rect x={minX + 10} y={deskY - 20} width={width - 20} height="110" rx="4" fill="#cbd5e1" />
          <text x={minX + 18} y={deskY - 6} fontSize="10" fontWeight="600" fill="#334155">
            {tr('Panel de control')}
          </text>
          {desk.map((e, i) => {
            const x = minX + 60 + i * 100
            return (
              <g key={e.id}>
                <g transform={`translate(${x} ${deskY + 30})`}>{drawElement({ ...e, x: 0, y: 0 }, { scene, state, values: {}, time: 0, signals })}</g>
                <text x={x} y={deskY + 72} textAnchor="middle" fontSize="10" fill="#334155">
                  {labelOf(e)}
                </text>
                {io(e).map((line, i) => (
                  <text key={line} x={x} y={deskY + 83 + i * 10} textAnchor="middle" fontSize="8.5" fontFamily="Courier New, monospace" fill="#2563eb">
                    {line}
                  </text>
                ))}
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}

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
// editLocked: ejercicio con la planta bloqueada (solo se usa: no se edita).
export default function SceneView({ scene, onChange, worldState, values, time, variables, onAction, onHistory, onCreateVariable, maximized, onToggleMaximize, onClose, editLocked = false }) {
  const elements = scene?.elements ?? []
  const [modeState, setMode] = useState('use')
  const mode = editLocked ? 'use' : modeState
  // Selección: ids de los elementos (Ctrl+clic añade o quita; recuadro con el ratón).
  const [selection, setSelection] = useState([])
  const selected = selection.length === 1 ? selection[0] : null
  const setSelected = (id) => setSelection(id ? [id] : [])
  const [zoom, setZoom] = useState(0.8)
  const [drag, setDrag] = useState(null) // { ids, start: { x, y }, dx, dy }
  const [marquee, setMarquee] = useState(null) // { x0, y0, x1, y1, add }
  // «Mis grupos»: guardados en este navegador.
  const [groups, setGroups] = useState(loadGroups)
  const [groupName, setGroupName] = useState('')
  const [groupMessage, setGroupMessage] = useState(null)
  const importRef = useRef(null)
  const changeGroups = (list) => {
    setGroups(list)
    if (!storeGroups(list)) setGroupMessage(tr('No se han podido guardar los grupos en este navegador.'))
  }
  const saveSelectionAsGroup = () => {
    const name = groupName.trim()
    if (!name) return
    const chosen = elements.filter((e) => selection.includes(e.id))
    changeGroups([...groups.filter((g) => g.name !== name), makeGroup(name, chosen)])
    setGroupName('')
    setGroupMessage(tr('Guardado «{nombre}» en Mis grupos.', { nombre: name }))
  }
  const [showIO, setShowIO] = useState(false) // rótulos con las variables y sus direcciones
  const [ioOpen, setIoOpen] = useState(false) // panel de conexiones
  const [panning, setPanning] = useState(null) // { x, y, left, top }: arrastre con la rueda pulsada
  // Deshacer / rehacer de la escena (aparte del historial del grafcet).
  const history = useRef({ past: [], future: [] })
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 }) // para los botones
  const svgRef = useRef(null)
  const floorRef = useRef(null) // el suelo de la escena (con la matriz de la isométrica)
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
    // En la isométrica, el contorno en la pantalla (con hueco a los lados para los rótulos).
    const boxes = list.map((e) => (isIso(scene) ? ((b) => ({ x: b.x - 50, y: b.y, w: b.w + 100, h: b.h + 20 }))(isoScreenBox(boundsOf(e, 1), 0, 60)) : boundsOf(e, 1)))
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
  // Al pasar a la isométrica (o volver al plano), todo cambia de sitio: se reencuadra.
  const isoOn = isIso(scene)
  const isoBefore = useRef(isoOn)
  useEffect(() => {
    if (isoBefore.current === isoOn) return
    isoBefore.current = isoOn
    fit()
  }, [isoOn, fit])
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
  // Potenciómetros: valor actual y ajuste relativo (rueda, flechas del teclado, arrastre táctil).
  const knobOf = (id) => state.knob?.[id] ?? Number(elements.find((x) => x.id === id)?.initial ?? 0.5)
  const nudgeKnob = (id, delta) => onAction(id, `set:${Math.round(Math.min(1, Math.max(0, knobOf(id) + delta)) * 1000) / 1000}`)
  const nudgeRef = useRef(nudgeKnob)
  nudgeRef.current = nudgeKnob
  const modeRef = useRef(mode)
  modeRef.current = mode
  // Rueda sobre un potenciómetro (modo Usar): lo gira en vez de hacer zoom. 1 % por paso; con
  // Mayús, 0,1 % (ajuste fino); con Ctrl, 10 %. Escucha en captura para adelantarse al zoom.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const onWheel = (ev) => {
      if (modeRef.current !== 'use') return
      const knob = ev.target.closest?.('[data-element="potentiometer"][data-id]')
      if (!knob) return
      ev.preventDefault()
      ev.stopPropagation()
      const step = ev.shiftKey ? 0.001 : ev.ctrlKey ? 0.1 : 0.01
      const delta = ev.deltaY || ev.deltaX
      if (delta) nudgeRef.current(knob.dataset.id, delta < 0 ? step : -step)
    }
    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  // Flechas: ±1 % (con Mayús, ±0,1 %); Re Pág / Av Pág: ±10 %; Inicio / Fin: 0 y 100 %.
  const onKnobKey = (ev, e) => {
    if (mode !== 'use') return
    const step = ev.shiftKey ? 0.001 : 0.01
    const deltas = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: 0.1, PageDown: -0.1, Home: -1, End: 1 }
    if (!(ev.key in deltas)) return
    ev.preventDefault()
    ev.stopPropagation()
    nudgeKnob(e.id, deltas[ev.key])
  }
  // Accesible: un control deslizante (con su valor en %).
  const knobProps = (e) =>
    e.type === 'potentiometer' && mode === 'use'
      ? {
          tabIndex: 0,
          role: 'slider',
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': Math.round(knobOf(e.id) * 100),
          title: tr('Rueda del ratón o flechas: ajuste fino (con Mayús, más fino)'),
          onKeyDown: (ev) => onKnobKey(ev, e),
        }
      : {}
  const signals = sceneSignals(scene ?? { elements: [] }, state)
  // Sirenas con sonido: dos tonos mientras alguna está activa (Web Audio; sin él, en silencio).
  const sounding = elements.some((e) => e.type === 'siren' && e.sound && isOn(values, e.variable))
  useEffect(() => {
    if (!sounding || typeof AudioContext === 'undefined') return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.value = 0.04
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    const id = setInterval(() => {
      osc.frequency.value = osc.frequency.value === 880 ? 660 : 880
    }, 400)
    return () => {
      clearInterval(id)
      osc.stop()
      ctx.close()
    }
  }, [sounding])
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
    if (stamp && !ev.ctrlKey && !ev.metaKey) {
      const k = ev.key.toLowerCase()
      if (k === 'escape') setStamp(null)
      else if (k === 'r') setStamp({ ...stamp, rot: ((stamp.rot ?? 0) + 90) % 360 })
      else if (k === 'enter') addItem(stamp.item)
      else return
      ev.preventDefault()
      return
    }
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
  // Pick & place: un cilindro horizontal (X) y uno vertical (Z) montado en su vástago, con ventosa.
  const addPickPlace = (at = null) => {
    const el = scrollRef.current
    const x = snap(at ? at.x - 120 : el ? (el.scrollLeft + el.clientWidth / 2) / zoom - 120 : W / 2 - 120)
    const y = snap(at ? at.y - 60 : el ? (el.scrollTop + el.clientHeight / 2) / zoom - 60 : H / 2 - 60)
    const base = SCENE_TYPES.cylinder.defaults
    const X = { id: newId(), type: 'cylinder', x, y, rot: 0, ...base, stroke: 160, text: 'X' }
    const Z = { id: newId(), type: 'cylinder', x: x + 88, y, rot: 90, ...base, stroke: 80, time: 0.5, text: 'Z', mountedOn: X.id }
    save([...elements, X, Z])
    setSelection([Z.id])
    setMode('edit')
  }
  const addGroup = (group, at = null) => {
    const el = scrollRef.current
    const corner = at ?? { x: el ? (el.scrollLeft + el.clientWidth / 2) / zoom - 60 : W / 2, y: el ? (el.scrollTop + el.clientHeight / 2) / zoom - 60 : H / 2 }
    const items = placeGroup(group, { x: snap(corner.x), y: snap(corner.y) }, newId)
    save([...elements, ...items])
    setSelection(items.map((e) => e.id))
    setMode('edit')
  }
  const addItem = (item, at = null, place = null) => {
    if (item.savedGroup) return addGroup(item.savedGroup, at)
    return item.key === 'pickplace' ? addPickPlace(at) : add(item.type, item.preset, at, place)
  }
  // Lo arrastrado desde la paleta: un módulo o uno de «Mis grupos».
  const dropped = (ev) => {
    const key = ev.dataTransfer.getData(DRAG_TYPE)
    if (key.startsWith('group:')) {
      const group = groups.find((g) => g.id === key.slice(6))
      return group ? { key, savedGroup: group } : null
    }
    return PALETTE_BY_KEY[key] ?? null
  }

  // Mandos y señalización: con un clic (o soltados en el panel) van al panel; soltados en la
  // escena, a la máquina.
  // Elemento nuevo del tipo, con sus valores por defecto (textos en el idioma elegido).
  const makeElement = (type, preset, x, y, rot = 0, place = null) => ({
    id: newId(),
    type,
    x,
    y,
    rot,
    ...SCENE_TYPES[type].defaults,
    ...(SCENE_TYPES[type].defaults.text ? { text: tr(SCENE_TYPES[type].defaults.text) } : {}),
    ...preset,
    ...(place ? { place } : {}),
  })
  // Zona de la escena que se ve ahora (para poner lo nuevo a la vista).
  const visibleArea = () => {
    const el = scrollRef.current
    return el ? { x: el.scrollLeft / zoom, y: el.scrollTop / zoom, w: el.clientWidth / zoom, h: el.clientHeight / zoom } : { x: 0, y: 0, w: W, h: H }
  }
  // Sin `at` (doble clic en la paleta), en el primer hueco libre de la zona visible: no encima de
  // lo que ya hay. Los mandos y pilotos, al panel.
  const add = (type, preset = {}, at = null, place = null) => {
    const where = place ?? (DESK_TYPES.includes(type) && !at ? 'desk' : null)
    let x = at ? snap(at.x) : 0
    let y = at ? snap(at.y) : 0
    if (!at && !where) {
      const probe = makeElement(type, preset, 0, 0)
      ;({ x, y } = freeSpot(probe, elements.filter((e) => !isDesk(e)), (e) => boundsOf(e, 1), visibleArea()))
    }
    const element = makeElement(type, preset, x, y, 0, where)
    save([...elements, element])
    setSelected(element.id)
    setMode('edit')
  }

  // Tampón: con un clic en la paleta, la pieza queda «cargada»; cada clic en la escena pone una
  // (vista previa fantasma bajo el cursor; R la gira) y arrastrar pone una fila (pincel). Esc, el
  // clic derecho o volver a pulsarla en la paleta lo descargan.
  const [stamp, setStamp] = useState(null) // { item, rot }
  const [stampAt, setStampAt] = useState(null) // punto bajo el cursor (escena)
  const [stampDrag, setStampDrag] = useState(null) // { from, to }
  const stampable = (item) => !item.savedGroup && item.key !== 'pickplace'
  // Al pasar a Usar, el tampón se descarga.
  useEffect(() => {
    if (mode !== 'edit') setStamp(null)
  }, [mode])
  const toggleStamp = (item) => {
    setStampDrag(null)
    setStamp((s) => (s?.item.key === item.key ? null : { item, rot: 0 }))
    setSelection([])
    setMode('edit')
  }
  const stampGhost = (x, y) => makeElement(stamp.item.type, stamp.item.preset, x, y, stamp.rot)
  const stampPoints = () => {
    if (!stamp) return []
    if (stampDrag) {
      const b = boundsOf(stampGhost(0, 0), 1)
      return stampRow(stampDrag.from, stampDrag.to, { w: b.w, h: b.h })
    }
    return stampAt ? [stampAt] : []
  }
  const placeStamp = (points, place = null) => {
    if (!stamp || !points.length) return
    const made = points.map((p) => makeElement(stamp.item.type, stamp.item.preset, snap(p.x), snap(p.y), stamp.rot, place))
    save([...elements, ...made]) // una fila entera, un solo paso de deshacer
  }

  const toScene = (ev) => {
    const point = svgRef.current.createSVGPoint()
    point.x = ev.clientX
    point.y = ev.clientY
    const p = point.matrixTransform((floorRef.current ?? svgRef.current).getScreenCTM().inverse())
    return { x: p.x, y: p.y }
  }

  // Orden en el panel: intercambia el elemento con el anterior o el siguiente del panel.
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

  // Panel: los mismos mandos que en la escena, en celdas fijas (el potenciómetro, por la
  // posición del ratón en su celda).
  // Con el ratón, el valor es la posición en la celda; con el dedo (difícil de colocar con
  // precisión), el arrastre es relativo y lento: no salta al tocar y cuatro anchos de celda
  // recorren todo el rango.
  const [deskKnob, setDeskKnob] = useState(null) // { id, touch, x0, v0 }
  const turnDeskKnob = (ev, e) => {
    const r = ev.currentTarget.getBoundingClientRect()
    if (deskKnob?.touch) {
      const value = deskKnob.v0 + (ev.clientX - deskKnob.x0) / (r.width * 4)
      onAction(e.id, `set:${Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000}`)
    } else onAction(e.id, `set:${Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))}`)
  }
  const onDeskDown = (ev, e) => {
    ev.stopPropagation()
    sectionRef.current?.focus({ preventScroll: true })
    if (mode === 'use') {
      ev.currentTarget.setPointerCapture?.(ev.pointerId)
      if (e.type === 'potentiometer') {
        ev.currentTarget.focus({ preventScroll: true }) // para seguir con las flechas
        if (ev.pointerType === 'touch') setDeskKnob({ id: e.id, touch: true, x0: ev.clientX, v0: knobOf(e.id) })
        else {
          setDeskKnob({ id: e.id })
          turnDeskKnob(ev, e)
        }
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

  // Pantalla táctil: dos dedos pellizcan (zoom) y arrastran (desplazar) a la vez. Con un dedo, lo
  // de siempre: arrastrar el fondo desplaza y arrastrar un elemento lo mueve.
  const touches = useRef(new Map())
  const pinch = useRef(null)
  const pinchInfo = () => {
    const [a, b] = [...touches.current.values()]
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
  }
  const pinchDown = (ev) => {
    if (ev.pointerType !== 'touch') return false
    touches.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (touches.current.size !== 2) return false
    // Segundo dedo: se deja lo que hiciera el primero y empieza el gesto.
    const el = scrollRef.current
    const rect = el.getBoundingClientRect()
    const { dist, mid } = pinchInfo()
    pinch.current = { dist, zoom: zoomRef.current, sx: (el.scrollLeft + mid.x - rect.left) / zoomRef.current, sy: (el.scrollTop + mid.y - rect.top) / zoomRef.current }
    setPanning(null)
    setDrag(null)
    setMarquee(null)
    setResize(null)
    ev.stopPropagation()
    return true
  }
  const pinchMove = (ev) => {
    if (ev.pointerType !== 'touch' || !touches.current.has(ev.pointerId)) return false
    touches.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    if (!pinch.current || touches.current.size < 2) return false
    ev.stopPropagation()
    const el = scrollRef.current
    const rect = el.getBoundingClientRect()
    const { dist, mid } = pinchInfo()
    const next = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (pinch.current.zoom * dist) / pinch.current.dist)) * 100) / 100
    // El punto de la escena que estaba entre los dedos sigue entre los dedos.
    pendingScroll.current = { left: pinch.current.sx * next - (mid.x - rect.left), top: pinch.current.sy * next - (mid.y - rect.top) }
    zoomRef.current = next
    setZoom(next)
    if (next === zoom) {
      el.scrollLeft = pendingScroll.current.left
      el.scrollTop = pendingScroll.current.top
    }
    return true
  }
  const pinchUp = (ev) => {
    if (ev.pointerType !== 'touch') return
    touches.current.delete(ev.pointerId)
    if (touches.current.size < 2) pinch.current = null
  }

  // Tiradores (modo Editar, un elemento seleccionado): arrastrar cambia su medida (lib/sim/
  // sceneHandles.js). Se ve la medida mientras tanto; al soltar se guarda (un paso de deshacer).
  // Un cilindro montado en otro se dibuja donde está ahora: de él solo cambia la carrera.
  const [resize, setResize] = useState(null) // { id, handle, preview }
  const startResize = (ev, original, handle) => {
    ev.stopPropagation()
    ev.preventDefault()
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    setResize({ id: original.id, handle, preview: original })
  }
  const moveResize = (ev, drawn) => {
    if (!resize) return
    const original = elements.find((x) => x.id === resize.id)
    const next = applyResize(drawn, resize.handle, toScene(ev), { keepRatio: ev.shiftKey })
    const preview = drawn.type === 'cylinder' ? { ...original, stroke: next.stroke } : next
    setResize({ ...resize, preview })
  }
  const endResize = () => {
    if (!resize) return
    const original = elements.find((x) => x.id === resize.id)
    if (original && JSON.stringify(original) !== JSON.stringify(resize.preview)) save(elements.map((x) => (x.id === resize.id ? resize.preview : x)))
    setResize(null)
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
  // Fondo, como en el lienzo del grafcet: arrastrar desplaza la vista (un clic quita la
  // selección); Mayús+arrastrar, recuadro de selección (modo Editar; con Ctrl, se añade).
  const onBackgroundDown = (ev) => {
    sectionRef.current?.focus({ preventScroll: true })
    if (ev.button !== 0) return
    const add = ev.ctrlKey || ev.metaKey
    if (!add) setSelection([])
    ev.currentTarget.setPointerCapture?.(ev.pointerId)
    if (mode === 'edit' && ev.shiftKey) {
      const p = toScene(ev)
      setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, add })
      return
    }
    const el = scrollRef.current
    if (el) setPanning({ x: ev.clientX, y: ev.clientY, left: el.scrollLeft, top: el.scrollTop })
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

  const shown = elements.map((e) => (drag?.ids.includes(e.id) ? { ...e, x: e.x + drag.dx, y: e.y + drag.dy } : resize?.id === e.id ? resize.preview : e))
  // Los cilindros montados en el vástago de otro, donde están ahora.
  const machine = shown.filter((e) => !isDesk(e)).map((e) => (e.type === 'cylinder' ? placed(scene ?? { elements: [] }, state, e) : e))
  const labelled = (e) => !(e.type === 'label' || ((e.type === 'image' || e.type === 'pipe') && !e.text))
  const iso = isIso(scene)
  const isoOf = (e) => isoBoxes(scene ?? { elements: [] }, state, e)
  const planSpots = layoutLabels(
    machine.map((e) => ({ e, b: withRelief(boundsOf(e, 1), scene?.relief && !iso), text: labelled(e) ? labelOf(e) : '', lines: showIO ? ioLines(e).length : 0 })),
    scene?.gravity,
  )
  // En la isométrica, los rótulos del plano llevados a la pantalla y separados si aún se pisan.
  const obstacles = iso
    ? machine.filter((e) => !ISO_LONG.includes(e.type)).flatMap((e) => isoOf(e).boxes.map((b) => ({ id: e.id, r: isoScreenBox(b.r, b.base, b.base + b.h) })))
    : []
  const labelSpots = iso
    ? isoLabels(machine.filter((e) => planSpots.has(e.id)), labelOf, showIO ? (e) => ioLines(e).length : () => 0, obstacles, (e) => isoScreenBox(boundsOf(e, 1), 0, isoOf(e).top))
    : planSpots
  const deskItems = elements.filter(isDesk)
  const draw = (e) => drawElement(e, { scene, state, values, time, signals })
  // Los mandos y pilotos no se giran (su rótulo se lee siempre).
  const turns = (e) => !['button', 'switch', 'emergency', 'lamp', 'sink', 'feeder', 'tank', 'motor', 'display', 'scale', 'potentiometer', 'heater', 'siren', 'trafficlight', 'label', 'image'].includes(e.type)
  const operable = (e) => ['button', 'switch', 'emergency', 'feeder', 'potentiometer'].includes(e.type)
  const underRank = (e) => (e.type === 'image' ? -2 : UNDER.includes(e.type) ? -1 : 0)
  // Elementos y piezas en orden de dibujo: lo de debajo primero (las piezas van encima). En la
  // isométrica, además, del fondo hacia delante, con las piezas entre los demás elementos.
  const sceneItems = iso
    ? [
        ...machine.filter((e) => underRank(e) < 0).sort((a, b) => underRank(a) - underRank(b) || isoKey(boundsOf(a, 1)) - isoKey(boundsOf(b, 1))).map((e) => ({ e })),
        ...[
          ...machine.filter((e) => underRank(e) === 0).map((e) => ({ e, key: isoKey(boundsOf(e, 1)) })),
          ...state.pieces.map((p) => ({ piece: p, z: pieceLift(scene, state, p, machine), key: isoKey({ x: p.x, y: p.y, w: p.w, h: p.h }) })),
        ].sort((a, b) => a.key - b.key),
      ]
    : [...[...machine].sort((a, b) => underRank(a) - underRank(b)).map((e) => ({ e })), ...state.pieces.map((p) => ({ piece: p }))]
  const renderElement = (e) => {
    const volume = iso ? isoOf(e) : null
    const up = lift(volume?.top ?? 0)
    return (
          <g
            key={e.id}
            data-element={e.type}
            data-id={e.id}
            data-pos={e.type === 'cylinder' ? (state.pos[e.id] ?? 0).toFixed(2) : undefined}
            aria-label={`${tr(SCENE_TYPES[e.type].label)} ${labelOf(e)}`}
            {...knobProps(e)}
            style={{ cursor: mode === 'edit' ? 'move' : operable(e) ? 'pointer' : 'default' }}
            onPointerDown={(ev) => onPointerDown(ev, e)}
            onPointerUp={(ev) => onPointerUp(ev, e)}
            onPointerCancel={(ev) => onPointerUp(ev, e)}
          >
            {iso && <IsoFaces boxes={volume.boxes} />}
            {iso && volume.post && <line x1={e.x} y1={e.y} x2={e.x + up.x} y2={e.y + up.y} stroke="#64748b" strokeWidth="3" />}
            <g transform={iso && volume.top ? `translate(${up.x} ${up.y})` : undefined}>
              {/* Zona de clic: todo el contorno (también los huecos del dibujo). */}
              {(() => {
                const b = boundsOf(e, state.pos[e.id] ?? 0)
                return <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />
              })()}
              <g data-shape="" transform={`translate(${e.x} ${e.y})${turns(e) ? ` rotate(${e.rot ?? 0})` : ''}`}>{draw(e)}</g>
            </g>
          </g>
    )
  }

  return (
    <section
      aria-label={tr('Escena de la planta')}
      data-tour="planta"
      ref={sectionRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`scene-touch side-panel @container flex outline-none min-w-0 flex-col border-l border-slate-200 bg-white ${maximized ? 'absolute inset-y-0 left-0 right-80 z-20' : 'relative'}`}
      style={maximized ? undefined : { width: width ?? '50%', flexShrink: 1, minWidth: MIN_WIDTH }}
    >
      {/* Separador: arrastrar para repartir el espacio entre el grafcet y la planta. */}
      {!maximized && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={tr('Ancho de la planta')}
          title={tr('Arrastra para cambiar el ancho de la planta (doble clic: mitad y mitad)')}
          className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-blue-400/40"
          onPointerDown={(ev) => {
            ev.preventDefault() // sin seleccionar el texto de alrededor al arrastrar
            const right = sectionRef.current.getBoundingClientRect().right
            resizing.current = { right, max: maxPanelWidth(sectionRef.current), frame: 0, width: null }
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
        <span className="mr-1 text-sm font-semibold">{tr('Planta')}</span>
        <div className="flex rounded-md border border-slate-300 p-0.5" role="radiogroup" aria-label={tr('Modo de la escena')}>
          {[
            ['use', tr('Usar'), Hand, tr('Accionar pulsadores, interruptores y alimentadores')],
            ['edit', tr('Editar'), MousePointer2, tr('Colocar, mover y configurar elementos')],
          ]
            .filter(([id]) => !(editLocked && id === 'edit'))
            .map(([id, label, Icon, title]) => (
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
          title={tr('Rótulos con las variables y sus direcciones')}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${showIO ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
        >
          <Tag size={12} /> E/S
        </button>
        <button
          type="button"
          onClick={() => setIoOpen((v) => !v)}
          aria-pressed={ioOpen}
          title={tr('Qué está conectado y qué falta')}
          aria-label={tr('Conexiones')}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${ioOpen ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
        >
          {/* Con la planta estrecha, solo los iconos: la cabecera no salta a dos líneas. */}
          <Cable size={12} /> <span className="hidden @3xl:inline">{tr('Conexiones')}</span>
          {ioWarnings > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">{ioWarnings}</span>}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...(scene ?? {}), gravity: !scene?.gravity })}
          aria-pressed={Boolean(scene?.gravity)}
          aria-label={tr('Gravedad')}
          title={
            scene?.gravity
              ? tr('Vista de frente: las piezas caen y se apoyan en cintas, plataformas y otras piezas. Pulsa para verla desde arriba (sin gravedad)')
              : tr('Vista desde arriba: las piezas no caen. Pulsa para verla de frente, con gravedad')
          }
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${scene?.gravity ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
        >
          <ArrowDownToLine size={12} /> <span className="hidden @4xl:inline">{tr('Gravedad')}</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...(scene ?? {}), relief: !scene?.relief, view: undefined })}
          aria-pressed={Boolean(scene?.relief)}
          aria-label={tr('Relieve')}
          title={tr('Vista en relieve: cada elemento con su volumen (solo cambia el dibujo)')}
          className={`flex items-center gap-1 rounded border px-2 py-0.5 ${scene?.relief ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
        >
          <Box size={12} /> <span className="hidden @4xl:inline">{tr('Relieve')}</span>
        </button>
        {!scene?.gravity && (
          <button
            type="button"
            onClick={() => onChange({ ...(scene ?? {}), view: isIso(scene) ? undefined : 'iso', relief: false })}
            aria-pressed={isIso(scene)}
            aria-label={tr('Isométrica')}
            title={tr('Vista isométrica: la planta apoyada en el suelo y cada elemento con su altura (solo cambia el dibujo; se edita igual)')}
            className={`flex items-center gap-1 rounded border px-2 py-0.5 ${isIso(scene) ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-300 hover:bg-slate-100'}`}
          >
            <Boxes size={12} /> <span className="hidden @4xl:inline">{tr('Isométrica')}</span>
          </button>
        )}
        <button type="button" onClick={() => onAction(null, 'clear')} title={tr('Quita de la escena todas las piezas (cilindros, cintas y demás elementos se quedan)')} className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
          {tr('Quitar piezas')}
        </button>
        <span className="ml-auto" />
        <button type="button" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.1))} title={tr('Alejar')} className="rounded p-1 hover:bg-slate-100">
          <Minus size={13} />
        </button>
        <span className="w-11 text-center tabular-nums whitespace-nowrap">{Math.round(zoom * 100)} %</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.1))} title={tr('Acercar')} className="rounded p-1 hover:bg-slate-100">
          <Plus size={13} />
        </button>
        <button type="button" onClick={fit} title={tr('Ajustar: ver todos los mandos y el mecanismo')} aria-label={tr('Ajustar la vista')} className="rounded p-1 hover:bg-slate-100">
          <Scan size={14} />
        </button>
        <button type="button" onClick={onToggleMaximize} title={maximized ? tr('Vista dividida con el grafcet') : tr('Pantalla completa')} className="rounded p-1 hover:bg-slate-100">
          {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        <button type="button" onClick={onClose} title={tr('Cerrar la planta')} className="rounded p-1 hover:bg-slate-100">
          <X size={14} />
        </button>
        {/* Tampón cargado: qué se pone y cómo terminar (en una pizarra no hay Esc ni clic derecho).
            Flota sobre la escena: no mueve la paleta (el segundo clic caería en otro botón). */}
        {stamp && mode === 'edit' && (
          <div
            role="status"
            data-stamp-status=""
            className="absolute left-1/2 top-14 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-900 shadow-md"
          >
            <strong>{tr('Poniendo: {pieza}', { pieza: tr(stamp.item.label) })}</strong>
            <span>{tr('clic: una · arrastrar: una fila · R: girar')}</span>
            <button type="button" onClick={() => setStamp(null)} className="ml-auto rounded-md bg-blue-600 px-2 py-0.5 font-medium text-white hover:bg-blue-700">
              {tr('Terminar')}
            </button>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && (
          <nav className="w-32 shrink-0 space-y-2 overflow-y-auto border-r border-slate-200 p-1.5 text-xs" aria-label={tr('Elementos')}>
            {detected.length > 0 && (
              <button
                type="button"
                onClick={() => save([...elements, ...detected])}
                title={tr('A partir de los nombres de las variables: cada salida A+ con A−, a0 y a1 es un cilindro')}
                className="flex w-full items-center gap-1 rounded border border-blue-300 bg-blue-50 px-1 py-0.5 text-left text-blue-800 hover:bg-blue-100"
              >
                <WandSparkles size={12} className="shrink-0" /> Detectar cilindros ({detected.length})
              </button>
            )}
            {Object.entries(PALETTE).map(([group, types]) => (
              <div key={group}>
                <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">{tr(group)}</p>
                {types.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                      if (stampable(item)) toggleStamp(item)
                      else addItem(item)
                    }}
                    onDoubleClick={() => {
                      if (!stampable(item)) return
                      setStamp(null)
                      addItem(item)
                    }}
                    aria-pressed={stampable(item) ? stamp?.item.key === item.key : undefined}
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
                    title={tr('Pulsa y pon uno o varios en la escena (arrastrando, una fila) · doble clic: en un hueco libre · también se puede arrastrar')}
                    onMouseLeave={() => {
                      clearTimeout(previewTimer.current)
                      setPreview(null)
                    }}
                    className={`block w-full rounded px-1 py-0.5 text-left ${stamp?.item.key === item.key ? 'bg-blue-600 text-white' : 'hover:bg-blue-50'}`}
                  >
                    + {tr(item.label)}
                  </button>
                ))}
              </div>
            ))}
            <div aria-label={tr('Mis grupos')}>
              <p className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                {tr('Mis grupos')}
                <span className="ml-auto" />
                <button
                  type="button"
                  title={tr('Exportar mis grupos a un archivo')}
                  aria-label={tr('Exportar mis grupos')}
                  disabled={!groups.length}
                  onClick={() => downloadFile(exportGroups(groups), 'grupos-planta.json', 'application/json')}
                  className="rounded p-0.5 normal-case hover:bg-slate-100 disabled:opacity-30"
                >
                  <Download size={11} />
                </button>
                <button
                  type="button"
                  title={tr('Importar grupos de un archivo')}
                  aria-label={tr('Importar grupos')}
                  onClick={() => importRef.current?.click()}
                  className="rounded p-0.5 normal-case hover:bg-slate-100"
                >
                  <Upload size={11} />
                </button>
              </p>
              <input
                ref={importRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                aria-label={tr('Archivo de grupos')}
                onChange={async (ev) => {
                  const file = ev.target.files?.[0]
                  ev.target.value = ''
                  if (!file) return
                  try {
                    const list = importGroups(await file.text(), groups)
                    changeGroups(list)
                    setGroupMessage(`Importados ${list.length - groups.length} grupos.`)
                  } catch (err) {
                    setGroupMessage(err.message)
                  }
                }}
              />
              {groups.length === 0 && <p className="text-[11px] text-slate-500">{tr('Selecciona varios elementos y pulsa «Guardar como grupo».')}</p>}
              {groups.map((g) => (
                <div key={g.id} className="group flex items-center">
                  <button
                    type="button"
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData(DRAG_TYPE, `group:${g.id}`)
                      ev.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => addGroup(g)}
                    title={tr('{n} elementos · arrastra a la escena o pulsa para ponerlo en el centro', { n: g.elements.length })}
                    className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-blue-50"
                  >
                    + {g.name}
                  </button>
                  <button
                    type="button"
                    aria-label={tr('Borrar el grupo {nombre}', { nombre: g.name })}
                    title={tr('Borrar el grupo')}
                    onClick={() => changeGroups(groups.filter((x) => x.id !== g.id))}
                    className="rounded p-0.5 opacity-0 hover:bg-red-500 hover:text-white group-hover:opacity-100"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {groupMessage && (
                <p role="status" className="mt-1 text-[11px] text-blue-700">
                  {groupMessage}
                </p>
              )}
            </div>
          </nav>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          className={`paper min-h-0 min-w-0 flex-1 overflow-auto ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
          // Rueda pulsada y arrastrar: desplazar la vista (como en el lienzo del grafcet), también
          // empezando encima de un elemento. Con el botón izquierdo, desde el fondo (onBackgroundDown).
          style={{ touchAction: 'none' }}
          onPointerCancelCapture={pinchUp}
          onPointerDownCapture={(ev) => {
            if (pinchDown(ev)) return
            if (ev.button !== 1) return
            ev.preventDefault()
            ev.stopPropagation()
            const el = scrollRef.current
            ev.currentTarget.setPointerCapture(ev.pointerId)
            setPanning({ x: ev.clientX, y: ev.clientY, left: el.scrollLeft, top: el.scrollTop })
          }}
          onPointerMoveCapture={(ev) => {
            if (pinchMove(ev)) return
            if (!panning) return
            ev.stopPropagation()
            scrollRef.current.scrollLeft = panning.left - (ev.clientX - panning.x)
            scrollRef.current.scrollTop = panning.top - (ev.clientY - panning.y)
          }}
          onPointerUpCapture={(ev) => {
            pinchUp(ev)
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
            const item = dropped(ev)
            if (!item) return
            ev.preventDefault()
            addItem(item, toScene(ev))
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
            aria-label={tr('Escena')}
          >
            <defs>
              <pattern id="scene-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="white" />
            <g ref={floorRef} transform={iso ? ISO_MATRIX : undefined}>
            {iso && <rect width={W} height={H} fill="#f1f5f9" stroke="#cbd5e1" data-iso-floor="" />}
            {mode === 'edit' && <rect width={W} height={H} fill="url(#scene-grid)" />}
            {/* Vista de frente: el suelo, donde acaba lo que cae. */}
            {scene?.gravity && <rect x="0" y={SCENE_FLOOR} width={W} height={H - SCENE_FLOOR} fill="#cbd5e1" data-floor="" />}
            {machine.length === 0 && (
              <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="16" fill="#94a3b8">
                {tr('Pulsa «Editar» y añade elementos: pulsadores, cilindros, cintas, detectores…')}
              </text>
            )}
            {scene?.relief && !iso && <ReliefLayer scene={scene} state={state} elements={machine} />}
            {sceneItems.map((item) => (item.piece ? iso ? <IsoPiece key={item.piece.id} p={item.piece} z={item.z} /> : <PieceShape key={item.piece.id} p={item.piece} relief={Boolean(scene?.relief)} /> : renderElement(item.e)))}
          </g>
            {/* Rótulos (sin girar) */}
            {machine.map((e) => {
              // Sin rótulo debajo: los de texto, y las imágenes y tuberías sin nombre propio.
              if (e.type === 'label' || ((e.type === 'image' || e.type === 'pipe') && !e.text)) return null
              const at = labelSpots.get(e.id)
              if (!at) return null // sin texto (p. ej. una plataforma sin nombre)
              return (
                <text
                  key={`l-${e.id}`}
                  data-label-of={e.id}
                  x={at.x}
                  y={at.y}
                  textAnchor={at.anchor}
                  fontSize="11"
                  fill="#334155"
                  pointerEvents="none"
                  {...(iso ? { stroke: 'white', strokeWidth: 3, paintOrder: 'stroke', strokeLinejoin: 'round' } : {})}
                >
                  {labelOf(e)}
                  {showIO &&
                    ioLines(e).map((line) => (
                      <tspan key={line} x={at.x} dy="12" fontSize="9.5" fontFamily="ui-monospace, Consolas, monospace" fill="#2563eb">
                        {line}
                      </tspan>
                    ))}
                </text>
              )
            })}
            <g transform={iso ? ISO_MATRIX : undefined}>
            {machine
              .filter((e) => selection.includes(e.id))
              .map((e) => {
                const b = boundsOf(e, state.pos[e.id] ?? 0)
                return (
                  <rect key={`sel-${e.id}`} data-selected={e.id} x={b.x - 4} y={b.y - 4} width={b.w + 8} height={b.h + 8} fill="none" stroke="#3b82f6" strokeDasharray="4 3" pointerEvents="none" />
                )
              })}
            {mode === 'edit' &&
              selection.length === 1 &&
              !drag &&
              (() => {
                const drawn = machine.find((e) => e.id === selection[0])
                const handles = drawn ? resizeHandles(drawn) : []
                if (!handles.length) return null
                const coarse = coarsePointer()
                const r = (coarse ? 11 : 6) / zoom // tamaño constante en pantalla
                const hit = (coarse ? 24 : 11) / zoom
                const active = resize && handles.find((h) => h.id === resize.handle)
                return (
                  <g data-handles={drawn.id}>
                    {handles.map((h) => (
                      <g
                        key={h.id}
                        data-handle={h.id}
                        style={{ cursor: h.cursor, touchAction: 'none' }}
                        onPointerDown={(ev) => startResize(ev, elements.find((x) => x.id === drawn.id), h.id)}
                        onPointerMove={(ev) => moveResize(ev, drawn)}
                        onPointerUp={endResize}
                        onPointerCancel={endResize}
                      >
                        <circle cx={h.x} cy={h.y} r={hit} fill="transparent" />
                        <rect x={h.x - r} y={h.y - r} width={2 * r} height={2 * r} rx={r * 0.3} fill="white" stroke="#2563eb" strokeWidth={2 / zoom} />
                      </g>
                    ))}
                    {active && (
                      <text
                        x={active.x + 14 / zoom}
                        y={active.y - 12 / zoom}
                        fontSize={13 / zoom}
                        fontWeight="600"
                        fill="#1d4ed8"
                        stroke="white"
                        strokeWidth={4 / zoom}
                        paintOrder="stroke"
                        pointerEvents="none"
                        data-measure=""
                      >
                        {resizeMeasure(drawn)}
                      </text>
                    )}
                  </g>
                )
              })()}
            {stamp &&
              (() => {
                const points = stampPoints()
                const others = elements.filter((e) => !isDesk(e))
                return (
                  <g data-stamp-ghosts={points.length} pointerEvents="none">
                    {points.map((p, i) => {
                      const ghost = stampGhost(snap(p.x), snap(p.y))
                      const bad = collides(ghost, others, (e) => boundsOf(e, 1))
                      const b = boundsOf(ghost, 1)
                      return (
                        <g key={i} opacity={0.5}>
                          <g transform={`translate(${ghost.x} ${ghost.y})${turns(ghost) ? ` rotate(${ghost.rot ?? 0})` : ''}`}>{draw(ghost)}</g>
                          <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} fill="none" stroke={bad ? '#dc2626' : '#2563eb'} strokeWidth={2 / zoom} strokeDasharray="5 3" />
                        </g>
                      )
                    })}
                    {points.length > 1 && (
                      <text
                        x={(() => {
                          const b = boundsOf(stampGhost(snap(points.at(-1).x), snap(points.at(-1).y)), 1)
                          return b.x + b.w + 8 / zoom
                        })()}
                        y={(() => {
                          const b = boundsOf(stampGhost(snap(points.at(-1).x), snap(points.at(-1).y)), 1)
                          return b.y + b.h / 2 + 5 / zoom
                        })()}
                        fontSize={14 / zoom}
                        fontWeight="700"
                        fill="#1d4ed8"
                        stroke="white"
                        strokeWidth={4 / zoom}
                        paintOrder="stroke"
                        data-stamp-count=""
                      >
                        ×{points.length}
                      </text>
                    )}
                  </g>
                )
              })()}
            {stamp && (
              <rect
                data-stamp-layer=""
                x={-10000}
                y={-10000}
                width={20000}
                height={20000}
                fill="transparent"
                style={{ cursor: 'crosshair', touchAction: 'none' }}
                onPointerMove={(ev) => {
                  const p = toScene(ev)
                  setStampAt(p)
                  if (stampDrag) setStampDrag({ ...stampDrag, to: p })
                }}
                onPointerLeave={() => !stampDrag && setStampAt(null)}
                onPointerDown={(ev) => {
                  if (ev.button !== 0) return
                  ev.stopPropagation()
                  ev.currentTarget.setPointerCapture?.(ev.pointerId)
                  const p = toScene(ev)
                  setStampAt(p)
                  setStampDrag({ from: p, to: p })
                }}
                onPointerUp={(ev) => {
                  if (!stampDrag) return
                  ev.stopPropagation()
                  placeStamp(stampPoints())
                  setStampDrag(null)
                  if (ev.pointerType !== 'mouse') setStampAt(null) // con el dedo no hay cursor que siga
                }}
                onPointerCancel={() => setStampDrag(null)}
                onContextMenu={(ev) => {
                  ev.preventDefault()
                  setStamp(null)
                }}
              />
            )}
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
            </g>
          </svg>
        </div>
        {(deskItems.length > 0 || mode === 'edit') && (
          <div
            role="region"
            aria-label={tr('Panel de control')}
            className="paper flex shrink-0 items-start gap-2 overflow-x-auto border-t-4 border-slate-400 bg-slate-300 px-3 py-2"
            onDragOver={(ev) => {
              if (!ev.dataTransfer.types.includes(DRAG_TYPE)) return
              ev.preventDefault()
              ev.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(ev) => {
              const item = dropped(ev)
              if (!item) return
              ev.preventDefault()
              addItem(item, null, DESK_TYPES.includes(item.type) ? 'desk' : null)
            }}
            onClick={() => {
              if (stamp && DESK_TYPES.includes(stamp.item.type)) placeStamp([{ x: 0, y: 0 }], 'desk')
            }}
            style={stamp && DESK_TYPES.includes(stamp.item.type) ? { cursor: 'copy' } : undefined}
          >
            {deskItems.length === 0 && (
              <p className="py-3 text-xs text-slate-600">{tr('Panel de control: arrastra aquí pulsadores, pilotos, potenciómetros…')}</p>
            )}
            {deskItems.map((e) => {
              const b = boundsOf({ ...e, x: 0, y: 0 })
              return (
                <div
                  key={e.id}
                  data-element={e.type}
                  data-id={e.id}
                  data-desk=""
                  {...knobProps(e)}
                  aria-label={`${tr(SCENE_TYPES[e.type].label)} ${labelOf(e)}`}
                  className={`flex w-20 shrink-0 select-none flex-col items-center rounded bg-slate-200 p-1 shadow-sm ${
                    selection.includes(e.id) ? 'ring-2 ring-blue-500' : ''
                  }`}
                  style={{ cursor: mode === 'use' && operable(e) ? 'pointer' : 'default' }}
                  onPointerDown={(ev) => onDeskDown(ev, e)}
                  onPointerMove={(ev) => deskKnob?.id === e.id && turnDeskKnob(ev, e)}
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
          <aside className="w-48 shrink-0 space-y-2 overflow-y-auto border-l border-slate-200 p-2 text-xs" aria-label={tr('Selección')}>
            <p className="font-semibold">{selection.length} elementos seleccionados</p>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={rotateSelected} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
                <RotateCw size={12} />{' '}{tr('Girar')}
              </button>
              <button type="button" onClick={duplicate} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
                <Copy size={12} />{' '}{tr('Duplicar')}
              </button>
              <button type="button" onClick={removeSelected} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-red-500 hover:text-white">
                <Trash2 size={12} />{' '}{tr('Borrar')}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">{tr('Arrastra uno de ellos para mover todo el grupo. Ctrl+clic añade o quita.')}</p>
            <form
              className="space-y-1 border-t border-slate-200 pt-2"
              onSubmit={(ev) => {
                ev.preventDefault()
                saveSelectionAsGroup()
              }}
            >
              <label className="block">
                <span className="text-slate-500">{tr('Guardar como grupo (Mis grupos)')}</span>
                <input
                  value={groupName}
                  onChange={(ev) => setGroupName(ev.target.value)}
                  placeholder={tr('Nombre, p. ej. Estación de taladrado')}
                  className="w-full rounded border border-slate-300 px-1 py-0.5"
                />
              </label>
              <button
                type="submit"
                disabled={!groupName.trim()}
                className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <BookmarkPlus size={12} />{' '}{tr('Guardar como grupo')}
              </button>
            </form>
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
                cylinders={elements.filter((e) => e.type === 'cylinder')}
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
          aria-label={tr('Vista previa: {elemento}', { elemento: tr(PALETTE_BY_KEY[preview.key].label) })}
          className="side-panel pointer-events-none fixed z-50 w-56 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg"
          style={{ left: Math.min(preview.x + 16, window.innerWidth - 240), top: Math.min(preview.y + 12, window.innerHeight - 220) }}
        >
          <p className="mb-1 font-semibold">{tr(PALETTE_BY_KEY[preview.key].label)}</p>
          <div className="paper rounded border border-slate-100 bg-white p-1">
            <ModulePreview item={PALETTE_BY_KEY[preview.key]} />
          </div>
          <p className="mt-1 text-slate-600">{tr(HINTS[preview.key])}</p>
        </div>
      )}
      {mode === 'edit' && (
        <p className="border-t border-slate-200 px-2 py-1 text-[11px] text-slate-500">
          {tr(
            'Pulsa un módulo de la paleta y ponlo con un clic en la escena (arrastrando, una fila; doble clic en la paleta: en un hueco libre) o arrástralo a la escena o al panel · los cuadraditos de un elemento seleccionado cambian su medida (con Mayús, en proporción) · rueda o dos dedos: zoom · arrastrar el fondo (o con la rueda pulsada): desplazar · Ctrl+clic o Mayús+arrastrar: varios · R gira · Supr borra · Ctrl+C/V/D copia, pega, duplica · deshacer y rehacer: los de siempre · asigna las variables en el panel de la derecha. Piezas de {pequena} y {grande} px.',
            { pequena: PIECE_SIZES.small[0], grande: PIECE_SIZES.large[0] },
          )}
        </p>
      )}
    </section>
  )
}
