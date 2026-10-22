import { N_ } from '../lib/i18n'
import { Download, FileText, Image, BookText, LayoutGrid } from 'lucide-react'
import ToolbarDropdown from './ToolbarDropdown'

// Botón "Exportar" con los formatos de diario (PNG, PDF y dossier); el resto va en «Más
// formatos…» (MoreExportsDialog), para que el menú quede corto.
export default function ExportMenu({ onExport, labelClass }) {
  return (
    <ToolbarDropdown
      icon={Download}
      label={N_('Exportar')}
      title={N_('Exportar el diagrama (PNG, SVG, PDF)')}
      menuLabel={N_('Formatos de exportación')}
      labelClass={labelClass}
      items={[
        { id: 'png', label: N_('PNG'), hint: N_('Imagen para documentos y webs'), icon: Image, onSelect: () => onExport('png') },
        { id: 'pdf', label: N_('PDF'), hint: N_('Para imprimir: tamaño, orientación y páginas'), icon: FileText, onSelect: () => onExport('pdf') },
        { id: 'dossier', label: N_('Dossier de la práctica'), hint: N_('Documento para entregar: portada, enunciado, grafcet, variables, ladder, planta y cronograma'), icon: BookText, onSelect: () => onExport('dossier') },
        { id: 'sep', separator: true },
        { id: 'more', label: N_('Más formatos…'), hint: N_('SVG, entregas, PC_SIMU, enlace y más'), icon: LayoutGrid, onSelect: () => onExport('more') },
      ]}
    />
  )
}
