// Vista en relieve de la planta (scene.relief): proyección oblicua (caballera). El dibujo plano de
// cada elemento es su cara de delante y se le añade el volumen hacia atrás, arriba a la derecha:
// la cara de arriba y la de la derecha. Solo es dibujo: las coordenadas, la física y los clics
// no cambian. En la vista de frente el volumen es la profundidad; desde arriba, la altura.
//
// reliefBoxes(scene, state, e) -> [{ r: { x, y, w, h } (rectángulo de la escena), depth, tone }]
// faces(box) -> { top: [[x, y]…], side: [[x, y]…] }: polígonos de las dos caras visibles.
import {
  TANK,
  barrierArm,
  conveyorRect,
  cylinderPlate,
  placed,
  platformRect,
  rampRect,
  scaleRect,
  sinkRect,
  worldRect,
} from './scene'

// Desplazamiento de la cara de atrás por cada px de profundidad (45°, a media escala).
export const RELIEF_SLANT = 0.5
export const reliefOffset = (depth) => ({ x: depth * RELIEF_SLANT, y: -depth * RELIEF_SLANT })

export function reliefBoxes(scene, state, e) {
  const p = placed(scene, state, e)
  const pos = state.pos?.[e.id] ?? 0
  switch (e.type) {
    case 'conveyor':
      return [{ r: conveyorRect(p), depth: 40, tone: 'belt' }]
    case 'cylinder': {
      const stroke = Number(e.stroke) || 100
      // Como CylinderShape: cuerpo 80×24, vástago y placa 8×28 al final de la carrera.
      return [
        { r: worldRect(p, 0, -12, 80, 24), depth: 24, tone: 'body' },
        { r: worldRect(p, 12 + pos * 62, -3, 68 - pos * 62 + pos * stroke, 6), depth: 6, tone: 'rod' },
        { r: cylinderPlate(p, pos), depth: 24, tone: 'plate' },
      ]
    }
    case 'platform':
      return [{ r: platformRect(p), depth: 40, tone: 'steel' }]
    case 'ramp':
      return [{ r: rampRect(p), depth: 40, tone: 'steel' }]
    case 'scale':
      return [{ r: scaleRect(p), depth: 30, tone: 'steel' }]
    case 'sink':
      return [{ r: sinkRect(p), depth: 50, tone: 'bin' }]
    case 'barrier':
      // Solo con el brazo bajado: al abrirse gira hacia arriba.
      return pos < 0.5 ? [{ r: barrierArm(p), depth: 30, tone: 'arm' }] : []
    case 'tank':
      return [{ r: worldRect(p, 0, 0, TANK.w, TANK.h), depth: 50, tone: 'tank' }]
    case 'feeder':
      // La tolva (sin girar, como FeederShape).
      return [{ r: { x: e.x - 28, y: e.y - 56, w: 56, h: 30 }, depth: 30, tone: 'bin' }]
    default:
      return []
  }
}

// Las piezas, cubos (como mucho 40 px de fondo).
export const pieceBox = (p) => ({ r: { x: p.x, y: p.y, w: p.w, h: p.h }, depth: Math.min(p.w, 40), tone: 'piece' })

export function faces({ r, depth }) {
  const o = reliefOffset(depth)
  return {
    top: [
      [r.x, r.y],
      [r.x + o.x, r.y + o.y],
      [r.x + r.w + o.x, r.y + o.y],
      [r.x + r.w, r.y],
    ],
    side: [
      [r.x + r.w, r.y],
      [r.x + r.w + o.x, r.y + o.y],
      [r.x + r.w + o.x, r.y + r.h + o.y],
      [r.x + r.w, r.y + r.h],
    ],
  }
}

// Orden de dibujo: primero lo de arriba y a la derecha (más atrás), así lo de delante lo tapa.
export const reliefOrder = (a, b) => a.r.y + a.r.h - (b.r.y + b.r.h) || b.r.x - a.r.x
