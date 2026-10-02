// Cronograma de las señales binarias (etapas, entradas, salidas) durante los últimos
// `window` segundos de simulación. `samples` son cambios: [{ t, values }], escalonados.
const ROW = 18
const LABEL_W = 68
const MIN_SPAN = 2 // s: al empezar, la gráfica se estira a lo transcurrido en vez de a toda la ventana

// standalone: SVG independiente para exportar (fuente y fondo propios, sin clases de Tailwind).
export default function Chronogram({ samples, signals, now, window = 20, width: WIDTH = 280, standalone = false }) {
  if (!samples.length || !signals.length) return null
  const span = Math.min(window, Math.max(now, MIN_SPAN))
  const start = Math.max(0, now - span)
  const plotW = WIDTH - LABEL_W - 4
  const x = (t) => LABEL_W + ((Math.max(t, start) - start) / span) * plotW
  const height = signals.length * ROW + 14

  // Marcas de tiempo: cada segundo al principio, cada 5 s después.
  const ticks = []
  const every = span <= 6 ? 1 : span <= 60 ? 5 : 30
  for (let t = Math.ceil(start / every) * every; t <= now; t += every) ticks.push(t)

  return (
    <svg
      {...(standalone
        ? { xmlns: 'http://www.w3.org/2000/svg', width: WIDTH, height, fontFamily: 'Consolas, monospace', fontSize: 10 }
        : { width: '100%', className: 'font-mono text-[10px]', role: 'img', 'aria-label': 'Cronograma' })}
      viewBox={`0 0 ${WIDTH} ${height}`}
    >
      {standalone && <rect width="100%" height="100%" fill="white" />}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={0} y2={height - 12} stroke="#e2e8f0" />
          <text x={x(t)} y={height - 2} textAnchor="middle" fill="#94a3b8">
            {t}s
          </text>
        </g>
      ))}
      {signals.map((signal, row) => {
        const high = row * ROW + 3
        const low = row * ROW + ROW - 3
        // Valor al inicio de la ventana: el de la última muestra anterior a ella.
        let value = 0
        for (const s of samples) if (s.t <= start) value = s.values[signal.name] ?? 0
        let d = `M ${x(start)} ${value ? high : low}`
        for (const s of samples) {
          if (s.t <= start) continue
          const v = s.values[signal.name] ?? 0
          if (v !== value) {
            d += ` H ${x(s.t)} V ${v ? high : low}`
            value = v
          }
        }
        d += ` H ${x(now)}`
        return (
          <g key={signal.name}>
            <text x={2} y={row * ROW + ROW - 4} fill="#475569">
              {signal.name.length > 9 ? `${signal.name.slice(0, 8)}…` : signal.name}
            </text>
            <path d={d} fill="none" stroke={signal.color} strokeWidth="1.5" />
          </g>
        )
      })}
    </svg>
  )
}
