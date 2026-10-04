// Cajetín del PDF (opcional): datos del plano en la esquina inferior derecha de cada página.
// La misma descripción (celdas en mm) la usan la vista previa (components/ExportDialog.jsx) y el
// PDF (lib/exportImage.js), así que lo que se ve es lo que sale.
// Los datos se guardan en el proyecto (plc.titleBlock); la hoja «i de n» se calcula sola.
import { N_, t } from './i18n'

export const TITLE_BLOCK = { width: 120, height: 22, gap: 3 } // mm (gap: separación con el dibujo)

export const TITLE_BLOCK_FIELDS = [
  { id: 'company', label: N_('Empresa / centro') },
  { id: 'project', label: N_('Proyecto') },
  { id: 'author', label: N_('Autor') },
  { id: 'revision', label: N_('Revisión') },
  { id: 'date', label: N_('Fecha') },
  { id: 'drawing', label: N_('Nº de plano') },
]

// Valores efectivos: proyecto = nombre del proyecto y fecha = hoy si se dejan vacíos.
export function titleBlockValues(data = {}, { projectName = '', today = '', page = 1, pages = 1 } = {}) {
  return {
    company: data.company?.trim() ?? '',
    project: data.project?.trim() || projectName.trim(),
    author: data.author?.trim() ?? '',
    revision: data.revision?.trim() ?? '',
    date: data.date?.trim() || today,
    drawing: data.drawing?.trim() ?? '',
    sheet: `${page} de ${pages}`,
  }
}

// Celdas en mm, relativas a la esquina superior izquierda del cajetín.
//  | Empresa / centro (70)                 | Proyecto (50)            |
//  | Autor (35) | Rev. (15) | Fecha (25) | Nº de plano (25) | Hoja (20) |
export function titleBlockCells(values) {
  const h = TITLE_BLOCK.height / 2
  return [
    { x: 0, y: 0, w: 70, h, label: t('Empresa / centro'), value: values.company, strong: true },
    { x: 70, y: 0, w: 50, h, label: t('Proyecto'), value: values.project, strong: true },
    { x: 0, y: h, w: 35, h, label: t('Autor'), value: values.author },
    { x: 35, y: h, w: 15, h, label: t('Rev.'), value: values.revision },
    { x: 50, y: h, w: 25, h, label: t('Fecha'), value: values.date },
    { x: 75, y: h, w: 25, h, label: t('Nº de plano'), value: values.drawing },
    { x: 100, y: h, w: 20, h, label: t('Hoja'), value: values.sheet },
  ]
}

// Posición del cajetín en la página (mm).
export const titleBlockOrigin = (pageW, pageH, margin) => ({ x: pageW - margin - TITLE_BLOCK.width, y: pageH - margin - TITLE_BLOCK.height })
