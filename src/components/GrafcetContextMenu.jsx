import { N_, t } from '../lib/i18n'
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
  Layers,
  Asterisk,
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
  const { arrange, spread, addBranch, predecessorsOf, addAlternative, converge, toggleInitial, toggleMacro, toggleEncapsulating, toggleActivationLink, addAction, remove } =
    useStructureActions()
  const { startLoop, plcTable, toggleTable, setEditingNoteId, takeSnapshot } = useEditor()

  let title
  let items = []

  // Solo lectura (simulando o bloqueado): únicamente consultar el ladder.
  if (menu.kind === 'readonly') {
    const node = getNode(menu.nodeIds[0])
    if (!node) return null
    title = node.type === 'step' ? t('Etapa {etapa}', { etapa: node.data.label }) : N_('Transición')
    items = [{ label: N_('Ver en el ladder'), icon: Cpu, onSelect: () => onShowInLadder(node.id) }]
    return <ContextMenu x={menu.x} y={menu.y} title={title} items={items} onClose={onClose} />
  }

  if (menu.kind === 'edge') {
    const edge = getEdges().find((e) => e.id === menu.edgeId)
    if (!edge) return null
    const cut = !!edge.data?.reference
    title = N_('Enlace')
    items = [
      {
        label: cut ? N_('Unir (quitar referencias)') : N_('Cortar con referencias'),
        hint: cut ? undefined : N_('enlaces largos'),
        icon: Scissors,
        onSelect: () => {
          takeSnapshot()
          setEdges((eds) => eds.map((e) => (e.id === edge.id ? { ...e, data: { ...e.data, reference: !cut } } : e)))
        },
      },
      'separator',
      { label: N_('Eliminar enlace'), icon: Trash2, danger: true, onSelect: () => deleteElements({ edges: [{ id: edge.id }] }) },
    ]
  } else if (menu.kind === 'pane') {
    const at = menu.flowPosition
    title = N_('Lienzo')
    items = [
      { label: N_('Etapa inicial aquí'), icon: InitialStepIcon, onSelect: () => onAddNodeAt('step', { initial: true }, at) },
      { label: N_('Etapa aquí'), icon: Square, onSelect: () => onAddNodeAt('step', {}, at) },
      { label: N_('Transición aquí'), icon: Minus, onSelect: () => onAddNodeAt('transition', {}, at) },
      { label: N_('Nota aquí'), icon: StickyNote, onSelect: () => onAddNodeAt('note', {}, at) },
      'separator',
      { label: N_('Marco de grafcet parcial aquí'), hint: 'G1', icon: SquareDashed, onSelect: () => onAddNodeAt('frame', { kind: 'grafcet' }, at) },
      { label: N_('Marco de expansión aquí'), hint: 'M1', icon: SquareDashed, onSelect: () => onAddNodeAt('frame', { kind: 'macro' }, at) },
      'separator',
      { label: N_('Separar columnas'), hint: N_('que los textos no se pisen'), icon: MoveHorizontal, onSelect: () => spread() },
      ...(plcTable && !getNode(VARIABLES_TABLE_ID)
        ? ['separator', { label: N_('Tabla de variables aquí'), icon: Table2, onSelect: () => toggleTable(at) }]
        : []),
    ]
  } else if (menu.kind === 'selection') {
    const nodes = menu.nodeIds.map(getNode).filter(Boolean)
    const steps = nodes.filter((n) => n.type === 'step')
    const transitions = nodes.filter((n) => n.type === 'transition')
    title = `${nodes.length} elementos`
    if (steps.length >= 2)
      items.push({
        label: t('Converger {n} etapas en Y', { n: steps.length }),
        hint: N_('sincronizar'),
        icon: Merge,
        onSelect: () => converge(steps.map((n) => n.id), 'step'),
      })
    if (transitions.length >= 2)
      items.push({
        label: t('Converger {n} transiciones en O', { n: transitions.length }),
        icon: Merge,
        onSelect: () => converge(transitions.map((n) => n.id), 'transition'),
      })
    if (steps.length + transitions.length >= 2) {
      if (items.length) items.push('separator')
      items.push(
        { label: N_('Alinear en columna'), icon: AlignHorizontalJustifyCenter, onSelect: () => arrange(menu.nodeIds, 'column') },
        { label: N_('Espaciar la secuencia'), hint: N_('distancia estándar'), icon: AlignVerticalSpaceAround, onSelect: () => arrange(menu.nodeIds, 'space') },
        { label: N_('Separar columnas'), hint: N_('que los textos no se pisen'), icon: MoveHorizontal, onSelect: () => spread(menu.nodeIds) },
      )
    }
    if (steps.length + transitions.length >= 1) {
      if (items.length) items.push('separator')
      items.push(
        { label: N_('Encerrar en un grafcet parcial'), hint: 'G…', icon: Group, onSelect: () => onFrameAround(menu.nodeIds, 'grafcet') },
        { label: N_('Encerrar como expansión de macroetapa'), hint: 'M…', icon: Group, onSelect: () => onFrameAround(menu.nodeIds, 'macro') },
      )
    }
    if (sheets.length) {
      if (items.length) items.push('separator')
      for (const s of sheets) items.push({ label: t('Mover a {hoja}', { hoja: s.name }), icon: Rows3, onSelect: () => onMoveToSheet(menu.nodeIds, s.id) })
    }
    if (items.length) items.push('separator')
    items.push({ label: N_('Eliminar selección'), icon: Trash2, danger: true, onSelect: () => remove(menu.nodeIds) })
  } else {
    const node = getNode(menu.nodeIds[0])
    if (!node) return null
    if (node.type === 'note') {
      return (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={t('Nota')}
          onClose={onClose}
          items={[
            { label: N_('Editar texto'), icon: Pencil, onSelect: () => setEditingNoteId(node.id) },
            'separator',
            ...Object.entries(NOTE_COLORS).map(([id, c]) => ({
              label: t('Color {color}', { color: t(c.label).toLowerCase() }),
              icon: () => <span className="h-4 w-4 rounded-sm border" style={{ background: c.bg, borderColor: c.border }} />,
              hint: (node.data.color ?? 'yellow') === id ? N_('actual') : undefined,
              onSelect: () => {
                takeSnapshot()
                updateNodeData(node.id, { color: id })
              },
            })),
            'separator',
            { label: N_('Eliminar'), icon: Trash2, danger: true, onSelect: () => remove([node.id]) },
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
              label: t('Convertir en {tipo}', { tipo: t(FRAME_KINDS[other].label).toLowerCase() }),
              icon: SquareDashed,
              onSelect: () => {
                takeSnapshot()
                updateNodeData(node.id, { kind: other })
              },
            },
            'separator',
            { label: N_('Eliminar el marco'), hint: N_('deja su contenido'), icon: Trash2, danger: true, onSelect: () => remove([node.id]) },
          ]}
        />
      )
    }
    if (node.type === 'variables') {
      return (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={t('Tabla de variables')}
          onClose={onClose}
          items={[
            // Variables previstas pero aún no usadas en el diagrama (p. ej. una seta de emergencia).
            ...VARIABLE_TYPES.map((x) => ({
              label: t('Añadir {tipo}', { tipo: t(x.label).toLowerCase() }),
              hint: plcTable.plc.scheme === 'iec' && ['I', 'Q', 'M'].includes(x.area) ? `%${x.area}X` : x.area,
              icon: Plus,
              onSelect: () => plcTable.addVariable(x.id),
            })),
            'separator',
            { label: N_('Rellenar direcciones vacías'), icon: WandSparkles, onSelect: plcTable.autoFill },
            { label: N_('Abrir tabla completa'), icon: Maximize2, onSelect: plcTable.openDialog },
            'separator',
            { label: N_('Ocultar del lienzo'), icon: EyeOff, onSelect: plcTable.hideTable },
          ]}
        />
      )
    }
    if (node.type === 'step') {
      title = t('Etapa {etapa}', { etapa: node.data.label })
      // Con una transición de salida ya puesta, las alternativas en O se añaden desde la transición.
      const hasTransition = getEdges().some((e) => e.source === node.id)
      items = [
        ...(hasTransition ? [] : [{ label: N_('Añadir transición'), icon: Plus, onSelect: () => quickConnect(node.id) }]),
        { label: N_('Añadir acción'), icon: RectangleHorizontal, onSelect: () => addAction(node.id) },
        {
          label: node.data.initial ? N_('Quitar etapa inicial') : N_('Marcar como inicial'),
          icon: InitialStepIcon,
          onSelect: () => toggleInitial(node.id),
        },
        {
          label: node.data.macro ? N_('Convertir en etapa normal') : N_('Convertir en macroetapa'),
          icon: Rows3,
          onSelect: () => toggleMacro(node.id),
        },
        {
          label: node.data.encapsulating ? N_('Quitar la encapsulación') : N_('Convertir en etapa encapsulante'),
          hint: node.data.encapsulating ? undefined : N_('crea su grafcet encapsulado'),
          icon: Layers,
          onSelect: () => toggleEncapsulating(node.id),
        },
        {
          label: node.data.activationLink ? N_('Quitar el enlace de activación (*)') : N_('Enlace de activación (*)'),
          hint: node.data.activationLink ? undefined : N_('se activa con su encapsulante'),
          icon: Asterisk,
          onSelect: () => toggleActivationLink(node.id),
        },
      ]
    } else {
      title = N_('Transición')
      // Salida actual: null | 'loop' | 'step'. Con bucle no se añaden etapas debajo (se activarían
      // a la vez que la del bucle); con etapas debajo no se añade bucle. Ver lib/grafcetRules.js.
      const output = transitionOutput(node.id, getEdges(), (id) => getNode(id)?.position.y ?? Infinity)
      // La alternativa en O cuelga de la etapa anterior: solo tiene sentido si hay exactamente una.
      const canAlternate = predecessorsOf(node).length === 1
      items = [
        ...(output === null ? [{ label: N_('Añadir etapa'), icon: Plus, onSelect: () => quickConnect(node.id) }] : []),
        ...(output !== 'loop'
          ? [
              {
                label: output === 'step' ? N_('Añadir rama en Y') : N_('Divergencia en Y (2 ramas)'),
                hint: N_('simultáneas'),
                icon: Equal,
                onSelect: () => addBranch(node.id),
              },
            ]
          : []),
        ...(canAlternate
          ? [{ label: N_('Añadir alternativa en O'), hint: N_('elegir'), icon: Split, onSelect: () => addAlternative(node.id) }]
          : []),
        ...(output === null
          ? [{ label: N_('Bucle a etapa'), icon: CornerLeftUp, onSelect: () => startLoop(node.id) }]
          : []),
      ]
    }
    // Ver los segmentos del ladder que genera esta etapa o transición.
    if (onShowInLadder && (node.type === 'step' || node.type === 'transition')) {
      items.push({ label: N_('Ver en el ladder'), icon: Cpu, onSelect: () => onShowInLadder(node.id) })
    }
    items.push(
      { label: N_('Editar'), icon: Pencil, onSelect: () => onEdit(node.id) },
      'separator',
      { label: N_('Eliminar'), icon: Trash2, danger: true, onSelect: () => remove([node.id]) },
    )
  }

  return <ContextMenu x={menu.x} y={menu.y} title={title} items={items} onClose={onClose} />
}
