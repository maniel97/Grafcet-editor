// Disposición de los paneles junto al grafcet (#18): planta, esquema eléctrico y ladder, cada uno
// cerrado (null), junto al grafcet ('split') o a pantalla completa ('full').
//
// - Reparto del ancho: por defecto, el grafcet y cada panel en vista dividida a partes iguales (sin
//   contar el panel de la simulación, w-80).
// - Apilados: con dos o más en vista dividida, en una columna, uno encima de otro (preferencia del
//   usuario, con el reparto del alto y el ancho de la columna recordados en el navegador). Si uno
//   está a pantalla completa, cada uno a su sitio.
// - Pestañas: si no caben el grafcet y un panel de 380 px uno al lado del otro, una pestaña por
//   vista; al abrir un panel, su pestaña pasa a ser la elegida.
// - onLayoutChange: cuando cambia el sitio que le queda al grafcet (para reencuadrarlo).
//
// Devuelve lo que necesita el lienzo: rowRef (la zona de trabajo, que se mide), tabs (para
// PanelTabs), stack y stackRef (para PanelStack), panelWidth (ancho por defecto) y dockFor(id), la prop `dock`
// de cada panel (ver dockLayout en components/panelWidth.js).
import { useEffect, useRef, useState } from 'react'
import { StackButton, StackSeparator } from '../components/PanelDock'
import { usePanelWidth } from '../components/panelWidth'

const STACK_KEY = 'grafcet-editor:panels-stacked'
const GROW_KEY = 'grafcet-editor:panels-grow'
const readPref = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const writePref = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento */
  }
}
const readGrow = () => {
  try {
    return JSON.parse(readPref(GROW_KEY)) ?? {}
  } catch {
    return {}
  }
}

// views: { elec, scene, ladder } (la planta, solo mientras se ve: al simular).
export function useDockLayout({ views, simulating, onLayoutChange }) {
  // Zona de trabajo (grafcet + paneles): con poco ancho, los paneles van en pestañas.
  const rowRef = useRef(null)
  const [rowWidth, setRowWidth] = useState(Infinity)
  useEffect(() => {
    const el = rowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setRowWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const [stacked, setStacked] = useState(() => readPref(STACK_KEY) === '1')
  const [stackGrow, setStackGrow] = useState(readGrow)
  const [stackWidth, stackSeparator] = usePanelWidth('grafcet-editor:stack-width', 360)
  const stackRef = useRef(null)
  const [panelTab, setPanelTab] = useState('grafcet')

  const ids = ['elec', 'scene', 'ladder']
  const sim = simulating ? '20rem' : '0px'
  const splitIds = ids.filter((id) => views[id] === 'split')
  const panelWidth = `calc((100% - ${sim}) / ${splitIds.length + 1})`
  const anyFull = ids.some((id) => views[id] === 'full')
  const stackActive = stacked && splitIds.length >= 2 && !anyFull
  const toggleStack = () =>
    setStacked((v) => {
      writePref(STACK_KEY, v ? '0' : '1')
      return !v
    })
  const commitGrow = (grow) => {
    setStackGrow(grow ?? {})
    writePref(GROW_KEY, JSON.stringify(grow ?? {}))
  }

  // Pestañas (sin contar el panel de la simulación, que en un móvil va abajo).
  const openPanels = ids.filter((id) => views[id])
  const tabbed = openPanels.length > 0 && rowWidth - (simulating && rowWidth >= 768 ? 320 : 0) < 760
  const openKey = openPanels.join(',')
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    const added = openPanels.find((id) => !prevOpenKey.split(',').includes(id))
    if (added) setPanelTab(added)
  }
  const activeTab = openPanels.includes(panelTab) ? panelTab : 'grafcet'

  // Cambio del sitio que le queda al grafcet.
  const layoutKey = tabbed ? `tabs:${activeTab}` : `${splitIds.length}|${stackActive}|${anyFull}`
  const layoutKeyRef = useRef(layoutKey)
  const onLayoutChangeRef = useRef(onLayoutChange)
  useEffect(() => {
    onLayoutChangeRef.current = onLayoutChange
  })
  useEffect(() => {
    if (layoutKeyRef.current === layoutKey) return
    layoutKeyRef.current = layoutKey
    const id = requestAnimationFrame(() => onLayoutChangeRef.current?.())
    return () => cancelAnimationFrame(id)
  }, [layoutKey])

  const dockFor = (id) => {
    if (tabbed) return { tab: activeTab === id ? 'active' : 'hidden' }
    const button = splitIds.length >= 2 && splitIds.includes(id) && !anyFull ? <StackButton stacked={stackActive} onToggle={toggleStack} /> : null
    if (!stackActive) return { button }
    return { stacked: true, grow: stackGrow[id] ?? 1, button, top: splitIds[0] === id ? null : <StackSeparator onGrow={setStackGrow} onCommit={commitGrow} /> }
  }

  return {
    rowRef,
    stackRef,
    panelWidth,
    dockFor,
    tabs: { show: tabbed, items: ['grafcet', ...openPanels], active: activeTab, select: setPanelTab },
    stack: { active: stackActive, width: stackWidth ?? `calc((100% - ${sim}) / 2)`, separator: stackSeparator },
  }
}
