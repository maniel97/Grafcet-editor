// Vista previa de una página del dossier (lib/dossier.js) en SVG, en mm: los mismos elementos
// que el PDF (lib/dossierPdf.js).
const PT = 0.3528
const rgb = (c = [15, 23, 42]) => `rgb(${c.join(',')})`
const FONTS = { helvetica: 'Helvetica, Arial, sans-serif', courier: '"Courier New", Courier, monospace' }

export default function DossierPreview({ page, width, label }) {
  return (
    <svg
      viewBox={`0 0 ${page.w} ${page.h}`}
      width={width}
      height={(width * page.h) / page.w}
      role="img"
      aria-label={label}
      className="block bg-white shadow"
    >
      <rect width={page.w} height={page.h} fill="white" />
      {page.items.map((it, i) => {
        if (it.t === 'text') {
          return (
            <text
              key={i}
              x={it.x}
              y={it.y}
              fontSize={it.size * PT}
              fontWeight={it.style === 'bold' ? 700 : 400}
              fontFamily={FONTS[it.font] ?? FONTS.helvetica}
              fill={rgb(it.color)}
              textAnchor={it.align === 'center' ? 'middle' : it.align === 'right' ? 'end' : 'start'}
              xmlSpace="preserve"
            >
              {it.text}
            </text>
          )
        }
        if (it.t === 'line') {
          return <line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={rgb(it.color)} strokeWidth={it.width ?? 0.2} strokeDasharray={it.dash ? '0.6 0.8' : undefined} />
        }
        if (it.t === 'rect') {
          return <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} fill={it.fill ? rgb(it.fill) : 'none'} stroke={it.stroke ? rgb(it.stroke) : 'none'} strokeWidth="0.2" />
        }
        if (it.t === 'figure') {
          // Franja [top, bottom] de la figura (el SVG interior recorta).
          return (
            <svg key={i} x={it.x} y={it.y} width={it.w} height={it.h} viewBox={`0 ${it.top} ${it.figure.width} ${it.bottom - it.top}`} preserveAspectRatio="none">
              <image href={it.figure.dataUrl} x="0" y="0" width={it.figure.width} height={it.figure.height} />
            </svg>
          )
        }
        return null
      })}
    </svg>
  )
}
