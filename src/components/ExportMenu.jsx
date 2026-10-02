import { Download, FileCode, FileText, Image } from 'lucide-react'
import ToolbarDropdown from './ToolbarDropdown'

// Botón "Exportar" con los formatos: cada uno abre el diálogo de exportación con vista previa.
export default function ExportMenu({ onExport, labelClass }) {
  return (
    <ToolbarDropdown
      icon={Download}
      label="Exportar"
      title="Exportar el diagrama (PNG, SVG, PDF)"
      menuLabel="Formatos de exportación"
      labelClass={labelClass}
      items={[
        { id: 'png', label: 'PNG…', hint: 'Imagen para documentos y webs', icon: Image, onSelect: () => onExport('png') },
        { id: 'svg', label: 'SVG…', hint: 'Vectorial: se amplía sin perder calidad', icon: FileCode, onSelect: () => onExport('svg') },
        { id: 'pdf', label: 'PDF…', hint: 'Para imprimir: tamaño, orientación y páginas', icon: FileText, onSelect: () => onExport('pdf') },
      ]}
    />
  )
}
