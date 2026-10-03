import { Handle, Position } from '@xyflow/react'
import { ElecSymbol } from './ElecSymbols'
import { INK, POTENTIAL_COLORS } from './elecColors'
import { ELEC_TYPES, POTENTIALS, showTag, sizeOf, terminalsOf } from '../../lib/elec/catalog'

// Lo que se acciona con el ratón al simular (modo Usar).
const MOMENTARY = new Set(['pushbutton', 'litbutton'])
const TOGGLES = new Set(['switch', 'emergency', 'breaker', 'motorprotector', 'thermal', 'fuse', 'rcd', 'selector3', 'changeover', 'crossover', 'mainswitch', 'doorswitch', 'lightcurtain', 'potentiometer'])
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
  mainswitch: 'Clic: abrir o cerrar el interruptor general',
  doorswitch: 'Clic: abrir o cerrar la puerta del resguardo',
  lightcurtain: 'Clic: cortar el haz (o dejarlo libre)',
  potentiometer: 'Clic: +25 % (de 100 % vuelve a 0)',
  litbutton: 'Mantén pulsado para accionarlo',
}

// Componente del esquema eléctrico en el lienzo (React Flow): símbolo, bornes (handles) y rótulos.
// data: { c, view, numbers: [arriba, abajo] (contactos auxiliares), xref: [{ kind, numbers }],
//         timed, mode: 'edit' | 'use', onAction(id, action) }
export default function ElecNode({ data }) {
  const { c, view, numbers, xref, where, timed, mode, onAction, junctions } = data
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
  const boxed = ['psu', 'phasemonitor', 'vfd', 'softstarter', 'safetyrelay'].includes(c.type)
  const termLabel = (t, i) => (c.type === 'contact' ? numbers?.[i] : rail || c.type === 'plc' || c.type === 'terminal' || boxed ? null : t.id)

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
        {/* Puntos de unión: borne con dos o más cables, o toma de un embarrado. */}
        {terminals.map((t) => junctions?.[t.id] && <circle key={`j${t.id}`} cx={t.x} cy={t.y} r="3.2" fill={INK} />)}
        {rail && (
          <text x="-6" y="14" textAnchor="end" fontSize="12" fontWeight="700" fill={POTENTIAL_COLORS[c.potential] ?? INK}>
            {c.potential}
          </text>
        )}
      </svg>
      {!rail && c.type !== 'plc' && (
        // Rótulo a la derecha; la descripción se parte en líneas para no pisar al aparato de al lado.
        <div className="pointer-events-none absolute top-[22px] w-[92px] text-[11px] leading-tight text-slate-900" style={{ left: w + 2 }}>
          <div className="font-semibold">{c.type === 'terminal' ? `${showTag(tag)}:${c.n ?? 1}` : showTag(tag)}</div>
          {c.text && <div className="text-[10px] text-slate-600">{c.text}</div>}
          {c.type === 'coil' && (c.kind === 'ton' || c.kind === 'tof') && <div className="text-slate-600">{`${c.kind === 'ton' ? 'Conexión' : 'Desconexión'} ${c.preset ?? 0} s`}</div>}
          {c.type === 'sensor3' && <div className="text-slate-600">{`${{ inductive: 'Inductivo', capacitive: 'Capacitivo', optical: 'Óptico' }[c.kind] ?? ''} ${c.output ?? 'PNP'}`}</div>}
          {/* Referencias cruzadas: bajo la bobina, sus contactos (número y /hoja.columna); bajo el
              contacto, dónde está su bobina. */}
          {xref?.length > 0 && <div className="font-mono text-[9px] text-slate-500">{xref.map((x) => `${x.numbers.join('-')} ${x.where ?? ''}`.trim()).join(' · ')}</div>}
          {where && <div className="font-mono text-[9px] text-slate-500">{where}</div>}
          {c.signal && <div className="font-mono text-[9px] text-blue-700">↔ {c.signal}</div>}
          {view?.motors?.[c.id]?.mode && <div className="text-green-700">{view.motors[c.id].mode}</div>}
          {view?.motors?.[c.id]?.warning && <div className="text-amber-700">{view.motors[c.id].warning}</div>}
          {view?.tripped?.[c.id] && <div className="font-semibold text-red-700">{c.type === 'fuse' ? 'Fundido' : 'Disparado'}</div>}
          {c.type === 'counter' && <div className="text-slate-600">{`Preselección ${c.preset ?? 1}`}</div>}
          {c.type === 'coil' && c.kind === 'flash' && <div className="text-slate-600">{`Intermitente ${c.preset ?? 1} s`}</div>}
          {c.type === 'coil' && c.kind === 'impulse' && <div className="text-slate-600">Telerruptor</div>}
          {c.type === 'coil' && c.interlock && <div className="text-slate-600">{`Enclavamiento mecánico con -${c.interlock}`}</div>}
          {c.type === 'emergency' && Number(c.channels) === 2 && <div className="text-slate-600">Doble canal</div>}
          {c.type === 'transmitter' && <div className="text-slate-600">{c.output === '0-10V' ? '0-10 V (3 hilos)' : '4-20 mA (2 hilos)'}</div>}
          {c.type === 'vfd' && <div className="text-slate-600">{`2ª velocidad ${c.speed2 ?? 25} Hz`}</div>}
          {c.type === 'softstarter' && <div className="text-slate-600">{`Rampa ${c.ramp ?? 3} s`}</div>}
          {c.type === 'safetyrelay' && view?.safety?.[c.id]?.discrepancy && <div className="font-semibold text-amber-700">Discrepancia entre canales</div>}
          {c.type === 'brake' && view && <div className={view.loads?.[c.id] ? 'text-green-700' : 'text-red-700'}>{view.loads?.[c.id] ? 'Suelto' : 'Frenado'}</div>}
          {view?.motors?.[c.id]?.running && view.motors[c.id].speed < 1 && <div className="text-green-700">{`${Math.round(view.motors[c.id].speed * 100)} % de velocidad`}</div>}
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
