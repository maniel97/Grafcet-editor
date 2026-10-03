import InitialStepIcon from './InitialStepIcon'
import { useReactFlow } from '@xyflow/react'
import {
  Cpu,
  CornerLeftUp,
  Equal,
  EyeOff,
  Maximize2,
  Table2,
  WandSparkles,
  Merge,
  StickyNote,
  AlignVerticalSpaceAround,
  AlignHorizontalJustifyCenter,
  Pencil,
  Plus,
  RectangleHorizontal,
  Rows3,
  Split,
  Square,
  Minus,
  Trash2,
  SquareDashed,
  Group,
  Scissors,
  MoveHorizontal,
} from 'lucide-react'
import ContextMenu from './ContextMenu'
import { useQuickConnect } from '../lib/useQuickConnect'
import { useStructureActions } from '../lib/useStructureActions'
import { useEditor } from '../lib/editorContext'
import { transitionOutput } from '../lib/grafcetRules'
import { VARIABLES_TABLE_ID } from '../nodes'
import { VARIABLE_TYPES } from '../lib/addressing'
import { NOTE_COLORS } from '../lib/notes'
import { FRAME_KINDS } from '../lib/frames'

// Menú contextual del lienzo: las opciones dependen de lo que se pulse con el botón derecho.
// menu: { x, y, kind: 'node' | 'selection' | 'pane', nodeIds, flowPosition }
export default function GrafcetContextMenu({ menu, onClose, onEdit, onAddNodeAt, onFrameAround, sheets = [], onMoveToSheet, onShowInLadder }) {
  const { getNode, getEdges, updateNodeData, setEdges, deleteElements } = useReactFlow()
  const quickConnect = useQuickConnect()
  const { arrange, spread, addBranch, predecessorsOf, addAlternative, converge, toggleInitial, toggleMacro, addAction, remove } =
    useStructureActions()
  const { startLoop, plcTable, toggleTable, setEditingNoteId, takeSnapshot } = useEditor()

  let title
  let items = []

  // Solo lectura (simulando o bloqueado): únicamente consultar el ladder.
  if (menu.kind === 'readonly') {
    const node = getNode(menu.nodeIds[0])
    if (!node) return null
    title = node.type === 'step' ? `Etapa ${node.data.label}` : 'Transición'
    items = [{ label: 'Ver en el ladder', icon: Cpu, onSelect: () => onShowInLadder(node.id) }]
    return <ContextMenu x={menu.x} y={menu.y} title={title} items={items} onClose={onClose} />
  }

  if (menu.kind === 'edge') {
    const edge = getEdges().find((e) => e.id === menu.edgeId)
    if (!edge) return null
    const cut = !!edge.data?.reference
    title = 'Enlace'
    items = [
      {
        label: cut ? 'Unir (quitar referencias)' : 'Cortar con referencias',
        hint: cut ? undefined : 'enlaces largos',
        icon: Scissors,
        onSelect: () => {
          takeSnapshot()
          setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, data: { ...e.data, reference: !cut } } : e)))
        },
      },
      'separator',
      { label: 'Eliminar enlace', icon: Trash2, danger: true, onSelect: () => deleteElements({ edges: [{ id: edge.id }] }) },
    ]
  } else if (menu.kind === 'pane') {
    const at = menu.flowPosition
    title = 'Lienzo'
    items = [
      { label: 'Etapa inicial aquí', icon: InitialStepIcon, onSelect: () => onAddNodeAt('step', { initial: true }, at) },
      { label: 'Etapa aquí', icon: Square, onSelect: () => onAddNodeAt('step', {}, at) },
      { label: 'Transición aquí', icon: Minus, onSelect: () => onAddNodeAt('transition', {}, at) },
      { label: 'Nota aquí', icon: StickyNote, onSelect: () => onAddNodeAt('note', {}, at) },
      'separator',
      { label: 'Marco de grafcet parcial aquí', hint: 'G1', icon: SquareDashed, onSelect: () => onAddNodeAt('frame', { kind: 'grafcet' }, at) },
      { label: 'Marco de expansión aquí', hint: 'M1', icon: SquareDashed, onSelect: () => onAddNodeAt('frame', { kind: 'macro' }, at) },
      'separator',
      { label: 'Separar columnas', hint: 'que los textos no se pisen', icon: MoveHorizontal, onSelect: () => spread() },
      ...(plcTable && !getNode(VARIABLES_TABLE_ID)
        ? ['separator', { label: 'Tabla de variables aquí', icon: Table2, onSelect: () => toggleTable(at) }]
        : []),
    ]
  } else if (menu.kind === 'selection') {
    const nodes = menu.nodeIds.map(getNode).filter(Boolean)
    const steps = nodes.filter((n) => n.type === 'step')
    const transitions = nodes.filter((n) => n.type === 'transition')
    title = `${nodes.length} elementos`
    if (steps.length >= 2)
      items.push({
        label: `Converger ${steps.length} etapas en Y`,
        hint: 'sincronizar',
        icon: Merge,
        onSelect: () => converge(steps.map((n) => n.id), 'step'),
      })
    if (transitions.length >= 2)
      items.push({
        label: `Converger ${transitions.length} transiciones en O`,
        icon: Merge,
        onSelect: () => converge(transitions.map((n) => n.id), 'transition'),
      })
    if (steps.length + transitions.length >= 2) {
      if (items.length) items.push('separator')
      items.push(
        { label: 'Alinear en columna', icon: AlignHorizontalJustifyCenter, onSelect: () => arrange(menu.nodeIds, 'column') },
        { label: 'Espaciar la secuencia', hint: 'distancia estándar', icon: AlignVerticalSpaceAround, onSelect: () => arrange(menu.nodeIds, 'space') },
        { label: 'Separar columnas', hint: 'que los textos no se pisen', icon: MoveHorizontal, onSelect: () => spread(menu.nodeIds) },
      )
    }
    if (steps.length + transitions.length >= 1) {
      if (items.length) items.push('separator')
      items.push(
        { label: 'Encerrar en un grafcet parcial', hint: 'G…', icon: Group, onSelect: () => onFrameAround(menu.nodeIds, 'grafcet') },
        { label: 'Encerrar como expansión de macroetapa', hint: 'M…', icon: Group, onSelect: () => onFrameAround(menu.nodeIds, 'macro') },
      )
    }
    if (sheets.length) {
      if (items.length) items.push('separator')
      for (const s of sheets) items.push({ label: `Mover a ${s.name}`, icon: Rows3, onSelect: () => onMoveToSheet(menu.nodeIds, s.id) })
    }
    if (items.length) items.push('separator')
    items.push({ label: 'Eliminar selección', icon: Trash2, danger: true, onSelect: () => remove(menu.nodeIds) })
  } else {
    const node = getNode(menu.nodeIds[0])
    if (!node) return null
    if (node.type === 'note') {
      return (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title="Nota"
          onClose={onClose}
          items={[
            { label: 'Editar texto', icon: Pencil, onSelect: () => setEditingNoteId(node.id) },
            'separator',
            ...Object.entries(NOTE_COLORS).map(([id, c]) => ({
              label: `Color ${c.label.toLowerCase()}`,
              icon: () => <span className="h-4 w-4 rounded-sm border" style={{ background: c.bg, borderColor: c.border }} />,
              hint: (node.data.color ?? 'yellow') === id ? 'actual' : undefined,
              onSelect: () => {
                takeSnapshot()
                updateNodeData(node.id, { color: id })
              },
            })),
            'separator',
            { label: 'Eliminar', icon: Trash2, danger: true, onSelect: () => remove([node.id]) },
          ]}
        />
      )
    }
    if (node.type === 'frame') {
      const other = node.data.kind === 'macro' ? 'grafcet' : 'macro'
      return (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={`${FRAME_KINDS[node.data.kind]?.label ?? 'Marco'} ${node.data.name}`}
          onClose={onClose}
          items={[
            {
              label: `Convertir en ${FRAME_KINDS[other].label.toLowerCase()}`,
              icon: SquareDashed,
              onSelect: () => {
                takeSnapshot()
                updateNodeData(node.id, { kind: other })
              },
            },
            'separator',
            { label: 'Eliminar el marco', hint: 'deja su contenido', icon: Trash2, danger: true, onSelect: () => remove([node.id]) },
          ]}
        />
      )
    }
    if (node.type === 'variables') {
      return (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title="Tabla de variables"
          onClose={onClose}
          items={[
            // Variables previstas pero aún no usadas en el diagrama (p. ej. una seta de emergencia).
            ...VARIABLE_TYPES.map((t) => ({
              label: `Añadir ${t.label.toLowerCase()}`,
              hint: plcTable.plc.scheme === 'iec' && ['I', 'Q', 'M'].includes(t.area) ? `%${t.area}X` : t.area,
              icon: Plus,
              onSelect: () => plcTable.addVariable(t.id),
            })),
            'separator',
            { label: 'Rellenar direcciones vacías', icon: WandSparkles, onSelect: plcTable.autoFill },
            { label: 'Abrir tabla completa…', icon: Maximize2, onSelect: plcTable.openDialog },
            'separator',
            { label: 'Ocultar del lienzo', icon: EyeOff, onSelect: plcTable.hideTable },
          ]}
        />
      )
    }
    if (node.type === 'step') {
      title = `Etapa ${node.data.label}`
      // Con una transición de salida ya puesta, las alternativas en O se añaden desde la transición.
      const hasTransition = getEdges().some((e) => e.source === node.id)
      items = [
        ...(hasTransition ? [] : [{ label: 'Añadir transición', icon: Plus, onSelect: () => quickConnect(node.id) }]),
        { label: 'Añadir acción', icon: RectangleHorizontal, onSelect: () => addAction(node.id) },
        {
          label: node.data.initial ? 'Quitar etapa inicial' : 'Marcar como inicial',
          icon: InitialStepIcon,
          onSelect: () => toggleInitial(node.id),
        },
        {
          label: node.data.macro ? 'Convertir en etapa normal' : 'Convertir en macroetapa',
          icon: Rows3,
          onSelect: () => toggleMacro(node.id),
        },
      ]
    } else {
      title = 'Transición'
      // Salida actual: null | 'loop' | 'step'. Con bucle no se añaden etapas debajo (se activarían
      // a la vez que la del bucle); con etapas debajo no se añade bucle. Ver lib/grafcetRules.js.
      const output = transitionOutput(node.id, getEdges(), (id) => getNode(id)?.position.y ?? Infinity)
      // La alternativa en O cuelga de la etapa anterior: solo tiene sentido si hay exactamente una.
      const canAlternate = predecessorsOf(node).length === 1
      items = [
        ...(output === null ? [{ label: 'Añadir etapa', icon: Plus, onSelect: () => quickConnect(node.id) }] : []),
        ...(output !== 'loop'
          ? [
              {
                label: output === 'step' ? 'Añadir rama en Y' : 'Divergencia en Y (2 ramas)',
                hint: 'simultáneas',
                icon: Equal,
                onSelect: () => addBranch(node.id),
              },
            ]
          : []),
        ...(canAlternate
          ? [{ label: 'Añadir alternativa en O', hint: 'elegir', icon: Split, onSelect: () => addAlternative(node.id) }]
          : []),
        ...(output === null
          ? [{ label: 'Bucle a etapa…', icon: CornerLeftUp, onSelect: () => startLoop(node.id) }]
          : []),
      ]
    }
    // Ver los segmentos del ladder que genera esta etapa o transición.
    if (onShowInLadder && (node.type === 'step' || node.type === 'transition')) {
      items.push({ label: 'Ver en el ladder', icon: Cpu, onSelect: () => onShowInLadder(node.id) })
    }
    items.push(
      { label: 'Editar…', icon: Pencil, onSelect: () => onEdit(node.id) },
      'separator',
      { label: 'Eliminar', icon: Trash2, danger: true, onSelect: () => remove([node.id]) },
    )
  }

  return <ContextMenu x={menu.x} y={menu.y} title={title} items={items} onClose={onClose} />
}
