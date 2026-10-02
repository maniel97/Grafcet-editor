import { useCallback, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { copySelection, PASTE_OFFSET, prepareClipboard } from '../lib/clipboard'

// Copiar, pegar y duplicar (lib/clipboard.js). El portapapeles es interno del editor.
export function useClipboard(takeSnapshot) {
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow()
  const clipboardRef = useRef(null)

  // Inserta nodos y enlaces nuevos dejándolos seleccionados (un paso de deshacer).
  const insertClip = useCallback(
    (clip) => {
      const { nodes: added, edges: addedEdges } = prepareClipboard(clip, getNodes())
      takeSnapshot()
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...added])
      setEdges((eds) => [...eds.map((e) => ({ ...e, selected: false })), ...addedEdges])
    },
    [getNodes, takeSnapshot, setNodes, setEdges],
  )

  const copy = useCallback(() => {
    const clip = copySelection(getNodes(), getEdges())
    if (clip) clipboardRef.current = clip
    return clip
  }, [getNodes, getEdges])

  const paste = useCallback(() => {
    const clip = clipboardRef.current
    if (!clip) return
    insertClip(clip)
    // Cada pegado sucesivo cae un poco más abajo y a la derecha, en cascada.
    clipboardRef.current = {
      ...clip,
      nodes: clip.nodes.map((n) => ({ ...n, position: { x: n.position.x + PASTE_OFFSET, y: n.position.y + PASTE_OFFSET } })),
    }
  }, [insertClip])

  const duplicate = useCallback(() => {
    const clip = copySelection(getNodes(), getEdges())
    if (clip) insertClip(clip)
  }, [getNodes, getEdges, insertClip])

  return { copy, paste, duplicate }
}
