import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Download, FileCode, FileText, Image, X } from 'lucide-react'
import LadderDiagram from './LadderDiagram'
import { generateLadder } from '../lib/ladder/generate'
import { toAWL, toStructuredText } from '../lib/ladder/exportText'
import { exportLadderPdf, exportLadderPng, exportLadderSvg } from '../lib/ladder/exportLadder'
import { downloadFile } from '../lib/projectFile'
import { fileName } from '../lib/fileNames'

const TABS = [
  { id: 'ladder', label: 'Ladder (LD)' },
  { id: 'st', label: 'Texto estructurado (ST)' },
  { id: 'awl', label: 'AWL / STL (S7)' },
]
const MODES = [
  { id: 'both', label: 'Símbolo y dirección' },
  { id: 'symbol', label: 'Símbolos' },
  { id: 'address', label: 'Direcciones' },
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
          {o.label}
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
export default function LadderView({ nodes, edges, plc, grafcetErrors, onClose }) {
  const [tab, setTab] = useState('ladder')
  const [mode, setMode] = useState('both')
  const [mnemonic, setMnemonic] = useState('de')
  const [copied, setCopied] = useState(false)
  const svgRef = useRef(null)

  const ladder = useMemo(() => generateLadder(nodes, edges, plc), [nodes, edges, plc])
  const st = useMemo(() => toStructuredText(ladder, plc), [ladder, plc])
  const awl = useMemo(() => toAWL(ladder, { mnemonic, useAddresses: mode !== 'symbol' }), [ladder, mnemonic, mode])

  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const rungCount = ladder.sections.reduce((n, s) => n + s.rungs.length, 0)
  const missingAddresses = [...ladder.sections.flatMap((s) => s.rungs.flatMap((r) => r.outputs.map((o) => o.operand)))].some(
    (op) => (op.kind === 'step' || op.kind === 'var') && !ladder.resolver.address(op),
  )
  const firstCycleAddress = ladder.resolver.address({ kind: 'first' })

  const text = tab === 'st' ? st : awl
  // Las exportaciones pueden fallar (memoria, módulo que no carga...): siempre se avisa.
  const safely = (fn) => async () => {
    try {
      await fn(svgRef.current)
    } catch (err) {
      alert(`No se pudo exportar: ${err.message}`)
    }
  }
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50" role="dialog" aria-label="Ladder generado">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <h2 className="text-base font-semibold">Paso a ladder</h2>
        <span className="text-xs text-slate-500">{rungCount} segmentos · método SET/RESET por etapas</span>
        <div className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? 'bg-blue-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {tab !== 'st' && <Segmented value={mode} options={MODES} onChange={setMode} label="Etiquetas" />}
          {tab === 'awl' && (
            <Segmented
              value={mnemonic}
              options={[
                { id: 'de', label: 'Alemán (U, UN)' },
                { id: 'en', label: 'Inglés (A, AN)' },
              ]}
              onChange={setMnemonic}
              label="Nemotécnica"
            />
          )}
          {tab === 'ladder' ? (
            <>
              <ActionButton icon={FileCode} onClick={safely(exportLadderSvg)} title="Descargar el esquema en SVG">
                SVG
              </ActionButton>
              <ActionButton icon={Image} onClick={safely(exportLadderPng)} title="Descargar el esquema en PNG">
                PNG
              </ActionButton>
              <ActionButton icon={FileText} onClick={safely(exportLadderPdf)} title="PDF A4 paginado entre segmentos">
                PDF
              </ActionButton>
            </>
          ) : (
            <>
              <ActionButton icon={copied ? Check : Copy} onClick={copy} title="Copiar al portapapeles">
                {copied ? 'Copiado' : 'Copiar'}
              </ActionButton>
              <ActionButton
                icon={Download}
                onClick={() =>
                  tab === 'st'
                    ? downloadFile(st, fileName('st'), 'text/plain;charset=utf-8')
                    : downloadFile(awl, fileName('awl'), 'text/plain;charset=utf-8')
                }
                title="Descargar como archivo de texto"
              >
                {tab === 'st' ? '.st' : '.awl'}
              </ActionButton>
            </>
          )}
          <button type="button" onClick={onClose} title="Cerrar (Esc)" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
      </header>

      {(grafcetErrors > 0 || ladder.warnings.length > 0 || missingAddresses || !firstCycleAddress) && (
        <div className="space-y-1 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          {grafcetErrors > 0 && (
            <p className="flex items-center gap-1">
              <AlertTriangle size={14} /> El grafcet tiene {grafcetErrors} error(es) de conformidad (ver Verificar): el programa
              puede no comportarse como se espera.
            </p>
          )}
          {ladder.warnings.map((w, i) => (
            <p key={i} className="flex items-center gap-1">
              <AlertTriangle size={14} /> {w.message}
            </p>
          ))}
          {missingAddresses && (
            <p>
              Hay etapas o variables sin dirección: se escriben con su símbolo. Asígnalas en <strong>Variables</strong> (botón
              «Rellenar vacías»).
            </p>
          )}
          {!firstCycleAddress && (
            <p>
              «PrimerCiclo» debe valer 1 solo en el primer ciclo: añádelo como marca en Variables con la de tu CPU (p. ej. la
              marca de sistema FirstScan en S7-1200) o actívalo desde OB100. En ST ya se calcula solo.
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tab === 'ladder' ? (
          <div className="inline-block rounded-lg border border-slate-200 bg-white shadow-sm">
            <LadderDiagram ref={svgRef} ladder={ladder} mode={mode} />
          </div>
        ) : (
          <pre className="rounded-lg border border-slate-200 bg-white p-4 font-mono text-[13px] leading-relaxed text-slate-800 shadow-sm">
            {text}
          </pre>
        )}
      </div>
    </div>
  )
}
