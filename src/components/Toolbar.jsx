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
  Play,
  CircleStop,
} from 'lucide-react'

// `primary`: el texto se ve desde pantallas medianas; el resto solo en pantallas anchas (2xl),
// para que la barra quepa entera. El nombre siempre está en el tooltip.
function ToolButton({ icon: Icon, label, onClick, disabled, title, active, badge, primary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-pressed={active}
      className={`relative flex shrink-0 items-center gap-2 rounded-md py-2 pl-2.5 text-sm text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? 'bg-slate-100' : ''
      } ${badge ? 'pr-5' : 'pr-2.5'}`}
    >
      <Icon size={18} />
      <span className={`hidden ${primary ? 'lg:inline' : '2xl:inline'}`}>{label}</span>
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
  simulating,
  onToggleSimulation,
}) {
  // Durante la simulación se bloquea todo lo que modifica el diagrama.
  const locked = simulating
  return (
    <header className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 shadow-sm">
      <h1 className="mr-3 shrink-0 text-base font-bold tracking-tight">Grafcet Editor</h1>

      <ToolButton icon={Undo2} label="Deshacer" title="Deshacer (Ctrl+Z)" onClick={onUndo} disabled={locked || !canUndo} />
      <ToolButton icon={Redo2} label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" onClick={onRedo} disabled={locked || !canRedo} />

      <Separator />

      <ToolButton icon={SquareStack} label="Etapa inicial" disabled={locked} onClick={() => onAdd('step', { initial: true })} />
      <ToolButton icon={Square} label="Etapa" disabled={locked} onClick={() => onAdd('step')} />
      <ToolButton icon={Minus} label="Transición" disabled={locked} onClick={() => onAdd('transition')} />
      <ToolButton
        icon={RectangleHorizontal}
        label="Acción"
        onClick={onAddAction}
        disabled={locked || !canAddAction}
        title={canAddAction ? 'Añadir acción a la etapa seleccionada' : 'Selecciona una etapa para añadirle una acción'}
      />

      <Separator />

      <ToolButton icon={Save} label="Guardar" title="Guardar proyecto .json (Ctrl+S)" onClick={onSave} />
      <ToolButton icon={FolderOpen} label="Abrir" title="Abrir proyecto .json (Ctrl+O)" onClick={onOpen} disabled={locked} />

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
        icon={simulating ? CircleStop : Play}
        label={simulating ? 'Detener' : 'Simular'}
        title={simulating ? 'Detener la simulación y volver a editar' : 'Simular el grafcet (IEC 60848)'}
        onClick={onToggleSimulation}
        active={simulating}
        primary
      />
      <ToolButton
        icon={ShieldCheck}
        disabled={locked}
        label="Verificar"
        title="Verificar conformidad con IEC 60848"
        onClick={onToggleVerify}
        active={verifyOpen}
        primary
        badge={<VerifyBadge {...issueCounts} />}
      />

      <div className="ml-auto" />
      <ToolButton icon={Trash2} label="Limpiar" title="Vaciar el lienzo (se puede deshacer)" onClick={onClear} disabled={locked} />
      <ToolButton icon={Settings} label="Opciones" title="Opciones de letra y tamaño" onClick={onOpenSettings} />
      <ToolButton icon={CircleHelp} label="Ayuda" title="Atajos y notación (?)" onClick={onHelp} />
    </header>
  )
}
