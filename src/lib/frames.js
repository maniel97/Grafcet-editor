// Marcos con nombre (nodes/FrameNode.jsx), como dibuja la norma IEC 60848:
// - grafcet parcial «G1», «G2»...: destino de las órdenes de forzado (F/G2{3}).
// - expansión de macroetapa «M1»: detalla la macroetapa M1, de su etapa de entrada E1 a la de
//   salida S1.
// Un elemento pertenece al marco más pequeño que contiene su centro; el marco no es un grupo de
// React Flow (las posiciones siguen siendo absolutas) y la pertenencia se calcula siempre al vuelo.
import { N_ } from './i18n'

export const FRAME_KINDS = {
  grafcet: { label: N_('Grafcet parcial'), prefix: 'G', help: N_('Destino de las órdenes de forzado: F/G2{3}') },
  macro: { label: N_('Expansión de macroetapa'), prefix: 'M', help: N_('De la etapa de entrada E1 a la de salida S1') },
}
export const FRAME_PADDING = 40
export const FRAME_MIN = { width: 160, height: 120 }
export const FRAME_SIZE = { width: 320, height: 380 }

const SIZE = { step: { width: 56, height: 56 }, transition: { width: 56, height: 24 } }

const centerOf = (node) => {
  const size = SIZE[node.type] ?? { width: 0, height: 0 }
  const w = node.measured?.width ?? node.width ?? size.width
  const h = node.measured?.height ?? node.height ?? size.height
  return { x: node.position.x + w / 2, y: node.position.y + h / 2 }
}
const frameRect = (f) => ({
  x: f.position.x,
  y: f.position.y,
  w: f.measured?.width ?? f.width ?? FRAME_MIN.width,
  h: f.measured?.height ?? f.height ?? FRAME_MIN.height,
})
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

// Marco más pequeño (de un tipo, o de cualquiera) que contiene el nodo.
export function frameOf(node, frames, kind) {
  const c = centerOf(node)
  let best = null
  let bestArea = Infinity
  for (const f of frames) {
    if (f.id === node.id || (kind && f.data.kind !== kind)) continue
    const r = frameRect(f)
    if (inside(c, r) && r.w * r.h < bestArea) {
      best = f
      bestArea = r.w * r.h
    }
  }
  return best
}

// Nodos dentro de un marco (los marcos, solo si caben enteros): se mueven con él al arrastrarlo.
export const membersOf = (frame, nodes) => {
  const r = frameRect(frame)
  return nodes.filter((n) => {
    if (n.id === frame.id) return false
    if (n.type !== 'frame') return inside(centerOf(n), r)
    const o = frameRect(n)
    return o.x >= r.x && o.y >= r.y && o.x + o.w <= r.x + r.w && o.y + o.h <= r.y + r.h
  })
}

// Marco que rodea unos nodos con margen (para «Encerrar en un marco»).
export function frameAround(nodes) {
  const rects = nodes.map((n) => {
    const size = SIZE[n.type] ?? { width: 120, height: 60 }
    const w = n.measured?.width ?? n.width ?? size.width
    const h = n.measured?.height ?? n.height ?? size.height
    return { x: n.position.x, y: n.position.y, r: n.position.x + w, b: n.position.y + h }
  })
  const x = Math.min(...rects.map((r) => r.x)) - FRAME_PADDING
  const y = Math.min(...rects.map((r) => r.y)) - FRAME_PADDING
  // Más margen a la derecha: las receptividades y las acciones sobresalen de las cajas.
  const width = Math.max(FRAME_MIN.width, Math.max(...rects.map((r) => r.r)) - x + FRAME_PADDING * 2)
  const height = Math.max(FRAME_MIN.height, Math.max(...rects.map((r) => r.b)) - y + FRAME_PADDING)
  return { position: { x, y }, width, height }
}

// Primer nombre libre del tipo: G1, G2... / M1, M2... (las macroetapas ya existentes primero).
export function nextFrameName(kind, nodes) {
  const prefix = FRAME_KINDS[kind].prefix
  const used = new Set(nodes.filter((n) => n.type === 'frame').map((n) => String(n.data.name).toUpperCase()))
  if (kind === 'macro') {
    for (const n of nodes) {
      if (n.type !== 'step' || !n.data.macro) continue
      const name = macroName(n.data.label)
      if (!used.has(name.toUpperCase())) return name
    }
  }
  let i = 1
  while (used.has(`${prefix}${i}`)) i++
  return `${prefix}${i}`
}

// Nombre de la expansión de una macroetapa: la etapa «M1» o «1» se detalla en el marco «M1».
export const macroName = (label) => (/^M/i.test(String(label)) ? String(label).toUpperCase() : `M${label}`)
