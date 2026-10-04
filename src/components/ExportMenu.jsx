import { N_ } from '../lib/i18n'
import { Download, FileCode, FileText, Image, BookText, Link2 } from 'lucide-react'
import ToolbarDropdown from './ToolbarDropdown'

// Botón "Exportar" con los formatos: cada uno abre el diálogo de exportación con vista previa.
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
        { id: 'svg', label: N_('SVG'), hint: N_('Vectorial: se amplía sin perder calidad'), icon: FileCode, onSelect: () => onExport('svg') },
        { id: 'pdf', label: N_('PDF'), hint: N_('Para imprimir: tamaño, orientación y páginas'), icon: FileText, onSelect: () => onExport('pdf') },
        { id: 'dossier', label: N_('Dossier de la práctica'), hint: N_('Documento para entregar: portada, enunciado, grafcet, variables, ladder, planta y cronograma'), icon: BookText, onSelect: () => onExport('dossier') },
        { id: 'share', label: N_('Compartir por enlace'), hint: N_('Enlace y código QR para abrir el proyecto en otro equipo'), icon: Link2, onSelect: () => onExport('share') },
      ]}
    />
  )
}
