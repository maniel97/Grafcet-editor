import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Plus, Trash2, WandSparkles, X } from 'lucide-react'
import { SCHEMES, VARIABLE_TYPES, duplicatedAddresses, typeInfo } from '../lib/addressing'

const cellInput =
  'w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none'
const th = 'px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide text-slate-500'

const stepSort = (a, b) =>
  String(a.data.label).localeCompare(String(b.data.label), 'es', { numeric: true })

// Tabla de variables: dirección de PLC de cada etapa y de cada variable del grafcet.
// Es la base para la futura simulación y la traducción a ladder.
export default function VariablesDialog({
  plc,
  stepNodes,
  symbols,
  issues,
  onChange,
  onAutoAssign,
  onExportCsv,
  tableShown,
  onToggleTable,
  onAddVariable,
  onClose,
}) {
  const dialogRef = useRef(null)
  const [tab, setTab] = useState('steps')

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  // Direcciones repetidas, para marcarlas en rojo.
  const duplicated = useMemo(() => duplicatedAddresses(plc, stepNodes, symbols), [plc, stepNodes, symbols])
  const isDup = (a) => !!a?.trim() && duplicated.has(a.trim().toUpperCase())

  const setStep = (id, patch, field) =>
    onChange((p) => ({ ...p, steps: { ...p.steps, [id]: { ...p.steps[id], ...patch } } }), `step:${id}:${field}`)
  const setVariable = (name, patch, field) =>
    onChange((p) => ({ ...p, variables: { ...p.variables, [name]: { ...p.variables[name], ...patch } } }), `var:${name}:${field}`)
  const removeVariable = (name) =>
    onChange((p) => {
      const variables = { ...p.variables }
      delete variables[name]
      return { ...p, variables }
    })

  const addressInput = (value, onValue, placeholder) => (
    <input
      className={`${cellInput} font-mono ${isDup(value) ? 'border-red-400 bg-red-50 text-red-700' : ''}`}
      value={value ?? ''}
      placeholder={placeholder}
      title={isDup(value) ? 'Dirección repetida' : undefined}
      onChange={(e) => onValue(e.target.value)}
    />
  )

  const errorCount = issues.filter((i) => i.severity === 'error').length
  const warningCount = issues.length - errorCount

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="vars-title"
      className="m-auto flex max-h-[85vh] w-[min(60rem,calc(100vw-2rem))] flex-col rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 [&:not([open])]:hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="vars-title" className="text-base font-semibold">
          Tabla de variables
        </h2>
        <button type="button" onClick={onClose} title="Cerrar (Esc)" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-2 text-sm">
        <select
          className="rounded-md border border-slate-300 px-2 py-1"
          value={plc.scheme}
          onChange={(e) => onChange((p) => ({ ...p, scheme: e.target.value }))}
          aria-label="Formato de direcciones"
        >
          {SCHEMES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onAutoAssign(false)}
          title="Asigna dirección a etapas y variables que aún no tienen, sin tocar las existentes"
          className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 font-medium text-white hover:bg-blue-700"
        >
          <WandSparkles size={16} /> Rellenar vacías
        </button>
        <button
          type="button"
          onClick={() => onAutoAssign(true)}
          title="Vuelve a asignar todas las direcciones en orden (se puede deshacer)"
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
        >
          Reasignar todo
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          title="Descarga la tabla en CSV para importarla en el software del PLC"
          className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
        >
          <Download size={16} /> CSV
        </button>
        <div className="ml-auto flex flex-col gap-0.5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={tableShown} onChange={onToggleTable} />
            Mostrar la tabla en el lienzo
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={plc.showAddresses}
              onChange={(e) => onChange((p) => ({ ...p, showAddresses: e.target.checked }))}
            />
            Mostrar direcciones en el diagrama
          </label>
        </div>
      </div>

      <div className="flex gap-1 px-5 pt-2" role="tablist">
        {[
          ['steps', `Etapas (${stepNodes.length})`],
          ['variables', `Variables (${symbols.size})`],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-t-md border-b-2 px-3 py-1.5 text-sm ${
              tab === id ? 'border-blue-600 font-medium text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
        {issues.length > 0 && (
          <span className={`ml-auto self-center text-xs ${errorCount ? 'text-red-600' : 'text-amber-600'}`}>
            {errorCount > 0 && `${errorCount} error(es) `}
            {warningCount > 0 && `${warningCount} aviso(s)`} · ver Verificar
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {tab === 'steps' ? (
          <table className="w-full">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200">
                <th className={`${th} w-24`}>Etapa</th>
                <th className={`${th} w-36`}>Dirección</th>
                <th className={th}>Comentario</th>
              </tr>
            </thead>
            <tbody>
              {[...stepNodes].sort(stepSort).map((s) => (
                <tr key={s.id} className="border-b border-slate-100">
                  <td className="px-2 font-mono text-sm">
                    X{s.data.label}
                    {s.data.initial && <span className="ml-1 text-xs text-slate-400">inicial</span>}
                  </td>
                  <td>{addressInput(plc.steps[s.id]?.address, (v) => setStep(s.id, { address: v }, 'address'), 'M0.0')}</td>
                  <td>
                    <input
                      className={cellInput}
                      value={plc.steps[s.id]?.comment ?? ''}
                      placeholder="p. ej. Reposo"
                      onChange={(e) => setStep(s.id, { comment: e.target.value }, 'comment')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            {symbols.size === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">
                Aún no hay variables: se detectan solas en las receptividades y las acciones.
              </p>
            )}
            {symbols.size > 0 && (
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200">
                    <th className={th}>Símbolo</th>
                    <th className={`${th} w-36`}>Tipo</th>
                    <th className={`${th} w-32`}>Dirección</th>
                    <th className={`${th} w-24`}>Presel.</th>
                    <th className={th}>Comentario</th>
                    <th className={`${th} w-12 text-right`}>Usos</th>
                  </tr>
                </thead>
                <tbody>
                  {[...symbols].map(([name, found]) => {
                    const entry = plc.variables[name] ?? {}
                    const type = entry.type ?? found.type
                    return (
                      <tr key={name} className="border-b border-slate-100">
                        <td className="px-2 font-mono text-sm">{name}</td>
                        <td>
                          <select
                            className={cellInput}
                            value={type}
                            onChange={(e) => setVariable(name, { type: e.target.value }, 'type')}
                          >
                            {VARIABLE_TYPES.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {addressInput(
                            entry.address,
                            (v) => setVariable(name, { address: v }, 'address'),
                            plc.scheme === 'iec' ? `%${typeInfo(type).area}X0.0` : `${typeInfo(type).area}0.0`,
                          )}
                        </td>
                        <td>
                          {type === 'timer' || type === 'counter' ? (
                            <input
                              className={`${cellInput} font-mono`}
                              value={entry.preset ?? found.preset ?? ''}
                              placeholder={type === 'timer' ? '5s' : '10'}
                              onChange={(e) => setVariable(name, { preset: e.target.value }, 'preset')}
                            />
                          ) : (
                            <span className="px-1.5 text-slate-300">—</span>
                          )}
                        </td>
                        <td>
                          <input
                            className={cellInput}
                            value={entry.comment ?? ''}
                            onChange={(e) => setVariable(name, { comment: e.target.value }, 'comment')}
                          />
                        </td>
                        <td className="px-2 text-right text-sm text-slate-500">
                          {found.uses.size || (
                            <span className="flex items-center justify-end gap-1 text-xs italic">
                              sin uso
                              <button
                                type="button"
                                title="Quitar de la tabla"
                                onClick={() => removeVariable(name)}
                                className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {/* Variables previstas que aún no se usan en el diagrama (se renombran en la tabla del lienzo). */}
            <div className="mt-3 flex flex-wrap items-center gap-1 text-sm">
              <span className="mr-1 text-xs text-slate-500">Añadir:</span>
              {VARIABLE_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onAddVariable(t.id)}
                  className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-0.5 text-xs hover:border-blue-400 hover:bg-blue-50"
                >
                  <Plus size={12} /> {t.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
