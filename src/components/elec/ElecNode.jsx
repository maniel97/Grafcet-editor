import { Handle, Position } from '@xyflow/react'
import { ElecSymbol } from './ElecSymbols'
import { INK, POTENTIAL_COLORS } from './elecColors'
import { ELEC_TYPES, POTENTIALS, showTag, sizeOf, terminalsOf } from '../../lib/elec/catalog'

// Lo que se acciona con el ratón al simular (modo Usar).
const MOMENTARY = new Set(['pushbutton'])
const TOGGLES = new Set(['switch', 'emergency', 'breaker', 'motorprotector', 'thermal', 'fuse', 'rcd', 'selector3', 'changeover', 'crossover'])
const HINTS = {
  pushbutton: 'Mantén pulsado para accionarlo',
  switch: 'Clic: conmutar',
  emergency: 'Clic: pulsar o desenclavar la seta',
  breaker: 'Clic: abrir o cerrar (rearmar si ha saltado)',
  motorprotector: 'Clic: abrir o cerrar (rearmar si ha saltado)',
  thermal: 'Clic: provocar una sobrecarga o rearmarlo',
  fuse: 'Clic: abrir o cerrar el portafusibles (reponer si se ha fundido)',
  rcd: 'Clic: abrir o cerrar (rearmar si ha saltado) · T: botón de prueba',
  selector3: 'Clic: siguiente posición (0 → 1 → 2)',
  changeover: 'Clic: conmutar',
  crossover: 'Clic: conmutar',
}

// Componente del esquema eléctrico en el lienzo (React Flow): símbolo, bornes (handles) y rótulos.
// data: { c, view, numbers: [arriba, abajo] (contactos auxiliares), xref: [{ kind, numbers }],
//         timed, mode: 'edit' | 'use', onAction(id, action) }
export default function ElecNode({ data }) {
  const { c, view, numbers, xref, timed, mode, onAction } = data
  const { w, h } = sizeOf(c)
  const terminals = terminalsOf(c)
  const use = mode === 'use'
  const momentary = use && MOMENTARY.has(c.type)
  const toggle = use && TOGGLES.has(c.type)
  const label = ELEC_TYPES[c.type]?.label ?? c.type
  const tag = c.type === 'contact' || c.type === 'maincontacts' ? c.ref : c.tag
  const rail = c.type === 'rail'
  // Estado al simular (para leerlo y para las pruebas): cargas y motores, encendidos; contactos,
  // cerrados; protecciones, disparadas.
  const on = view ? Boolean(view.loads?.[c.id] ?? view.motors?.[c.id]?.running ?? view.closed?.[c.id]) : undefined
  // Números de borne junto a cada borne (los de los contactos auxiliares, calculados).
  const termLabel = (t, i) => (c.type === 'contact' ? numbers?.[i] : rail || c.type === 'plc' ? null : t.id)

  return (
    <div
      className={`relative ${momentary || toggle ? 'cursor-pointer' : ''}`}
      style={{ width: w, height: h }}
      data-elec={c.type}
      data-tag={tag || undefined}
      data-on={on === undefined ? undefined : on ? '1' : '0'}
      aria-label={`${label} ${showTag(tag)}`.trim()}
      title={use && HINTS[c.type] ? HINTS[c.type] : undefined}
      onPointerDown={momentary ? (e) => (e.stopPropagation(), onAction(c.id, 'press')) : undefined}
      onPointerUp={momentary ? () => onAction(c.id, 'release') : undefined}
      onPointerLeave={momentary ? () => onAction(c.id, 'release') : undefined}
      onClick={toggle ? (e) => (e.stopPropagation(), onAction(c.id, 'toggle')) : undefined}
    >
      <svg width={w} height={h} overflow="visible" className="absolute left-0 top-0">
        {/* Zona de clic: toda la caja. */}
        <rect x="0" y="0" width={w} height={h} fill="transparent" />
        <ElecSymbol c={{ ...c, timed }} view={view} />
        {terminals.map((t, i) => {
          const text = termLabel(t, i)
          if (!text) return null
          const top = t.side === 'top'
          return (
            <text key={t.id} x={t.x + 4} y={top ? t.y + 11 : t.y - 4} fontSize="8.5" fontFamily="ui-monospace, monospace" fill="#475569">
              {text}
            </text>
          )
        })}
        {rail && (
          <text x="-6" y="14" textAnchor="end" fontSize="12" fontWeight="700" fill={POTENTIAL_COLORS[c.potential] ?? INK}>
            {c.potential}
          </text>
        )}
      </svg>
      {!rail && c.type !== 'plc' && (
        // Rótulo a la derecha; la descripción se parte en líneas para no pisar al aparato de al lado.
        <div className="pointer-events-none absolute top-[22px] w-[92px] text-[11px] leading-tight text-slate-900" style={{ left: w + 2 }}>
          <div className="font-semibold">{showTag(tag)}</div>
          {c.text && <div className="text-[10px] text-slate-600">{c.text}</div>}
          {c.type === 'coil' && (c.kind === 'ton' || c.kind === 'tof') && <div className="text-slate-600">{`${c.kind === 'ton' ? 'Conexión' : 'Desconexión'} ${c.preset ?? 0} s`}</div>}
          {c.type === 'sensor3' && <div className="text-slate-600">{`${{ inductive: 'Inductivo', capacitive: 'Capacitivo', optical: 'Óptico' }[c.kind] ?? ''} ${c.output ?? 'PNP'}`}</div>}
          {xref?.length > 0 && <div className="font-mono text-[9px] text-slate-500">{xref.map((x) => x.numbers.join('-')).join(' · ')}</div>}
          {c.signal && <div className="font-mono text-[9px] text-blue-700">↔ {c.signal}</div>}
          {view?.motors?.[c.id]?.mode && <div className="text-green-700">{view.motors[c.id].mode}</div>}
          {view?.motors?.[c.id]?.warning && <div className="text-amber-700">{view.motors[c.id].warning}</div>}
          {view?.tripped?.[c.id] && <div className="font-semibold text-red-700">{c.type === 'fuse' ? 'Fundido' : 'Disparado'}</div>}
          {c.type === 'counter' && <div className="text-slate-600">{`Preselección ${c.preset ?? 1}`}</div>}
          {c.type === 'coil' && c.kind === 'flash' && <div className="text-slate-600">{`Intermitente ${c.preset ?? 1} s`}</div>}
          {c.type === 'coil' && c.kind === 'impulse' && <div className="text-slate-600">Telerruptor</div>}
        </div>
      )}
      {c.type === 'plc' && (
        <div className="pointer-events-none absolute -top-4 left-0 text-[11px] font-semibold text-slate-900">
          {showTag(c.tag)}
        </div>
      )}
      {rail && <span className="sr-only">{POTENTIALS[c.potential]?.label}</span>}
      {/* Diferencial: botón de prueba (T), al simular. */}
      {use && c.type === 'rcd' && (
        <button
          type="button"
          title="Botón de prueba del diferencial"
          aria-label={`Probar ${showTag(c.tag)}`}
          onClick={(e) => {
            e.stopPropagation()
            onAction(c.id, 'test')
          }}
          className="absolute left-[33px] top-[48px] h-4 w-4 rounded-sm border border-slate-700 bg-amber-100 text-[9px] font-bold leading-none text-slate-900 hover:bg-amber-300"
        >
          T
        </button>
      )}
      {terminals.map((t) => (
        <Handle
          key={t.id}
          id={t.id}
          type="source"
          position={t.side === 'top' ? Position.Top : Position.Bottom}
          isConnectable={mode === 'edit'}
          className={`elec-handle ${rail ? 'elec-handle-rail' : ''}`}
          style={{ left: t.x, top: t.y, transform: 'translate(-50%, -50%)' }}
          title={rail ? `${c.potential}` : t.id}
        />
      ))}
    </div>
  )
}
