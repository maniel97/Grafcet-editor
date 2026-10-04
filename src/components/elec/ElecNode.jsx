import { Handle, Position } from '@xyflow/react'
import { ElecSymbol } from './ElecSymbols'
import { INK, POTENTIAL_COLORS } from './elecColors'
import { ELEC_TYPES, POTENTIALS, isMotor, isPneumatic, showTag, sizeOf, terminalsOf } from '../../lib/elec/catalog'
import { N_, t as tr } from '../../lib/i18n'

// Lo que se acciona con el ratón al simular (modo Usar).
const MOMENTARY = new Set(['pushbutton', 'litbutton'])
const TOGGLES = new Set(['switch', 'emergency', 'breaker', 'motorprotector', 'thermal', 'fuse', 'rcd', 'selector3', 'changeover', 'crossover', 'mainswitch', 'doorswitch', 'lightcurtain', 'potentiometer'])
const HINTS = {
  pushbutton: N_('Mantén pulsado para accionarlo'),
  switch: N_('Clic: conmutar'),
  emergency: N_('Clic: pulsar o desenclavar la seta'),
  breaker: N_('Clic: abrir o cerrar (rearmar si ha saltado)'),
  motorprotector: N_('Clic: abrir o cerrar (rearmar si ha saltado)'),
  thermal: N_('Clic: provocar una sobrecarga o rearmarlo'),
  fuse: N_('Clic: abrir o cerrar el portafusibles (reponer si se ha fundido)'),
  rcd: N_('Clic: abrir o cerrar (rearmar si ha saltado) · T: botón de prueba'),
  selector3: N_('Clic: siguiente posición (0 → 1 → 2)'),
  changeover: N_('Clic: conmutar'),
  crossover: N_('Clic: conmutar'),
  mainswitch: N_('Clic: abrir o cerrar el interruptor general'),
  doorswitch: N_('Clic: abrir o cerrar la puerta del resguardo'),
  lightcurtain: N_('Clic: cortar el haz (o dejarlo libre)'),
  potentiometer: N_('Clic: +25 % (de 100 % vuelve a 0)'),
  litbutton: N_('Mantén pulsado para accionarlo'),
  frl: N_('Clic: abrir o cortar el aire'),
  throttle: N_('Clic: abrir más el regulador (+25 %)'),
}

// Componente del esquema eléctrico en el lienzo (React Flow): símbolo, bornes (handles) y rótulos.
// data: { c, view, numbers: [arriba, abajo] (contactos auxiliares), xref: [{ kind, numbers }],
//         timed, mode: 'edit' | 'use', onAction(id, action) }
export default function ElecNode({ data }) {
  const { c, view, numbers, xref, where, timed, mode, onAction, junctions, tool, probes, onProbe, onFaultMenu } = data
  const { w, h } = sizeOf(c)
  const terminals = terminalsOf(c)
  const use = mode === 'use'
  // Con el polímetro o las averías, el clic es para la herramienta, no para accionar.
  const momentary = use && !tool && (MOMENTARY.has(c.type) || (c.type === 'pvalve' && c.manual === 'button'))
  const toggle = use && !tool && (TOGGLES.has(c.type) || (c.type === 'pvalve' && c.manual === 'lever') || c.type === 'frl' || c.type === 'throttle')
  const hint = c.type === 'pvalve' ? { button: tr('Mantén pulsado para accionar la válvula'), lever: tr('Clic: mover la palanca') }[c.manual] : tr(HINTS[c.type])
  const fault = view?.faults?.[c.id]
  const label = tr(ELEC_TYPES[c.type]?.label) ?? c.type
  const tag = c.type === 'contact' || c.type === 'maincontacts' ? c.ref : c.tag
  const rail = c.type === 'rail'
  // Estado al simular (para leerlo y para las pruebas): cargas y motores, encendidos; contactos,
  // cerrados; protecciones, disparadas.
  const air = view?.pneu
  const cyl = air?.cylinders?.[c.id]
  const on = view
    ? c.type === 'pvalve'
      ? air?.valves?.[c.id] === '14'
      : c.type === 'pcylinder'
        ? (cyl?.pos ?? 0) >= 0.98
        : Boolean(view.loads?.[c.id] ?? view.motors?.[c.id]?.running ?? view.closed?.[c.id])
    : undefined
  // Números de borne junto a cada borne (los de los contactos auxiliares, calculados).
  const boxed = ['psu', 'phasemonitor', 'vfd', 'softstarter', 'safetyrelay'].includes(c.type)
  const termLabel = (t, i) => (c.type === 'contact' ? numbers?.[i] : rail || c.type === 'plc' || c.type === 'terminal' || boxed || c.type === 'pcylinder' || c.type === 'airsource' ? null : t.id)

  return (
    <div
      className={`relative ${momentary || toggle ? 'cursor-pointer' : ''}`}
      style={{ width: w, height: h }}
      data-elec={c.type}
      data-tag={tag || undefined}
      data-on={on === undefined ? undefined : on ? '1' : '0'}
      aria-label={`${label} ${showTag(tag)}`.trim()}
      title={use && hint ? hint : undefined}
      data-pos={cyl ? Math.round(cyl.pos * 100) : undefined}
      onPointerDown={momentary ? (e) => (e.stopPropagation(), onAction(c.id, 'press')) : undefined}
      onPointerUp={momentary ? () => onAction(c.id, 'release') : undefined}
      onPointerLeave={momentary ? () => onAction(c.id, 'release') : undefined}
      onClick={
        tool === 'faults' && !rail
          ? (e) => {
              e.stopPropagation()
              onFaultMenu?.(c.id, e.clientX, e.clientY)
            }
          : toggle
            ? (e) => (e.stopPropagation(), onAction(c.id, 'toggle'))
            : undefined
      }
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
        {/* Puntas del polímetro: roja (la primera) y negra. */}
        {terminals.map((t) => {
          const i = probes?.indexOf(t.id) ?? -1
          return i >= 0 ? <circle key={`p${t.id}`} cx={t.x} cy={t.y} r="6" fill={i === 0 ? '#dc2626' : '#0f172a'} stroke="white" strokeWidth="1.5" /> : null
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
        <div className="pointer-events-none absolute top-[22px] w-[92px] text-[11px] leading-tight text-slate-900" style={c.type === 'pcylinder' ? { left: 30, top: 40 } : { left: w + (boxed ? 16 : 2) }}>
          {/* Neumática: identificación ISO 1219-2, sin guion (1V1, A). */}
          <div className="font-semibold">{c.type === 'terminal' ? `${showTag(tag)}:${c.n ?? 1}` : isPneumatic(c.type) ? tag : showTag(tag)}</div>
          {c.text && <div className="text-[10px] text-slate-600">{c.text}</div>}
          {c.type === 'coil' && (c.kind === 'ton' || c.kind === 'tof') && <div className="text-slate-600">{c.kind === 'ton' ? tr('Conexión {segundos} s', { segundos: c.preset ?? 0 }) : tr('Desconexión {segundos} s', { segundos: c.preset ?? 0 })}</div>}
          {c.type === 'sensor3' && <div className="text-slate-600">{`${{ inductive: tr('Inductivo'), capacitive: tr('Capacitivo'), optical: tr('Óptico') }[c.kind] ?? ''} ${c.output ?? 'PNP'}`}</div>}
          {/* Referencias cruzadas: bajo la bobina, sus contactos (número y /hoja.columna); bajo el
              contacto, dónde está su bobina. */}
          {xref?.length > 0 && <div className="font-mono text-[9px] text-slate-500">{xref.map((x) => `${x.numbers.join('-')} ${x.where ?? ''}`.trim()).join(' · ')}</div>}
          {where && <div className="font-mono text-[9px] text-slate-500">{where}</div>}
          {c.signal && <div className="font-mono text-[9px] text-blue-700">↔ {c.signal}</div>}
          {view?.motors?.[c.id]?.mode && <div className="text-green-700">{view.motors[c.id].mode}</div>}
          {view?.motors?.[c.id]?.warning && <div className="text-amber-700">{tr(view.motors[c.id].warning)}</div>}
          {view?.tripped?.[c.id] && <div className="font-semibold text-red-700">{c.type === 'fuse' ? tr('Fundido') : tr('Disparado')}</div>}
          {fault && <div className="font-semibold text-red-700">{fault === 'welded' ? tr('Avería: soldado') : ['coil', 'valve', 'lamp', 'buzzer', 'brake'].includes(c.type) || isMotor(c.type) ? tr('Avería: cortado') : c.type === 'terminal' ? tr('Avería: borna floja') : tr('Avería: quemado')}</div>}
          {c.type === 'counter' && <div className="text-slate-600">{tr('Preselección {n}', { n: c.preset ?? 1 })}</div>}
          {c.type === 'coil' && c.kind === 'flash' && <div className="text-slate-600">{`Intermitente ${c.preset ?? 1} s`}</div>}
          {c.type === 'coil' && c.kind === 'impulse' && <div className="text-slate-600">{tr('Telerruptor')}</div>}
          {c.type === 'coil' && c.interlock && <div className="text-slate-600">{tr('Enclavamiento mecánico con {aparato}', { aparato: `-${c.interlock}` })}</div>}
          {c.type === 'emergency' && Number(c.channels) === 2 && <div className="text-slate-600">{tr('Doble canal')}</div>}
          {c.type === 'transmitter' && <div className="text-slate-600">{c.output === '0-10V' ? '0-10 V (3 hilos)' : '4-20 mA (2 hilos)'}</div>}
          {c.type === 'vfd' && <div className="text-slate-600">{`2ª velocidad ${c.speed2 ?? 25} Hz`}</div>}
          {c.type === 'softstarter' && <div className="text-slate-600">{`Rampa ${c.ramp ?? 3} s`}</div>}
          {c.type === 'safetyrelay' && view?.safety?.[c.id]?.discrepancy && <div className="font-semibold text-amber-700">{tr('Discrepancia entre canales')}</div>}
          {c.type === 'brake' && view && <div className={view.loads?.[c.id] ? 'text-green-700' : 'text-red-700'}>{view.loads?.[c.id] ? tr('Suelto') : tr('Frenado')}</div>}
          {c.type === 'pcylinder' && <div className="text-slate-600">{c.acting === 'single' ? tr('Simple efecto') : tr('Doble efecto')}</div>}
          {cyl?.note && <div className="text-amber-700">{cyl.note}</div>}
          {c.type === 'pvalve' && <div className="text-slate-600">{`${c.ways ?? '5/2'} ${c.ways === '5/3' ? ({ closed: tr('centro cerrado'), exhaust: tr('centro a escape'), pressure: tr('centro a presión') }[c.center] ?? tr('centro cerrado')) : c.sol12 ? tr('biestable') : c.ways === '3/2' && c.normally === 'NO' ? tr('NA') : tr('monoestable')}`}</div>}
          {c.type === 'throttle' && <div className="text-slate-600">{`Abierto ${Math.round((view?.knob?.[c.id] ?? Number(c.setting ?? 0.5)) * 100)} %`}</div>}
          {c.type === 'airsource' && air?.leaks && <div className="font-semibold text-amber-700">{tr('Fuga: el aire sale por un escape')}</div>}
          {c.type === 'motor1' && <div className="text-slate-600">{c.capacitor === 'start' ? tr('Condensador de arranque') : tr('Condensador permanente')}</div>}
          {view?.motors?.[c.id]?.running && view.motors[c.id].speed < 1 && <div className="text-green-700">{tr('{pct} % de velocidad', { pct: Math.round(view.motors[c.id].speed * 100) })}</div>}
        </div>
      )}
      {rail && <span className="sr-only">{tr(POTENTIALS[c.potential]?.label)}</span>}
      {/* Diferencial: botón de prueba (T), al simular. */}
      {use && c.type === 'rcd' && (
        <button
          type="button"
          title={tr('Botón de prueba del diferencial')}
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
          className={`elec-handle ${rail ? 'elec-handle-rail' : ''} ${tool === 'meter' ? 'elec-probe' : ''}`}
          onClick={
            tool === 'meter'
              ? (e) => {
                  e.stopPropagation()
                  onProbe?.(c.id, t.id)
                }
              : undefined
          }
          style={{
            left: t.x,
            top: t.y,
            transform: 'translate(-50%, -50%)',
            // Con una punta del polímetro: roja (la primera) o negra.
            ...(probes?.includes(t.id) ? { background: probes.indexOf(t.id) === 0 && data.firstProbe === `${c.id}:${t.id}` ? '#dc2626' : '#0f172a', borderColor: 'white' } : {}),
          }}
          title={rail ? `${c.potential}` : t.id}
        />
      ))}
    </div>
  )
}
