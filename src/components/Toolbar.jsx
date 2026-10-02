import {
  Square,
  SquareStack,
  Minus,
  RectangleHorizontal,
  Image,
  FileCode,
  Trash2,
  Save,
  FolderOpen,
  Undo2,
  Redo2,
  Settings,
  ShieldCheck,
  CircleHelp,
  Table2,
  FileText,
} from 'lucide-react'

function ToolButton({ icon: Icon, label, onClick, disabled, title, active, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={active}
      className={`relative flex shrink-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? 'bg-slate-100' : ''
      }`}
    >
      <Icon size={18} />
      <span className="hidden xl:inline">{label}</span>
      {badge}
    </button>
  )
}

const Separator = () => <div className="mx-1 h-6 w-px shrink-0 bg-slate-200" />

// Contador del botón Verificar: rojo con errores, ámbar con solo avisos, verde si es conforme.
function VerifyBadge({ errors, warnings }) {
  const count = errors || warnings
  const color = errors ? 'bg-red-600' : warnings ? 'bg-amber-500' : 'bg-green-600'
  return (
    <span
      className={`absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ${color}`}
    >
      {count || '✓'}
    </span>
  )
}

export default function Toolbar({
  onAdd,
  onAddAction,
  canAddAction,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  onSave,
  onOpen,
  onClear,
  onOpenSettings,
  onToggleVerify,
  verifyOpen,
  issueCounts,
  onHelp,
  onOpenVariables,
}) {
  return (
    <header className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      <h1 className="mr-3 shrink-0 text-base font-bold tracking-tight">Grafcet Editor</h1>

      <ToolButton icon={Undo2} label="Deshacer" title="Deshacer (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
      <ToolButton icon={Redo2} label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} />

      <Separator />

      <ToolButton icon={SquareStack} label="Etapa inicial" onClick={() => onAdd('step', { initial: true })} />
      <ToolButton icon={Square} label="Etapa" onClick={() => onAdd('step')} />
      <ToolButton icon={Minus} label="Transición" onClick={() => onAdd('transition')} />
      <ToolButton
        icon={RectangleHorizontal}
        label="Acción"
        onClick={onAddAction}
        disabled={!canAddAction}
        title={canAddAction ? 'Añadir acción a la etapa seleccionada' : 'Selecciona una etapa para añadirle una acción'}
      />

      <Separator />

      <ToolButton icon={Save} label="Guardar" title="Guardar proyecto .json (Ctrl+S)" onClick={onSave} />
      <ToolButton icon={FolderOpen} label="Abrir" title="Abrir proyecto .json (Ctrl+O)" onClick={onOpen} />

      <Separator />

      <ToolButton icon={Image} label="PNG" title="Exportar imagen PNG" onClick={() => onExport('png')} />
      <ToolButton icon={FileCode} label="SVG" title="Exportar imagen SVG" onClick={() => onExport('svg')} />
      <ToolButton icon={FileText} label="PDF" title="Exportar PDF (A4 o A3 según el tamaño)" onClick={() => onExport('pdf')} />

      <Separator />

      <ToolButton
        icon={Table2}
        label="Variables"
        title="Tabla de variables: direcciones de PLC de etapas, entradas y salidas"
        onClick={onOpenVariables}
      />
      <ToolButton
        icon={ShieldCheck}
        label="Verificar"
        title="Verificar conformidad con IEC 60848"
        onClick={onToggleVerify}
        active={verifyOpen}
        badge={<VerifyBadge {...issueCounts} />}
      />

      <div className="ml-auto" />
      <ToolButton icon={Trash2} label="Limpiar" title="Vaciar el lienzo (se puede deshacer)" onClick={onClear} />
      <ToolButton icon={Settings} label="Opciones" title="Opciones de letra y tamaño" onClick={onOpenSettings} />
      <ToolButton icon={CircleHelp} label="Ayuda" title="Atajos y notación (?)" onClick={onHelp} />
    </header>
  )
}
