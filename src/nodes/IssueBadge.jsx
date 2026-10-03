import { useEditor } from '../lib/editorContext'

// Marca roja (error), ámbar (aviso) o azul (consejo) sobre un nodo con problemas de conformidad.
// Solo aparece con el panel de verificación abierto; nunca en las exportaciones.
export default function IssueBadge({ nodeId }) {
  const { issuesByNode } = useEditor()
  const issues = issuesByNode?.get(nodeId)
  if (!issues?.length) return null
  const isError = issues.some((i) => i.severity === 'error')
  const onlyTips = issues.every((i) => i.severity === 'tip')
  return (
    <span
      title={issues.map((i) => i.message).join('\n')}
      className={`editor-only absolute -right-[10px] -top-[10px] z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold leading-none text-white shadow ${
        isError ? 'bg-red-600' : onlyTips ? 'bg-blue-500' : 'bg-amber-500'
      }`}
    >
      {onlyTips ? 'i' : '!'}
    </span>
  )
}
