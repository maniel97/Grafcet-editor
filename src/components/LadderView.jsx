import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Download, FileCode, FileText, Image, Pause, Play, Table2, X } from 'lucide-react'
import LadderDiagram from './LadderDiagram'
import LadderZoom from './LadderZoom'
import { generateLadder } from '../lib/ladder/generate'
import { ladderLive } from '../lib/ladder/live'
import { toAWL, toStructuredText } from '../lib/ladder/exportText'
import { encodeAnsi, s7200Symbols, toS7200 } from '../lib/ladder/exportS7200'
import { projectVariables } from '../lib/symbols'
import { svgSource } from '../lib/svgExport'
import ExportDialog from './ExportDialog'
import { downloadFile } from '../lib/projectFile'
import { fileName, getProjectName } from '../lib/fileNames'
import { t, N_ } from '../lib/i18n'

const TABS = [
  { id: 'ladder', label: N_('Ladder (LD)') },
  { id: 'st', label: N_('Texto estructurado (ST)') },
  { id: 'scl', label: N_('SCL (TIA Portal)') },
  { id: 'awl', label: N_('AWL / STL (S7)') },
  { id: 's7200', label: N_('STL S7-200 (Micro/WIN)') },
]
// Texto de cada pestaña: extensión del archivo descargado.
const EXT = { st: 'st', scl: 'scl', awl: 'awl', s7200: 'awl' }
const MODES = [
  { id: 'both', label: N_('Símbolo y dirección') },
  { id: 'symbol', label: N_('Símbolos') },
  { id: 'address', label: N_('Direcciones') },
]

function Segmented({ value, options, onChange, label }) {
  return (
    <div className="flex rounded-md border border-slate-300 p-0.5 text-xs" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded px-2 py-1 ${value === o.id ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  )
}

function ActionButton({ icon: Icon, children, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100"
    >
      <Icon size={15} /> {children}
    </button>
  )
}

// Traducción del grafcet a ladder, con su texto equivalente en ST y AWL. Se regenera al abrirla,
// así que siempre corresponde al diagrama y a la tabla de variables actuales.
// simulation: la de useSimulation mientras se simula (ladder en vivo), o null. highlightNodeId:
// segmentos de ese elemento del grafcet resaltados. onShowInGrafcet(id): clic en un segmento.
export default function LadderView({ nodes, edges, plc, grafcetErrors, exportProps, onClose, simulation = null, highlightNodeId = null, onShowInGrafcet }) {
  const [tab, setTab] = useState('ladder')
  const [mode, setMode] = useState('both')
  const [mnemonic, setMnemonic] = useState('de')
  const [copied, setCopied] = useState(false)
  const svgRef = useRef(null)
  const [exportFormat, setExportFormat] = useState(null)
  // El SVG se lee al exportar (no al dibujar): por eso se pasa una función que lo busca.
  const [exportSource] = useState(() =>
    svgSource(() => document.querySelector('[data-ladder-svg]'), {
      kind: 'ladder',
      title: `${getProjectName().trim() || 'Grafcet'} · ${t('ladder (método SET/RESET)')}`,
      name: (ext) => fileName(ext, 'ladder'),
    }),
  )

  const ladder = useMemo(() => generateLadder(nodes, edges, plc), [nodes, edges, plc])
  // En vivo (y sin capas al exportar: el esquema exportado es siempre el limpio).
  const simCompiled = simulation?.compiled
  const simState = simulation?.sim?.state
  const live = useMemo(
    () => (simCompiled && simState && !exportFormat ? ladderLive(ladder, simCompiled, simState) : null),
    [ladder, simCompiled, simState, exportFormat],
  )
  const simInputs = useMemo(() => simCompiled?.variables.filter((v) => v.type === 'input') ?? [], [simCompiled])
  // Al abrir desde «Ver en el ladder»: el primer segmento resaltado, a la vista.
  useEffect(() => {
    if (!highlightNodeId) return
    requestAnimationFrame(() => document.querySelector('[data-ladder-svg] [data-highlighted]')?.scrollIntoView({ block: 'center' }))
  }, [highlightNodeId])
  // Ancho real del esquema (para ajustarlo al ancho de la ventana).
  const [naturalWidth, setNaturalWidth] = useState(0)
  useLayoutEffect(() => {
    setNaturalWidth(Number(svgRef.current?.getAttribute('width')) || 0)
  }, [ladder, mode, tab])
  const st = useMemo(() => toStructuredText(ladder, plc), [ladder, plc])
  const scl = useMemo(() => toStructuredText(ladder, plc, { dialect: 'tia' }), [ladder, plc])
  const awl = useMemo(() => toAWL(ladder, { mnemonic, useAddresses: mode !== 'symbol' }), [ladder, mnemonic, mode])
  // STEP 7-Micro/WIN (S7-200): programa STL importable y tabla de símbolos para pegar.
  const s7200 = useMemo(() => (tab === 's7200' ? toS7200(ladder, plc, { title: getProjectName().trim() }) : null), [tab, ladder, plc])
  const s7200Table = useMemo(() => {
    if (!s7200) return ''
    const stepNodes = nodes.filter((n) => n.type === 'step')
    return s7200Symbols(ladder, plc, stepNodes, projectVariables(nodes, plc.variables), s7200.addressOf)
  }, [s7200, ladder, plc, nodes])
  const [tableCopied, setTableCopied] = useState(false)
  const copyTable = async () => {
    await navigator.clipboard.writeText(s7200Table)
    setTableCopied(true)
    setTimeout(() => setTableCopied(false), 1500)
  }

  useEffect(() => {
    // Con el diálogo de exportación abierto, Esc solo cierra el diálogo.
    const onKeyDown = (e) => e.key === 'Escape' && !document.querySelector('dialog[open]') && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const rungCount = ladder.sections.reduce((n, s) => n + s.rungs.length, 0)
  const missingAddresses = [...ladder.sections.flatMap((s) => s.rungs.flatMap((r) => r.outputs.map((o) => o.operand)))].some(
    (op) => (op.kind === 'step' || op.kind === 'var') && !ladder.resolver.address(op),
  )
  const firstCycleAddress = ladder.resolver.address({ kind: 'first' })

  const text = { st, scl, awl, s7200: s7200?.text }[tab] ?? ''
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50" role="dialog" aria-label={t('Ladder generado')}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <h2 className="text-base font-semibold">{t('Paso a ladder')}</h2>
        <span className="text-xs text-slate-500">{rungCount} segmentos · método SET/RESET por etapas</span>
        <div className="flex gap-1" role="tablist">
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => setTab(x.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === x.id ? 'bg-blue-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t(x.label)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(tab === 'ladder' || tab === 'awl') && <Segmented value={mode} options={MODES} onChange={setMode} label={t('Etiquetas')} />}
          {tab === 'awl' && (
            <Segmented
              value={mnemonic}
              options={[
                { id: 'de', label: N_('Alemán (U, UN)') },
                { id: 'en', label: N_('Inglés (A, AN)') },
              ]}
              onChange={setMnemonic}
              label={t('Nemotécnica')}
            />
          )}
          {tab === 'ladder' ? (
            <>
              <ActionButton icon={FileCode} onClick={() => setExportFormat('svg')} title={t('Exportar el esquema en SVG (con vista previa)')}>
                {t('SVG')}
              </ActionButton>
              <ActionButton icon={Image} onClick={() => setExportFormat('png')} title={t('Exportar el esquema en PNG (con vista previa)')}>
                {t('PNG')}
              </ActionButton>
              <ActionButton icon={FileText} onClick={() => setExportFormat('pdf')} title={t('Exportar a PDF: páginas cortadas entre segmentos (con vista previa)')}>
                {t('PDF')}
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton icon={copied ? Check : Copy} onClick={copy} title={t('Copiar al portapapeles')}>
                {copied ? t('Copiado') : t('Copiar')}
              </ActionButton>
              <ActionButton
                icon={Download}
                onClick={() =>
                  tab === 's7200'
                    ? // Micro/WIN lee los archivos en ANSI (Windows-1252), no en UTF-8.
                      downloadFile(encodeAnsi(text), fileName('awl', 's7-200'), 'text/plain;charset=windows-1252')
                    : downloadFile(text, fileName(EXT[tab]), 'text/plain;charset=utf-8')
                }
                title={tab === 's7200' ? t('Descargar para importar en Micro/WIN (Archivo > Importar)') : t('Descargar como archivo de texto')}
              >
                .{EXT[tab]}
              </ActionButton>
              {tab === 's7200' && (
                <ActionButton icon={tableCopied ? Check : Table2} onClick={copyTable} title={t('Copiar la tabla de símbolos para pegarla en la de Micro/WIN')}>
                  {tableCopied ? t('Copiada') : t('Símbolos')}
                </ActionButton>
              )}
            </>
          )}
          <button type="button" onClick={onClose} title={t('Cerrar (Esc)')} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
      </header>

      {live && tab === 'ladder' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-green-200 bg-green-50 px-4 py-2 text-xs text-green-900" aria-label={t('Simulación en vivo')}>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-green-600" />{' '}{t('En vivo')}
          </span>
          <span className="text-green-800">contactos cerrados y salidas activas en verde · t = {simState.time.toFixed(1)} s</span>
          <button
            type="button"
            onClick={() => simulation.setPlaying(!simulation.playing)}
            className="flex items-center gap-1 rounded border border-green-300 bg-white px-2 py-0.5 hover:bg-green-100"
          >
            {simulation.playing ? <Pause size={12} /> : <Play size={12} />} {simulation.playing ? t('Pausa') : t('Seguir')}
          </button>
          {simInputs.map((v) => {
            const on = Boolean(simulation.sim.inputs[v.name])
            return (
              <button
                key={v.name}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => simulation.setInput(v.name, !on)}
                className={`rounded border px-2 py-0.5 font-mono ${on ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
              >
                {v.name}
              </button>
            )
          })}
          {onShowInGrafcet && <span className="ml-auto text-green-800">{t('Clic en un segmento: verlo en el grafcet')}</span>}
        </div>
      )}
      {tab === 's7200' && s7200 && (
        <div className="space-y-1 border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900" aria-label={t('Instrucciones para Micro/WIN')}>
          <p>
            <strong>{t('STEP 7-Micro/WIN:')}</strong>{' '}{t('descarga el')}{' '}<code>{t('.awl')}</code>{' '}{t('e impórtalo con')}{' '}<em>{t('Archivo → Importar')}</em>{' '}{t('(se ve en KOP o AWL). Para los nombres, pulsa')}{' '}<em>{t('Símbolos')}</em>{' '}{t('y pégalos en la tabla de símbolos (columna Símbolo). Primer ciclo: SM0.1.')}
          </p>
          {plc.scheme !== 's7200' && (
            <p>
              {t('Consejo: en')}{' '}<em>{t('Variables')}</em>{t(', elige el formato de direcciones «S7-200 / Micro/WIN» (etapas en memoria V, temporizadores desde T37): las marcas M del S7-200 solo llegan a M31.7.')}
            </p>
          )}
          {s7200.warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-1 text-amber-800">
              <AlertTriangle size={14} className="shrink-0" /> {w}
            </p>
          ))}
        </div>
      )}
      {(grafcetErrors > 0 || ladder.warnings.length > 0 || missingAddresses || !firstCycleAddress) && tab !== 's7200' && (
        <div className="space-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {grafcetErrors > 0 && (
            <p className="flex items-center gap-1">
              <AlertTriangle size={14} /> {t('El grafcet tiene {n} error(es) de conformidad (ver Verificar): el programa puede no comportarse como se espera.', { n: grafcetErrors })}
            </p>
          )}
          {ladder.warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-1">
              <AlertTriangle size={14} /> {w.message}
            </p>
          ))}
          {missingAddresses && (
            <p>
              {t('Hay etapas o variables sin dirección: se escriben con su símbolo. Asígnalas en')}{' '}<strong>{t('Variables')}</strong>{' '}{t('(botón «Rellenar vacías»).')}
            </p>
          )}
          {!firstCycleAddress && (
            <p>
              {t('«PrimerCiclo» debe valer 1 solo en el primer ciclo: añádelo como marca en Variables con la de tu CPU (p. ej. la marca de sistema FirstScan en S7-1200) o actívalo desde OB100. En ST ya se calcula solo.')}
            </p>
          )}
        </div>
      )}

      {tab === 'ladder' ? (
        <LadderZoom naturalWidth={naturalWidth}>
          <LadderDiagram
            ref={svgRef}
            ladder={ladder}
            mode={mode}
            live={live}
            highlightNodeId={exportFormat ? null : highlightNodeId}
            onRungClick={onShowInGrafcet && !exportFormat ? (rung) => onShowInGrafcet(rung.nodeIds[0]) : undefined}
          />
        </LadderZoom>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <pre className="rounded-lg border border-slate-200 bg-white p-4 font-mono text-[13px] leading-relaxed text-slate-800 shadow-sm">
            {text}
          </pre>
        </div>
      )}
      {exportFormat && (
        <ExportDialog
          source={exportSource}
          initialFormat={exportFormat}
          fileName={(ext) => fileName(ext, 'ladder')}
          {...exportProps}
          onClose={() => setExportFormat(null)}
        />
      )}
    </div>
  )
}
