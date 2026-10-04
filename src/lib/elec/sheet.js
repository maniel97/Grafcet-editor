// El esquema eléctrico como plano: hojas, marco con columnas numeradas y referencias cruzadas con
// hoja y columna (/2.4 = hoja 2, columna 4), como en los planos de máquina (IEC 61082-1).
//
// plc.electrical.sheets = [{ id, name }]; cada componente lleva `sheet` (sin él, la primera hoja).
// plc.electrical.frame: true para dibujar el marco; frameCols: número de columnas.
import { sizeOf } from './catalog'
import { t } from '../i18n'

export const FIRST_ELEC_SHEET = { id: 'e1', name: t('Hoja 1') }
export const COLUMN_WIDTH = 160
export const FRAME_HEIGHT = 1040
export const FRAME_TOP = 60 // franja de los números de columna, encima del dibujo (y < 0)
export const TITLE_BLOCK = { w: 420, h: 72 }

export const elecSheetsOf = (sch) => (sch?.sheets?.length ? sch.sheets : [FIRST_ELEC_SHEET])
export const sheetOfComponent = (sch, c) => c.sheet ?? elecSheetsOf(sch)[0].id
export const frameColumns = (sch) => Math.max(4, Math.min(20, Number(sch?.frameCols) || 10))
export const frameSize = (sch) => ({ w: frameColumns(sch) * COLUMN_WIDTH, h: FRAME_HEIGHT })

// Hoja (1, 2…) y columna (1, 2…) de un componente: por el centro de su dibujo.
export function locate(sch, c) {
  const sheets = elecSheetsOf(sch)
  const index = Math.max(0, sheets.findIndex((s) => s.id === sheetOfComponent(sch, c)))
  const { w } = sizeOf(c)
  const col = Math.min(frameColumns(sch), Math.max(1, Math.floor((c.x + w / 2) / COLUMN_WIDTH) + 1))
  return { sheet: index + 1, col, label: `/${index + 1}.${col}` }
}

// Referencias cruzadas: para cada aparato (por su identificador), sus contactos con su número y
// su sitio; y para cada contacto, el sitio de su aparato.
export function crossReferenceMap(sch, numbers) {
  const comps = sch?.components ?? []
  const owners = new Map(comps.filter((c) => c.tag && !['contact', 'maincontacts', 'terminal', 'rail'].includes(c.type)).map((c) => [c.tag, c]))
  const byTag = {}
  const ownerOf = {}
  for (const c of comps) {
    if (c.type !== 'contact' && c.type !== 'maincontacts') continue
    if (!c.ref) continue
    const where = locate(sch, c).label
    const item = c.type === 'maincontacts' ? { kind: 'principal', numbers: ['1', '6'], where } : { kind: c.contact === 'NC' ? 'NC' : 'NA', numbers: numbers[c.id] ?? [], where }
    ;(byTag[c.ref] ??= []).push(item)
    const owner = owners.get(c.ref)
    if (owner) ownerOf[c.id] = locate(sch, owner).label
  }
  return { byTag, ownerOf }
}
