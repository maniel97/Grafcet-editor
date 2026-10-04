import { Circle, Play, Square, Trash2 } from 'lucide-react'
import { t } from '../lib/i18n'

const fmt = (v) => `${v.toFixed(1)} s`

// Escenarios de prueba (lib/sim/scenario.js): grabar los cambios de entradas, guardarlos en el
// proyecto y reproducirlos para comprobar el diseño sin repetir los clics a mano.
export default function ScenarioControls({ simulation, scenarios, onChange }) {
  const { sim, startRecording, stopRecording, playScenario } = simulation
  const recording = sim.recording
  const playback = sim.playback

  const stop = () => {
    const recorded = stopRecording()
    if (!recorded) return
    onChange((list) => {
      // Nombre libre: «Escenario N» con el primer número que no esté usado.
      let n = list.length + 1
      while (list.some((s) => s.name === t('Escenario {n}', { n }))) n++
      return [...list, { id: crypto.randomUUID(), name: t('Escenario {n}', { n }), ...recorded }]
    })
  }

  return (
    <div className="space-y-2">
      {recording ? (
        <div className="flex items-center gap-2 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">
          <Circle size={10} className="animate-pulse fill-current" />
          <span className="flex-1">
            Grabando… {recording.length} {recording.length === 1 ? 'cambio' : 'cambios'}
          </span>
          <button
            type="button"
            onClick={stop}
            className="flex items-center gap-1 rounded border border-red-300 px-1.5 py-0.5 hover:bg-red-100"
            title={t('Termina la grabación y la guarda en el proyecto')}
          >
            <Square size={10} />{' '}{t('Detener y guardar')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          title={t('Reinicia la simulación y graba los cambios de entradas con su instante')}
          className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
        >
          <Circle size={10} className="fill-red-500 text-red-500" />{' '}{t('Grabar escenario')}
        </button>
      )}

      {playback && (
        <p className="rounded bg-blue-50 px-2 py-1.5 text-xs text-blue-700">
          Reproduciendo «{playback.scenario.name}»: {playback.next}/{playback.scenario.events.length} cambios
          · {fmt(playback.scenario.duration)}. Tocar una entrada la interrumpe.
        </p>
      )}

      {scenarios.length === 0 && !recording && (
        <p className="text-xs text-slate-400">{t('Graba una secuencia de entradas para repetirla después con un clic.')}</p>
      )}
      <ul className="space-y-1">
        {scenarios.map((s) => (
          <li key={s.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => playScenario(s)}
              disabled={!!recording}
              title={t('Reproducir desde la situación inicial')}
              aria-label={`Reproducir ${s.name}`}
              className="rounded p-1 text-green-700 hover:bg-green-100 disabled:opacity-40"
            >
              <Play size={14} />
            </button>
            <input
              value={s.name}
              onChange={(e) => onChange((list) => list.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
              aria-label={t('Nombre del escenario')}
              className="min-w-0 flex-1 rounded border border-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-blue-500 focus:outline-none"
            />
            <span className="shrink-0 text-[11px] text-slate-400" title={t('{n} cambios de entradas', { n: s.events.length })}>
              {s.events.length}× · {fmt(s.duration)}
            </span>
            <button
              type="button"
              onClick={() => onChange((list) => list.filter((x) => x.id !== s.id))}
              title={t('Borrar el escenario')}
              aria-label={`Borrar ${s.name}`}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
