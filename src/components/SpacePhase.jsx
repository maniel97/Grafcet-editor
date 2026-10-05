// Diagrama espacio-fase (mode 'fase') o espacio-tiempo (mode 'tiempo') de los cilindros, a partir
// de lib/sim/spacePhase.js buildSpacePhase(). Una fila por cilindro con sus niveles 0 (dentro) y
// 1 (fuera); en espacio-fase, una columna por fase con el movimiento en diagonal.
// standalone: SVG independiente para exportar (fuente y fondo propios, sin clases de Tailwind).
// expected: diagrama esperado (theoreticalSpacePhase), en gris discontinuo debajo, si tiene las
// mismas fases. signals: líneas de señal (el final de carrera que da paso a cada movimiento).
import { t as tr } from '../lib/i18n'
import { signalsOf } from '../lib/sim/spacePhase'

const ROW = 46 // alto de una fila (de nivel 1 a nivel 0 hay ROW - 2·PAD)
const PAD = 9
const LABEL_W = 64
const TOP = 18 // números de fase arriba
const INK = '#0f172a'
const GRID = '#cbd5e1'
const MUTED = '#64748b'
const LINE = '#2563eb'
const EXPECTED = '#94a3b8'
const SIGNAL = '#dc2626'

const closeTo = (a, b) => Math.abs(a - b) < 0.02

export default function SpacePhase({ diagram, mode = 'fase', width = 280, standalone = false, expected = null, signals = false }) {
  if (!diagram) return null
  const { phases, rows, samples } = diagram
  const n = phases.length
  // En espacio-tiempo, una línea más abajo para la duración (no pisa la última fila).
  const height = TOP + rows.length * ROW + (mode === 'tiempo' ? 18 : 4)
  const plotW = width - LABEL_W - 16 // margen a la derecha: cabe el «n+1=1» centrado en la última frontera
  const t0 = phases[0].start
  const span = Math.max(phases[n - 1].end - t0, 0.001)
  // Coordenada x de la frontera i (0..n) entre fases.
  const xPhase = (i) => LABEL_W + (i / n) * plotW
  const xTime = (t) => LABEL_W + ((t - t0) / span) * plotW
  const boundaryX = (i) => (mode === 'fase' ? xPhase(i) : xTime(i < n ? phases[i].start : phases[n - 1].end))
  const y = (row, level) => TOP + row * ROW + PAD + (1 - level) * (ROW - 2 * PAD)
  // El ciclo se cierra si todos acaban donde empezaron: la última frontera es «n+1 = 1».
  const closed = rows.every((r) => closeTo(r.levels[0], r.levels[n]))
  // Lo esperado, fila a fila (por la letra del cilindro), solo si tiene las mismas fases.
  const expectedRow = (r) =>
    mode === 'fase' && expected?.phases.length === n ? expected.rows.find((e) => e.name.toUpperCase() === (r.letter ?? r.name).toUpperCase()) : null
  const lines = signals ? signalsOf(diagram) : []
  // Números de fase que caben sin pisarse (en espacio-tiempo, fases muy cortas quedan juntas).
  const shown = []
  let lastX = -Infinity
  for (let i = 0; i <= n; i++) {
    const x = boundaryX(i)
    const room = i === n && closed ? 26 : 16
    shown.push(x - lastX >= room)
    if (shown[i]) lastX = x
  }

  return (
    <svg
      {...(standalone
        ? { xmlns: 'http://www.w3.org/2000/svg', width, height, fontFamily: 'Arial, sans-serif', fontSize: 11 }
        : { width: '100%', className: 'text-[11px]', role: 'img', 'aria-label': mode === 'fase' ? tr('Diagrama espacio-fase') : tr('Diagrama espacio-tiempo') })}
      viewBox={`0 0 ${width} ${height}`}
      data-space-phase={mode}
    >
      <rect width={width} height={height} fill="white" />
      {/* Fronteras de fase con su número (en espacio-tiempo, en su instante). */}
      {Array.from({ length: n + 1 }, (_, i) => (
        <g key={i}>
          <line x1={boundaryX(i)} x2={boundaryX(i)} y1={TOP - 4} y2={TOP + rows.length * ROW} stroke={GRID} strokeDasharray={mode === 'fase' ? undefined : '3 3'} />
          {shown[i] && (
            <text x={boundaryX(i)} y={11} textAnchor="middle" fill={MUTED} data-phase-label>
              {i === n && closed ? `${n + 1}=1` : i + 1}
            </text>
          )}
        </g>
      ))}
      {rows.map((r, row) => {
        let d
        if (mode === 'fase') d = r.levels.map((level, i) => `${i ? 'L' : 'M'} ${xPhase(i).toFixed(1)} ${y(row, level).toFixed(1)}`).join(' ')
        else d = samples.map((s, i) => `${i ? 'L' : 'M'} ${xTime(s.t).toFixed(1)} ${y(row, s.pos[r.id] ?? 0).toFixed(1)}`).join(' ')
        return (
          <g key={r.id} data-cylinder={r.id}>
            <text x={4} y={y(row, 0.5) + 4} fill={INK} fontWeight="bold">
              {r.name.length > 7 ? `${r.name.slice(0, 6)}…` : r.name}
            </text>
            <text x={LABEL_W - 6} y={y(row, 1) + 4} textAnchor="end" fill={MUTED}>
              1
            </text>
            <text x={LABEL_W - 6} y={y(row, 0) + 4} textAnchor="end" fill={MUTED}>
              0
            </text>
            <line x1={LABEL_W} x2={LABEL_W + plotW} y1={y(row, 1)} y2={y(row, 1)} stroke={GRID} strokeDasharray="2 3" />
            <line x1={LABEL_W} x2={LABEL_W + plotW} y1={y(row, 0)} y2={y(row, 0)} stroke={GRID} />
            {expectedRow(r) && (
              <path
                data-expected
                d={expectedRow(r).levels.map((level, i) => `${i ? 'L' : 'M'} ${xPhase(i).toFixed(1)} ${y(row, level).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={EXPECTED}
                strokeWidth="5"
                strokeOpacity="0.45"
                strokeLinejoin="round"
              />
            )}
            <path d={d} fill="none" stroke={LINE} strokeWidth="2.2" strokeLinejoin="round" />
          </g>
        )
      })}
      {/* Líneas de señal: del final del movimiento que acaba al principio del siguiente, con el
          nombre del final de carrera encima del punto de llegada (a la derecha de la frontera). */}
      {lines.map((sig) => {
        const x = boundaryX(sig.boundary)
        const y1 = y(sig.from.row, sig.from.level)
        const y2 = sig.to ? y(sig.to.row, sig.to.level) : y1
        const dir = Math.sign(y2 - y1)
        return (
          <g key={sig.boundary} data-signal={sig.sensor}>
            {dir !== 0 && (
              <>
                <line x1={x} x2={x} y1={y1} y2={y2 - dir * 4} stroke={SIGNAL} strokeWidth="1.2" />
                <path d={`M ${x - 3} ${y2 - dir * 6} L ${x} ${y2} L ${x + 3} ${y2 - dir * 6} Z`} fill={SIGNAL} />
              </>
            )}
            <circle cx={x} cy={y1} r="2.4" fill={SIGNAL} />
            <text x={x + 4} y={y1 - 4} fill={SIGNAL} fontSize="10" stroke="white" strokeWidth="3" paintOrder="stroke">
              {sig.sensor}
            </text>
          </g>
        )
      })}
      {mode === 'tiempo' && (
        <text x={LABEL_W + plotW} y={height - 4} textAnchor="end" fill={MUTED}>
          {`${span.toFixed(1)} s`}
        </text>
      )}
    </svg>
  )
}
