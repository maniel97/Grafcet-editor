// Proyecto que llega en un enlace compartido (lib/share.js): se lee al abrir el editor y también al
// pegar un enlace en la pestaña ya abierta (solo cambia el «#»). El lienzo ofrece abrirlo
// (components/CanvasNotices.jsx, SharedProjectBanner); lo de ahora va a «Trabajos anteriores».
import { useCallback, useEffect, useState } from 'react'
import { clearSharedHash, decodeProject, sharedData } from '../lib/share'

// incoming: null | { project } | { error }; close(): lo descarta y limpia el enlace de la barra.
export function useSharedProject() {
  const [incoming, setIncoming] = useState(null)
  useEffect(() => {
    const check = () => {
      const data = sharedData()
      if (!data) return
      decodeProject(data)
        .then((project) => setIncoming({ project }))
        .catch((error) => setIncoming({ error: error.message }))
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])
  const close = useCallback(() => {
    setIncoming(null)
    clearSharedHash()
  }, [])
  return { incoming, close }
}
