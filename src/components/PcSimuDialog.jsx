import { useEffect, useMemo, useRef } from 'react'
import { AlertTriangle, Download, MonitorPlay, X } from 'lucide-react'
import { exportPcSimu, withAuxOutputs } from '../lib/pcsimu'
import { generateLadder } from '../lib/ladder/generate'
import { encodeAnsi, toS7200 } from '../lib/ladder/exportS7200'
import { downloadFile } from '../lib/projectFile'
import { fileName, getProjectName } from '../lib/fileNames'
import { t } from '../lib/i18n'

// Exportar > Planta para PC_SIMU (lib/pcsimu.js): el panel de mando de la planta virtual en un .sim,
// y al lado el programa del S7-200 (.awl) para cargarlo en el mismo PC_SIMU.
export default function PcSimuDialog({ nodes, edges, plc, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])
  const program = useMemo(() => toS7200(generateLadder(nodes, edges, plc), plc, { title: getProjectName().trim() }), [nodes, edges, plc])
  // Con las direcciones del programa (las que no existen en un S7-200 las cambia), y sin repartir como
  // auxiliares las salidas que ya usa.
  const sim = useMemo(
    () => exportPcSimu({ plc }, { reserved: program.text.match(/\bQ\d+\.\d\b/g) ?? [], addressOf: program.addressOf }),
    [plc, program],
  )
  const awl = useMemo(() => ({ ...program, text: withAuxOutputs(program.text, sim.aux) }), [program, sim])
  const ansi = 'text/plain;charset=windows-1252'
  const button = 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40'

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="pcsimu-title"
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="pcsimu-title" className="flex items-center gap-2 text-base font-semibold">
          <MonitorPlay size={18} />{' '}{t('Planta para PC_SIMU')}
        </h2>
        <button type="button" onClick={() => dialogRef.current.close()} title={t('Cerrar')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <p className="text-slate-600">
          {t('La planta virtual pasa a PC_SIMU: el pupitre como un panel, cada mando y piloto con su dirección y su color, y, si la planta se ve de frente, la máquina a escala. En PC_SIMU, abre el .sim y carga el programa .awl.')}
        </p>
        {sim.machine && (
          <p className="flex items-start gap-1.5 rounded bg-amber-50 p-2 text-amber-800" role="note" data-pcsimu-timing>
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {t('En PC_SIMU, las piezas y las cintas avanzan al ritmo con el que se redibuja la pantalla (y de su velocidad de simulación), no al del autómata: los tiempos del programa no coinciden con lo que se ve. Para probar los tiempos, usa la simulación del editor.')}
          </p>
        )}
        <p data-pcsimu-count>
          {sim.count ? t('{n} elementos en el panel.', { n: sim.count }) : t('La planta no tiene pulsadores ni pilotos con dirección: el panel saldría vacío.')}
        </p>
        {sim.warnings.length > 0 && (
          <ul className="space-y-1 text-amber-800">
            {sim.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-1">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
              </li>
            ))}
          </ul>
        )}
        {awl.warnings.length > 0 && (
          <details className="text-slate-600">
            <summary className="cursor-pointer">{t('Avisos del programa .awl ({n})', { n: awl.warnings.length })}</summary>
            <ul className="mt-1 space-y-1 text-amber-800">
              {awl.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
        <button type="button" className={`${button} border border-slate-300 hover:bg-slate-50`} onClick={() => downloadFile(encodeAnsi(awl.text), fileName('awl', 's7-200'), ansi)}>
          <Download size={15} /> {t('Programa .awl')}
        </button>
        <button type="button" disabled={!sim.count} className={`${button} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => downloadFile(sim.bytes, fileName('sim', 'pc-simu'), ansi)}>
          <Download size={15} /> {t('Panel .sim')}
        </button>
      </div>
    </dialog>
  )
}
