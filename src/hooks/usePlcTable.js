import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import { VARIABLES_TABLE_ID } from '../nodes'
import {
  addVariable,
  autoAssign,
  changeVariableType,
  deleteVariable,
  plcToCsv,
  renameVariable,
  validatePlc,
} from '../lib/addressing'
import { extractSymbols, projectVariables } from '../lib/symbols'
import { renameVariable as renameEverywhere } from '../lib/rename'
import { diagramContentKey } from '../lib/contentKey'
import { downloadFile } from '../lib/projectFile'
import { fileName } from '../lib/fileNames'

// Todo lo relativo a la tabla de variables a partir de su estado (`plc`, que vive en el lienzo
// porque forma parte del historial y del autoguardado):
// - variables y etapas del diagrama (solo dependen del contenido, no de las posiciones: no
//   cambian al arrastrar; ver lib/contentKey.js) y sus comprobaciones;
// - la tabla dibujada en el lienzo (mostrar/ocultar) y sus operaciones (`plcTable`, por contexto);
// - las direcciones a mostrar en el diagrama (`plcView`) y la exportación a CSV.
export function usePlcTable({ nodes, plc, setPlc, plcRef, takeSnapshot, onOpenDialog }) {
  // getNodesBounds del hook (no la función suelta): la de React Flow recomendada, sin avisos.
  const { setNodes, getNode, updateNodeData, getNodesBounds } = useReactFlow()

  const contentKey = diagramContentKey(nodes)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- se recalcula solo al cambiar el contenido
  const contentNodes = useMemo(() => nodes, [contentKey])
  // Incluye las variables añadidas a mano en la tabla aunque aún no se usen en el diagrama.
  const symbols = useMemo(() => projectVariables(contentNodes, plc.variables), [contentNodes, plc.variables])
  const stepNodes = useMemo(() => contentNodes.filter((n) => n.type === 'step'), [contentNodes])

  // Renombrar escribiendo: si un cambio del diagrama hace desaparecer una sola variable en uso y
  // aparecer una sola nueva del mismo tipo («Marcha» -> «Inicio» en una receptividad), es la
  // misma variable con otro nombre: su dirección, comentario y demás pasan a la nueva (y no queda
  // huérfana en la tabla). Mientras se escribe, los datos siguen al nombre letra a letra. Sin
  // instantánea propia: deshacer devuelve a la vez el texto y la tabla.
  // Si se borra el nombre entero y luego se escribe otro, entre medias no hay variable: la que
  // desaparece queda pendiente y la siguiente que aparezca (sola y del mismo tipo) la hereda.
  const usedBefore = useRef(null)
  const pending = useRef(null)
  useEffect(() => {
    const used = new Map([...extractSymbols(contentNodes)].map(([name, f]) => [name, f.type]))
    const before = usedBefore.current
    usedBefore.current = used
    if (!before) return
    const gone = [...before.keys()].filter((name) => !used.has(name))
    const added = [...used.keys()].filter((name) => !before.has(name))
    const hasData = (entry) => Boolean(entry && (entry.address || entry.comment))
    const variables = plcRef.current.variables ?? {}
    let from = null
    if (gone.length === 1 && added.length === 1 && before.get(gone[0]) === used.get(added[0])) from = gone[0]
    else if (!gone.length && added.length === 1 && pending.current?.type === used.get(added[0])) from = pending.current.name
    pending.current = gone.length === 1 && !added.length && hasData(variables[gone[0]]) ? { name: gone[0], type: before.get(gone[0]) } : null
    if (!from || used.has(from)) return
    const to = added[0]
    if (!hasData(variables[from]) || hasData(variables[to])) return
    setPlc((p) => renameEverywhere([], p, from, to).plc)
  }, [contentNodes, plcRef, setPlc])
  const plcIssues = useMemo(() => validatePlc(plc, stepNodes, symbols), [plc, stepNodes, symbols])

  const changePlc = useCallback(
    (updater, coalesceKey) => {
      takeSnapshot(coalesceKey && `plc:${coalesceKey}`)
      setPlc(updater)
    },
    [takeSnapshot, setPlc],
  )

  // Tabla de variables dibujada en el lienzo (nodo único, ver nodes/VariablesTableNode.jsx).
  const tableShown = nodes.some((n) => n.id === VARIABLES_TABLE_ID)
  const toggleTable = useCallback(
    (at) => {
      takeSnapshot()
      setNodes((nds) => {
        if (nds.some((n) => n.id === VARIABLES_TABLE_ID)) return nds.filter((n) => n.id !== VARIABLES_TABLE_ID)
        // Por defecto, a la derecha del grafcet y alineada con su parte superior.
        const diagram = nds.filter((n) => n.type === 'step' || n.type === 'transition')
        const bounds = diagram.length ? getNodesBounds(diagram) : null
        const position = at ?? (bounds ? { x: bounds.x + bounds.width + 160, y: bounds.y } : { x: 0, y: 0 })
        return [...nds, { id: VARIABLES_TABLE_ID, type: 'variables', position, data: { showComments: true }, deletable: false }]
      })
    },
    [takeSnapshot, setNodes, getNodesBounds],
  )

  // Nodos resaltados al pasar el ratón por una fila de la tabla del lienzo.
  const [highlight, setHighlight] = useState(null)
  // Última variable añadida a mano: su nombre se abre para editar nada más crearla.
  const [lastAdded, setLastAdded] = useState(null)

  const plcTable = useMemo(
    () => ({
      plc,
      symbols,
      stepNodes,
      changePlc,
      lastAdded,
      // reveal: si la tabla no está en el lienzo, se muestra para ver la variable nueva.
      addVariable: (type, { reveal = true } = {}) => {
        const { plc: next, name } = addVariable(plcRef.current, type, stepNodes, symbols)
        changePlc(next)
        setLastAdded(name)
        if (reveal && !getNode(VARIABLES_TABLE_ID)) toggleTable()
      },
      // Devuelve false si el nombre no es válido o ya existe.
      renameVariable: (oldName, newName) => {
        const next = renameVariable(plcRef.current, oldName, newName, symbols)
        if (!next) return false
        changePlc(next)
        return true
      },
      deleteVariable: (name) => changePlc((p) => deleteVariable(p, name)),
      setVariableType: (name, type) => changePlc((p) => changeVariableType(p, name, type, stepNodes, symbols)),
      autoFill: () => changePlc((p) => autoAssign(p, stepNodes, symbols)),
      autoAssign: (overwrite) => changePlc((p) => autoAssign(p, stepNodes, symbols, { overwrite })),
      openDialog: onOpenDialog,
      hideTable: () => toggleTable(),
      toggleComments: (id) => {
        takeSnapshot()
        updateNodeData(id, (n) => ({ showComments: !(n.data.showComments ?? true) }))
      },
    }),
    [plc, plcRef, symbols, stepNodes, changePlc, lastAdded, getNode, toggleTable, takeSnapshot, updateNodeData, onOpenDialog],
  )

  // Direcciones a mostrar en el diagrama (si está activada la opción en la tabla).
  const plcView = useMemo(() => {
    if (!plc.showAddresses) return null
    const stepByLabel = new Map(stepNodes.map((s) => [String(s.data.label), s.id]))
    return {
      stepAddress: (id) => plc.steps[id]?.address,
      lookup: {
        symbol: (name) => plc.variables[name]?.address,
        step: (label) => plc.steps[stepByLabel.get(label)]?.address,
      },
    }
  }, [plc, stepNodes])

  const exportCsv = useCallback(
    // BOM inicial para que Excel reconozca UTF-8 (acentos, ñ).
    () => downloadFile(`﻿${plcToCsv(plc, stepNodes, symbols)}`, fileName('csv', 'variables'), 'text/csv;charset=utf-8'),
    [plc, stepNodes, symbols],
  )

  return { symbols, stepNodes, plcIssues, changePlc, tableShown, toggleTable, plcTable, plcView, exportCsv, highlight, setHighlight }
}
