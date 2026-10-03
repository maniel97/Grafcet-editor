import { Fragment, useEffect, useRef, useState } from 'react'
import { FilePlus, X } from 'lucide-react'
import { PLATFORMS, STARTS, buildNewProject, loadNewProjectOptions, saveNewProjectOptions } from '../lib/newProject'
import { STEP_PREFIXES, setPreferredStepPrefix } from '../lib/stepNames'
import { CPUS } from '../lib/s7200Catalog'

const field = 'mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1.5'
const caption = 'text-xs font-medium text-slate-500'

// Abrir > Nuevo…: proyecto en blanco con su título, el autómata previsto, cómo empezar, la tabla de
// variables en el lienzo y los datos del cajetín (lib/newProject.js).
export default function NewProjectDialog({ onCreate, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const [options, setOptions] = useState(loadNewProjectOptions)
  const set = (patch) => setOptions((o) => ({ ...o, ...patch }))
  const create = () => {
    saveNewProjectOptions(options)
    setPreferredStepPrefix(options.stepPrefix)
    onCreate(buildNewProject(options))
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="new-project-title"
      className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          create()
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 id="new-project-title" className="flex items-center gap-2 text-base font-semibold">
            <FilePlus size={18} /> Nuevo proyecto
          </h2>
          <button type="button" onClick={() => dialogRef.current.close()} title="Cerrar" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <label className="block">
            <span className={caption}>Título</span>
            <input
              value={options.name}
              onChange={(e) => set({ name: e.target.value })}
              className={`${field} text-base`}
              placeholder="Por ejemplo: Taladradora automática"
              aria-label="Título"
              autoFocus
            />
            <span className="mt-0.5 block text-xs text-slate-500">Da nombre a los archivos al guardar y exportar, y aparece en el cajetín del PDF.</span>
          </label>

          <fieldset className="space-y-1.5">
            <legend className={caption}>Autómata previsto</legend>
            {PLATFORMS.map((p) => (
              <Fragment key={p.id}>
                <label className="flex items-baseline gap-2">
                  <input type="radio" name="platform" checked={options.platform === p.id} onChange={() => set({ platform: p.id })} />
                  <span>
                    {p.label} <span className="font-mono text-xs text-slate-500">{p.hint}</span>
                  </span>
                </label>
                {p.id === 's7200' && options.platform === 's7200' && (
                  <label className="ml-6 flex items-center gap-2">
                    CPU
                    <select value={options.cpu} onChange={(e) => set({ cpu: e.target.value })} aria-label="CPU" className="rounded-md border border-slate-300 px-2 py-1">
                      <option value="">Decidir más tarde (se sugiere según lo que uses)</option>
                      {CPUS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.di} E / {c.do} S{c.ai ? `, ${c.ai} EA / ${c.ao} SA` : ''})
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </Fragment>
            ))}
            <span className="block text-xs text-slate-500">Decide el formato de las direcciones; se puede cambiar después en la tabla de variables.</span>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className={caption}>Empezar con</legend>
            {STARTS.map((s) => (
              <label key={s.id} className="flex items-baseline gap-2">
                <input type="radio" name="start" checked={options.start === s.id} onChange={() => set({ start: s.id })} />
                <span>
                  {s.label} <span className="text-xs text-slate-500">· {s.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className={caption}>Tabla de variables</legend>
            <label className="flex items-baseline gap-2">
              <input type="checkbox" checked={options.table} onChange={(e) => set({ table: e.target.checked })} />
              <span>
                En el lienzo, a la izquierda del grafcet <span className="text-xs text-slate-500">· se rellena sola al escribir receptividades y acciones</span>
              </span>
            </label>
            <label className="flex items-baseline gap-2">
              <input type="checkbox" checked={options.showAddresses} onChange={(e) => set({ showAddresses: e.target.checked })} />
              <span>
                Mostrar las direcciones en el diagrama <span className="text-xs text-slate-500">· debajo de cada etapa y receptividad</span>
              </span>
            </label>
            <label className="flex items-center gap-2">
              Variables de etapa
              <select value={options.stepPrefix} onChange={(e) => set({ stepPrefix: e.target.value })} aria-label="Variables de etapa" className="rounded-md border border-slate-300 px-2 py-1">
                {STEP_PREFIXES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <label className="block">
            <span className={caption}>Enunciado (opcional)</span>
            <textarea
              value={options.statement}
              onChange={(e) => set({ statement: e.target.value })}
              rows={3}
              className={field}
              placeholder="Qué tiene que hacer el automatismo. Se pone en una nota junto al grafcet."
              aria-label="Enunciado"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={caption}>Autor (opcional)</span>
              <input value={options.author} onChange={(e) => set({ author: e.target.value })} className={field} aria-label="Autor" />
            </label>
            <label className="block">
              <span className={caption}>Centro / empresa (opcional)</span>
              <input value={options.company} onChange={(e) => set({ company: e.target.value })} className={field} aria-label="Centro / empresa" />
            </label>
            <span className="col-span-2 -mt-2 text-xs text-slate-500">Para el cajetín del PDF y el dossier. Se recuerdan para la próxima vez.</span>
          </div>

          <p className="text-xs text-slate-500">Lo que hay ahora en el lienzo se guarda en «Trabajos anteriores» (y se puede deshacer).</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={() => dialogRef.current.close()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            Cancelar
          </button>
          <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            Crear proyecto
          </button>
        </div>
      </form>
    </dialog>
  )
}
