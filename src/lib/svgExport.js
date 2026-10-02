// Exportación de dibujos SVG (ladder, cronograma) a PNG, SVG y PDF, en el navegador.
// svgSource() da lo que necesita el diálogo de exportación (components/ExportDialog.jsx):
// - capture(): imagen para la vista previa y el PDF de imagen, escena vectorial y, si los hay,
//   bloques que no se cortan entre páginas (data-block-top / data-block-bottom /
//   data-keep-with-next): con ellos el PDF se reparte en páginas; sin ellos (cronograma) cabe en una.
// - save(format, options): descarga el PNG (a la resolución elegida) o el SVG.

import { downloadFile } from './projectFile'
import { download } from './exportImage'
import { captureSvgScene } from './vectorPdf'

// Límite de tamaño del lienzo de los navegadores: por encima, se reduce la resolución.
const MAX_CANVAS_SIDE = 12000

export function svgText(svg) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`
}

const sizeOf = (svg) => ({ width: Number(svg.getAttribute('width')), height: Number(svg.getAttribute('height')) })

// Rasteriza el SVG (fondo blanco) a `scale` aumentos, sin pasar del límite del navegador.
export async function rasterize(text, width, height, scale) {
  const factor = Math.min(scale, MAX_CANVAS_SIDE / Math.max(width, height))
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * factor)
    canvas.height = Math.round(height * factor)
    const g = canvas.getContext('2d')
    g.fillStyle = 'white'
    g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// getSvg(): el elemento <svg> a exportar (en el documento, para poder medir su texto).
// name(ext): nombre del archivo.
export function svgSource(getSvg, { kind, title, name }) {
  return {
    kind,
    title,
    async capture() {
      const svg = getSvg()
      if (!svg) return null
      const { width, height } = sizeOf(svg)
      const blocks = [...svg.querySelectorAll('[data-block-top]')].map((g) => ({
        top: Number(g.dataset.blockTop),
        bottom: Number(g.dataset.blockBottom),
        keep: g.dataset.keepWithNext === '1',
      }))
      const text = svgText(svg)
      return { dataUrl: await rasterize(text, width, height, 3), width, height, scene: captureSvgScene(svg), blocks: blocks.length ? blocks : undefined }
    },
    async save(format, options) {
      const svg = getSvg()
      const { width, height } = sizeOf(svg)
      if (format === 'svg') downloadFile(svgText(svg), name('svg'), 'image/svg+xml')
      else download(await rasterize(svgText(svg), width, height, options.pngScale ?? 2), name('png'))
    },
  }
}

// Igual que svgSource, para un SVG que no está en pantalla (p. ej. el cronograma completo):
// getMarkup() da su código y se monta oculto en el documento mientras se mide y se exporta.
export function svgMarkupSource(getMarkup, options) {
  const withMounted = async (fn) => {
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none'
    host.innerHTML = await getMarkup()
    document.body.appendChild(host)
    try {
      return await fn(host.querySelector('svg'))
    } finally {
      host.remove()
    }
  }
  return {
    kind: options.kind,
    title: options.title,
    capture: () => withMounted((svg) => svgSource(() => svg, options).capture()),
    save: (format, opts) => withMounted((svg) => svgSource(() => svg, options).save(format, opts)),
  }
}
