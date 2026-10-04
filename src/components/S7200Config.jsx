import { useMemo } from 'react'
import { Plus, Trash2, WandSparkles } from 'lucide-react'
import { CPUS, DEFAULT_MARGIN, MODULES, countNeeds, cpuById, ioMap, moduleById, suggestConfiguration } from '../lib/s7200Catalog'
import { t } from '../lib/i18n'

// Configuración S7-200 (tabla de variables, formato «S7-200 / Micro/WIN»): lo que usa el proyecto,
// la CPU y los módulos sugeridos (con reserva) y el mapa de direcciones de la configuración
// elegida, que es la que usa «Rellenar vacías» / «Reasignar todo» y la que comprueba Verificar.
export default function S7200Config({ plc, symbols, onChange }) {
  const config = plc.s7200 ?? null
  const needs = useMemo(
    () => countNeeds([...symbols].map(([name, found]) => ({ type: plc.variables[name]?.type ?? found.type, numeric: found.numeric }))),
    [symbols, plc.variables],
  )
  const suggestion = useMemo(() => suggestConfiguration(needs, DEFAULT_MARGIN), [needs])
  const map = config?.cpu ? ioMap(config) : null
  const cpu = config?.cpu && cpuById(config.cpu)
  const set = (next) => onChange((p) => ({ ...p, s7200: next }))
  const describe = (c) => [cpuById(c.cpu)?.label, ...c.modules.map((m) => moduleById(m)?.label)].filter(Boolean).join(' + ')
  const same = suggestion && config && suggestion.cpu === config.cpu && suggestion.modules.join() === config.modules.join()
  const free = map && { di: map.inputs.length - needs.di, do: map.outputs.length - needs.do, ai: map.analogIn.length - needs.ai, ao: map.analogOut.length - needs.ao }

  return (
    <section aria-label={t('Configuración S7-200')} className="space-y-2 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <strong>{t('Configuración S7-200')}</strong>
        <span className="text-slate-600">
          El proyecto usa {needs.di} entradas y {needs.do} salidas digitales
          {needs.ai + needs.ao > 0 && t(', {ai} entradas y {ao} salidas analógicas', { ai: needs.ai, ao: needs.ao })}.
        </span>
      </div>
      {suggestion ? (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            Sugerida (con {Math.round(DEFAULT_MARGIN * 100)} % de reserva): <strong>{describe(suggestion)}</strong>
          </span>
          {!same && (
            <button
              type="button"
              onClick={() => set({ cpu: suggestion.cpu, modules: suggestion.modules })}
              className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
            >
              <WandSparkles size={13} />{' '}{t('Usar la sugerida')}
            </button>
          )}
        </div>
      ) : (
        <p className="text-amber-700">{t('No cabe en ninguna configuración S7-200 (máx. 128 E / 128 S digitales y 32 / 32 analógicas).')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">
          {t('CPU')}
          <select
            aria-label={t('CPU S7-200')}
            className="rounded-md border border-slate-300 px-1.5 py-1"
            value={config?.cpu ?? ''}
            onChange={(e) => set(e.target.value ? { cpu: e.target.value, modules: (config?.modules ?? []).slice(0, cpuById(e.target.value).maxModules) } : null)}
          >
            <option value="">{t('— sin elegir —')}</option>
            {CPUS.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.label)} ({c.di} E / {c.do} S{c.ai ? `, ${c.ai} EA / ${c.ao} SA` : ''})
              </option>
            ))}
          </select>
        </label>
        {config?.modules.map((id, i) => (
          <span key={i} className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs">
            {moduleById(id)?.label ?? id}
            <button
              type="button"
              aria-label={`Quitar ${moduleById(id)?.label ?? id}`}
              onClick={() => set({ ...config, modules: config.modules.filter((_, j) => j !== i) })}
              className="rounded p-0.5 text-slate-400 hover:text-red-600"
            >
              <Trash2 size={12} />
            </button>
          </span>
        ))}
        {cpu && config.modules.length < cpu.maxModules && (
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <Plus size={13} />
            <select
              aria-label={t('Añadir módulo de ampliación')}
              className="rounded-md border border-slate-300 px-1 py-0.5"
              value=""
              onChange={(e) => e.target.value && set({ ...config, modules: [...config.modules, e.target.value] })}
            >
              <option value="">{t('Añadir módulo…')}</option>
              {MODULES.map((m) => (
                <option key={m.id} value={m.id}>
                  {t(m.label)}
                </option>
              ))}
            </select>
          </label>
        )}
        {cpu && cpu.maxModules === 0 && <span className="text-xs text-slate-500">{t('(la CPU 221 no admite módulos)')}</span>}
      </div>

      {map && (
        <div className="space-y-1">
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs text-slate-600" aria-label={t('Mapa de direcciones')}>
            {map.parts.map((p, i) => (
              <li key={i}>
                <span className="font-sans font-medium text-slate-800">{t(p.label)}:</span> {p.ranges.join(' · ')}
              </li>
            ))}
          </ul>
          <p className={`text-xs ${Object.values(free).some((v) => v < 0) ? 'text-red-600' : 'text-slate-500'}`}>
            Libres: {free.di} E · {free.do} S{map.analogIn.length + map.analogOut.length > 0 && ` · ${free.ai} EA · ${free.ao} SA`}.
            «Reasignar todo» usa estas direcciones. Comprueba en el manual el consumo de 5 V de los módulos.
            {cpu?.note && ` ${cpu.note}.`}
          </p>
        </div>
      )}
    </section>
  )
}
