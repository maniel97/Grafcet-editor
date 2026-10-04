import { useRef, useState } from 'react'
import { AlertTriangle, CircleCheck, CircleX, Cpu, FileUp, Table2 } from 'lucide-react'
import { parseSymbolTable } from '../lib/plc/symbolTable'
import { t, N_ } from '../lib/i18n'

// Lógica de la simulación: el grafcet del editor o un programa S7-200 en la CPU simulada
// (lib/plc). config = plc.cpu: { enabled, source: 'generated' | 'file', text, name }.
export default function CpuControls({ config = {}, status, onChange, onApplySymbols }) {
  const fileRef = useRef(null)
  const [pasting, setPasting] = useState(false)
  const [table, setTable] = useState('')
  const [tableMessage, setTableMessage] = useState(null)
  const enabled = Boolean(config.enabled)
  const set = (patch) => onChange({ ...config, ...patch })
  const errors = status?.errors ?? []
  const ok = enabled && status && !errors.length && !status.error

  return (
    <div className="space-y-2 border-b border-slate-100 px-4 py-2 text-xs" aria-label={t('Lógica de la simulación')}>
      <div className="flex rounded-md border border-slate-300 p-0.5" role="radiogroup" aria-label={t('Lógica')}>
        {[
          [false, N_('Grafcet del editor')],
          [true, N_('Autómata S7-200')],
        ].map(([value, label]) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={enabled === value}
            onClick={() => set({ enabled: value, source: config.source ?? 'generated' })}
            className={`flex-1 rounded px-2 py-1 ${enabled === value ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {value && <Cpu size={12} className="mr-1 inline" />}
            {t(label)}
          </button>
        ))}
      </div>
      {enabled && (
        <>
          <fieldset className="space-y-1">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="cpu-source" checked={config.source !== 'file'} onChange={() => set({ source: 'generated' })} />
              {t('El programa generado del grafcet (STL S7-200)')}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="cpu-source" checked={config.source === 'file'} onChange={() => set({ source: 'file' })} disabled={!config.text} />
              Un programa de Micro/WIN {config.name ? <span className="font-mono">({config.name})</span> : ''}
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
              <FileUp size={12} />{' '}{t('Cargar .awl…')}
            </button>
            <button type="button" onClick={() => setPasting((p) => !p)} aria-expanded={pasting} className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100">
              <Table2 size={12} />{' '}{t('Pegar tabla de símbolos…')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".awl,.txt,text/plain"
              className="hidden"
              aria-label={t('Programa .awl')}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                // Micro/WIN guarda los .awl en ANSI (Windows-1252).
                const text = new TextDecoder('windows-1252').decode(await file.arrayBuffer())
                onChange({ ...config, enabled: true, source: 'file', text, name: file.name })
              }}
            />
          </div>
          {pasting && (
            <div className="space-y-1">
              <textarea
                value={table}
                onChange={(e) => setTable(e.target.value)}
                rows={5}
                aria-label={t('Tabla de símbolos')}
                placeholder={t('Copia las filas de la tabla de símbolos de Micro/WIN y pégalas aquí:\nMarcha\tI0.0\tPulsador verde')}
                className="w-full rounded border border-slate-300 px-1 py-0.5 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => {
                  const { symbols, skipped } = parseSymbolTable(table)
                  onApplySymbols(symbols)
                  setTableMessage(
        skipped.length
          ? t('{n} símbolos aplicados a la tabla de variables ({sin} líneas sin entender).', { n: symbols.length, sin: skipped.length })
          : t('{n} símbolos aplicados a la tabla de variables.', { n: symbols.length }),
      )
                  setTable('')
                  setPasting(false)
                }}
                disabled={!table.trim()}
                className="rounded bg-blue-600 px-2 py-0.5 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {t('Aplicar')}
              </button>
            </div>
          )}
          {tableMessage && (
            <p role="status" className="text-blue-700">
              {tableMessage}
            </p>
          )}
          {ok && (
            <p className="flex items-center gap-1 text-green-700" role="status">
              <CircleCheck size={13} />{' '}{t('RUN · ciclo de 10 ms · las etapas del grafcet no se usan')}
            </p>
          )}
          {status?.error && (
            <p className="flex items-start gap-1 rounded bg-red-50 p-1.5 text-red-700" role="alert">
              <CircleX size={13} className="mt-0.5 shrink-0" /> STOP: {status.error}
            </p>
          )}
          {errors.map((err, i) => (
            <p key={i} className="flex items-start gap-1 text-red-700" role="alert">
              <CircleX size={13} className="mt-0.5 shrink-0" /> {err.message}
            </p>
          ))}
          {(status?.warnings ?? []).map((w) => (
            <p key={w} className="flex items-start gap-1 text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </>
      )}
    </div>
  )
}
