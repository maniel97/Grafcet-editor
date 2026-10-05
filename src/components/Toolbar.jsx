import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import InitialStepIcon from './InitialStepIcon'
import ExportMenu from './ExportMenu'
import ToolbarDropdown from './ToolbarDropdown'
import Logo from './Logo'
import { t, N_ } from '../lib/i18n'
import {
  GraduationCap,
  Square,
  Minus,
  RectangleHorizontal,
  Trash2,
  Save,
  FolderOpen,
  Undo2,
  Redo2,
  Settings,
  ShieldCheck,
  CircleHelp,
  Table2,
  Play,
  CircleStop,
  Cpu,
  StickyNote,
  FileJson,
  BookOpen,
  History,
  Workflow,
  Wind,
  Search,
  FilePlus,
  Zap,
} from 'lucide-react'

// Nombres de los botones: la barra se mide a sí misma (useToolbarLabels) y, si no cabe, quita
// primero los secundarios y después todos; vuelve a intentarlo al cambiar el ancho. `primary`:
// de los que más aguantan. `iconOnly`: nunca muestra texto. El nombre siempre está en el
// tooltip y en aria-label (lectores de pantalla).
const labelClass = (primary) => `tb-label ${primary ? 'tb-primary' : 'tb-secondary'}`

// 'all' | 'primary' | 'none': los nombres que caben sin barra de desplazamiento.
function useToolbarLabels(ref) {
  const [labels, setLabels] = useState('all')
  // Antes de pintar: si se desborda, un paso menos (hasta que quepa o solo queden iconos).
  useLayoutEffect(() => {
    const el = ref.current
    if (el && labels !== 'none' && el.scrollWidth > el.clientWidth + 1) setLabels(labels === 'all' ? 'primary' : 'none')
  })
  // Al cambiar el ancho (ventana, escalado), se vuelve a probar desde todos los nombres.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return
      width = el.clientWidth
      setLabels('all')
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return labels
}

// tour: ancla de la visita guiada (data-tour); por defecto, el nombre interno del botón.
function ToolButton({ icon: Icon, label, onClick, disabled, title, active, badge, primary, iconOnly, tour }) {
  return (
    <button
      type="button"
      data-tour={tour ?? label}
      onClick={onClick}
      disabled={disabled}
      title={t(title ?? label)}
      aria-label={iconOnly ? t(label) : undefined}
      aria-pressed={active}
      className={`relative flex shrink-0 items-center gap-2 rounded-md py-2 pl-2.5 text-sm text-slate-700 hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? 'bg-slate-100' : ''
      } ${badge ? 'pr-5' : 'pr-2.5'}`}
    >
      <Icon size={18} />
      {!iconOnly && <span className={labelClass(primary)}>{t(label)}</span>}
      {badge}
    </button>
  )
}

const Separator = () => <div className="tb-sep mx-1 h-6 w-px shrink-0 bg-slate-200" />

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
  projectName,
  onRenameProject,
  onAdd,
  onAddAction,
  canAddAction,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  historyUnlocked = false, // deshacer / rehacer disponibles aunque se esté simulando (escena)
  onExport,
  onSave,
  onOpen,
  onOpenExamples,
  onOpenRecent,
  onOpenExercises,
  exerciseShown = false,
  exerciseOpen = false,
  onToggleExercise,
  onOpenPneumatic,
  onClear,
  onOpenSettings,
  onToggleVerify,
  onSearch,
  onNew,
  electricalOpen,
  onToggleElectrical,
  verifyOpen,
  issueCounts,
  onHelp,
  onOpenVariables,
  simulating,
  readOnly,
  onToggleSimulation,
  onOpenLadder,
  onOpenGemma,
}) {
  // En solo lectura (simulando o con la edición bloqueada) se desactiva lo que modifica el diagrama.
  const locked = readOnly
  const headerRef = useRef(null)
  const labels = useToolbarLabels(headerRef)
  return (
    <header
      ref={headerRef}
      data-labels={labels}
      className="toolbar flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 shadow-sm"
    >
      {/* El logo, siempre; el nombre de la aplicación, como un nombre secundario (si cabe). */}
      <h1 className="mr-2 flex shrink-0 items-center gap-2 text-base font-bold tracking-tight" title={t('Grafcet Editor')}>
        <Logo size={24} className="text-slate-900" />
        <span className="tb-label tb-secondary">{t('Grafcet Editor')}</span>
      </h1>
      {/* Nombre del proyecto: da nombre a los archivos guardados y exportados. */}
      <input
        value={projectName}
        onChange={(e) => onRenameProject(e.target.value)}
        placeholder={t('Sin título')}
        aria-label={t('Nombre del proyecto')}
        title={t('Nombre del proyecto (se usa al guardar y exportar)')}
        className="mr-2 w-20 shrink-0 rounded-md border border-transparent px-2 py-1 text-sm text-slate-700 placeholder:italic placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:outline-none 2xl:w-44"
      />

      <ToolButton icon={Undo2} label={N_('Deshacer')} title={N_('Deshacer (Ctrl+Z)')} onClick={onUndo} disabled={(locked && !historyUnlocked) || !canUndo} iconOnly />
      <ToolButton icon={Redo2} label={N_('Rehacer')} title={N_('Rehacer (Ctrl+Shift+Z)')} onClick={onRedo} disabled={(locked && !historyUnlocked) || !canRedo} iconOnly />

      <Separator />

      <ToolButton icon={InitialStepIcon} label={N_('Etapa inicial')} disabled={locked} onClick={() => onAdd('step', { initial: true })} />
      <ToolButton icon={Square} label={N_('Etapa')} disabled={locked} onClick={() => onAdd('step')} />
      <ToolButton icon={Minus} label={N_('Transición')} disabled={locked} onClick={() => onAdd('transition')} />
      <ToolButton
        icon={RectangleHorizontal}
        label={N_('Acción')}
        onClick={onAddAction}
        disabled={locked || !canAddAction}
        title={canAddAction ? N_('Añadir acción a la etapa seleccionada') : N_('Selecciona una etapa para añadirle una acción')}
      />
      <ToolButton icon={StickyNote} label={N_('Nota')} title={N_('Añadir una nota de texto')} disabled={locked} onClick={() => onAdd('note')} />

      <Separator />

      <ToolButton icon={Save} label={N_('Guardar')} title={N_('Guardar proyecto .json (Ctrl+S)')} onClick={onSave} />
      <ToolbarDropdown
        icon={FolderOpen}
        label={N_('Abrir')}
        title={N_('Abrir un proyecto, un ejemplo o un trabajo anterior')}
        menuLabel={N_('Abrir')}
        labelClass={labelClass(false)}
        disabled={locked}
        items={[
          { id: 'new', label: N_('Nuevo'), hint: N_('Proyecto en blanco: título, autómata y tabla de variables'), icon: FilePlus, onSelect: onNew },
          { id: 'file', label: N_('Abrir archivo'), hint: N_('Proyecto .json guardado (Ctrl+O)'), icon: FileJson, onSelect: onOpen },
          { id: 'examples', label: N_('Ejemplos'), hint: N_('Grafcets típicos listos para usar'), icon: BookOpen, onSelect: onOpenExamples },
          { id: 'exercises', label: N_('Ejercicios'), hint: N_('Ejercicios con autocorrección, por niveles'), icon: GraduationCap, onSelect: onOpenExercises },
          { id: 'recent', label: N_('Trabajos anteriores'), hint: N_('Recuperar lo que había antes de abrir o limpiar'), icon: History, onSelect: onOpenRecent },
          { id: 'pneumatic', label: N_('Secuencia neumática'), hint: N_('Crear el grafcet y la planta de una secuencia como A+ B+ B− A−'), icon: Wind, onSelect: onOpenPneumatic },
        ]}
      />

      <Separator />

      <ExportMenu onExport={onExport} labelClass={labelClass(true)} />

      <Separator />

      <ToolButton
        icon={Table2}
        label={N_('Variables')}
        title={N_('Tabla de variables: direcciones de PLC de etapas, entradas y salidas')}
        onClick={onOpenVariables}
      />
      <ToolButton
        icon={simulating ? CircleStop : Play}
        tour="Simular"
        label={simulating ? N_('Detener') : N_('Simular')}
        title={simulating ? N_('Detener la simulación y volver a editar') : N_('Simular el grafcet (IEC 60848)')}
        onClick={onToggleSimulation}
        active={simulating}
        primary
      />
      <ToolButton
        icon={Cpu}
        label={N_('Ladder')}
        title={N_('Paso a ladder (LD), texto estructurado y AWL')}
        onClick={onOpenLadder}
        primary
      />
      <ToolButton
        icon={Zap}
        label={N_('Esquema eléctrico')}
        title={N_('Esquema eléctrico: mando, potencia y conexiones del autómata (simulable)')}
        onClick={onToggleElectrical}
        active={electricalOpen}
        iconOnly
      />
      <ToolButton icon={Workflow} label={N_('GEMMA')} title={N_('Asistente GEMMA: modos de marcha y parada (grafcet de conducción)')} disabled={locked} onClick={onOpenGemma} />
      <ToolButton
        icon={ShieldCheck}
        disabled={locked}
        label={N_('Verificar')}
        title={N_('Verificar conformidad con IEC 60848')}
        onClick={onToggleVerify}
        active={verifyOpen}
        primary
        badge={<VerifyBadge {...issueCounts} />}
      />
      {exerciseShown && (
        <ToolButton icon={GraduationCap} label={N_('Ejercicio')} title={N_('Enunciado y «Comprobar»')} onClick={onToggleExercise} active={exerciseOpen} primary />
      )}
      <ToolButton icon={Search} label={N_('Buscar')} title={N_('Buscar en el diagrama: etapas, receptividades, acciones y notas (Ctrl+F)')} onClick={onSearch} iconOnly />

      <div className="ml-auto" />
      <ToolButton icon={Trash2} label={N_('Limpiar')} title={N_('Vaciar el lienzo (se puede deshacer)')} onClick={onClear} disabled={locked} />
      <ToolButton icon={Settings} label={N_('Opciones')} title={N_('Opciones: tema, letra y tamaño')} onClick={onOpenSettings} />
      <ToolButton icon={CircleHelp} label={N_('Ayuda')} title={N_('Atajos y notación (?)')} onClick={onHelp} />
    </header>
  )
}
