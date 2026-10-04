import { BookOpen, GraduationCap, Info } from 'lucide-react'
import { t } from '../lib/i18n'

// Visor de los artículos de la ayuda (Markdown sencillo, escrito a mano):
//   # Título · ## Apartado · ### Subapartado
//   párrafos · listas «- » y «1. » · > recuadro de nota («> **Ojo:** …») · tablas «| a | b |»
//   **negrita** · *cursiva* · `código` · [texto](id-de-artículo) · [texto](https://…)
//   ```ejemplo taladradora```  -> tarjeta con «Abrir en el editor»
//   ```tutorial primer-grafcet``` -> tarjeta con «Hacer el tutorial» (guiado, como la visita)
//   ```texto``` (cualquier otro) -> bloque de código
// ctx: { onArticle(id), onExample(id), onTutorial(id), example(id), tutorial(id) }

export function parseBlocks(source) {
  const blocks = []
  const lines = String(source ?? '').replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const fence = /^```\s*([\w-]*)\s*(.*)$/.exec(line)
    if (fence) {
      const body = []
      for (i++; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i])
      blocks.push({ type: 'fence', lang: fence[1], arg: fence[2].trim(), text: body.join('\n') })
      continue
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }
    const collect = (re) => {
      const items = []
      while (i < lines.length && re.test(lines[i])) {
        items.push(lines[i].replace(re, ''))
        i++
      }
      i--
      return items
    }
    if (/^\|/.test(line)) {
      const rows = collect(/^(?=\|)/)
        .filter((row) => !/^\|[\s:|-]+\|?\s*$/.test(row))
        .map((row) => row.replace(/^\||\|\s*$/g, '').split('|').map((cell) => cell.trim()))
      blocks.push({ type: 'table', head: rows[0], rows: rows.slice(1) })
    } else if (/^\s*[-*]\s+/.test(line)) blocks.push({ type: 'list', items: collect(/^\s*[-*]\s+/) })
    else if (/^\s*\d+\.\s+/.test(line)) blocks.push({ type: 'olist', items: collect(/^\s*\d+\.\s+/) })
    else if (/^>\s?/.test(line)) blocks.push({ type: 'note', text: collect(/^>\s?/).join(' ') })
    else {
      const text = []
      while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|\s*[-*]\s+|\s*\d+\.\s+|>|\|)/.test(lines[i])) text.push(lines[i++])
      i--
      blocks.push({ type: 'paragraph', text: text.join(' ') })
    }
  }
  return blocks
}

// Texto en línea: **negrita**, *cursiva*, `código` y [enlaces](destino).
function Inline({ text, ctx }) {
  const parts = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>)
    else if (m[2]) parts.push(<em key={m.index}>{m[2]}</em>)
    else if (m[3]) parts.push(<code key={m.index} className="rounded bg-slate-100 px-1 font-mono text-[0.92em] text-slate-800">{m[3]}</code>)
    else if (/^https?:/.test(m[5]))
      parts.push(
        <a key={m.index} href={m[5]} target="_blank" rel="noreferrer" className="text-blue-700 underline hover:text-blue-900">
          {m[4]}
        </a>,
      )
    else {
      const target = m[5] // m cambia en la siguiente vuelta del bucle
      parts.push(
        <button key={m.index} type="button" onClick={() => ctx.onArticle?.(target)} className="text-blue-700 underline hover:text-blue-900">
          {m[4]}
        </button>,
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

function Card({ icon: Icon, title, text, action, onClick, testId }) {
  return (
    <div className="my-3 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3" data-help-card={testId}>
      <Icon size={22} className="shrink-0 text-blue-700" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-blue-900">{title}</p>
        {text && <p className="text-[0.92em] text-blue-800">{text}</p>}
      </div>
      <button type="button" onClick={onClick} className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
        {action}
      </button>
    </div>
  )
}

export default function Markdown({ source, ctx = {} }) {
  return (
    <div className="help-article space-y-3">
      {parseBlocks(source).map((b, i) => {
        if (b.type === 'heading') {
          const Tag = ['h2', 'h3', 'h4'][b.level - 1]
          const size = ['text-xl font-bold', 'mt-5 text-base font-semibold', 'mt-3 font-semibold'][b.level - 1]
          return (
            <Tag key={i} className={`${size} text-slate-900`}>
              <Inline text={b.text} ctx={ctx} />
            </Tag>
          )
        }
        if (b.type === 'list' || b.type === 'olist') {
          const Tag = b.type === 'list' ? 'ul' : 'ol'
          return (
            <Tag key={i} className={`space-y-1 pl-5 ${b.type === 'list' ? 'list-disc' : 'list-decimal'}`}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline text={item} ctx={ctx} />
                </li>
              ))}
            </Tag>
          )
        }
        if (b.type === 'table')
          return (
            <table key={i} className="w-full border-collapse text-left">
              <thead>
                <tr>
                  {b.head.map((cell, j) => (
                    <th key={j} className="border-b border-slate-300 px-2 py-1 font-semibold">
                      <Inline text={cell} ctx={ctx} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, r) => (
                  <tr key={r} className="border-b border-slate-100">
                    {row.map((cell, j) => (
                      <td key={j} className="px-2 py-1 align-top">
                        <Inline text={cell} ctx={ctx} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        if (b.type === 'note')
          return (
            <div key={i} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <p>
                <Inline text={b.text} ctx={ctx} />
              </p>
            </div>
          )
        if (b.type === 'fence' && b.lang === 'ejemplo') {
          const ex = ctx.example?.(b.arg)
          if (!ex) return null
          return (
            <Card
              key={i}
              icon={BookOpen}
              testId={`ejemplo:${b.arg}`}
              title={t('Ejemplo: {nombre}', { nombre: t(ex.title) })}
              text={b.text || t(ex.description)}
              action={t('Abrir en el editor')}
              onClick={() => ctx.onExample?.(b.arg)}
            />
          )
        }
        if (b.type === 'fence' && b.lang === 'tutorial') {
          const tut = ctx.tutorial?.(b.arg)
          if (!tut) return null
          return (
            <Card
              key={i}
              icon={GraduationCap}
              testId={`tutorial:${b.arg}`}
              title={t('Tutorial: {nombre}', { nombre: t(tut.title) })}
              text={b.text || t(tut.description)}
              action={t('Hacer el tutorial')}
              onClick={() => ctx.onTutorial?.(b.arg)}
            />
          )
        }
        if (b.type === 'fence')
          return (
            <pre key={i} className="overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-[0.9em] text-slate-100">
              {b.text}
            </pre>
          )
        return (
          <p key={i}>
            <Inline text={b.text} ctx={ctx} />
          </p>
        )
      })}
    </div>
  )
}
