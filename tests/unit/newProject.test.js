import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNewProject, loadNewProjectOptions, saveNewProjectOptions, DEFAULT_NEW_PROJECT } from '../../src/lib/newProject'
import { normalizeProject } from '../../src/lib/projectFile'

describe('proyecto nuevo', () => {
  // Sin navegador: un almacenamiento en memoria.
  beforeEach(() => {
    const data = new Map()
    vi.stubGlobal('localStorage', { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) })
  })

  it('por defecto: la etapa inicial y la tabla de variables a su izquierda', () => {
    const p = buildNewProject({ name: '  Taladradora ' })
    expect(p.name).toBe('Taladradora')
    expect(p.nodes.filter((n) => n.type === 'step')).toHaveLength(1)
    expect(p.nodes.find((n) => n.type === 'step').data.initial).toBe(true)
    const table = p.nodes.find((n) => n.type === 'variables')
    expect(table.data.autoPlace).toBe('left')
    expect(p.plc.scheme).toBe('siemens')
    expect(normalizeProject(p)).not.toBeNull()
  })

  it('ciclo básico, lienzo vacío y sin tabla', () => {
    const cycle = buildNewProject({ start: 'cycle', table: false })
    expect(cycle.nodes.map((n) => n.type)).toEqual(['step', 'transition', 'step', 'transition'])
    expect(cycle.edges).toHaveLength(4)
    const empty = buildNewProject({ start: 'empty' })
    expect(empty.nodes.map((n) => n.type)).toEqual(['variables'])
    expect(empty.nodes[0].data.autoPlace).toBeUndefined()
  })

  it('S7-200 con CPU, enunciado en una nota y datos del cajetín', () => {
    const p = buildNewProject({ name: 'Garaje', platform: 's7200', cpu: '224', stepPrefix: 'E', statement: 'Abrir la puerta con el mando.', author: 'Ana', company: '', showAddresses: true })
    expect(p.plc).toMatchObject({ scheme: 's7200', stepPrefix: 'E', showAddresses: true, s7200: { cpu: '224', modules: [] }, titleBlock: { author: 'Ana' } })
    expect(p.plc.titleBlock.company).toBeUndefined()
    expect(p.nodes.find((n) => n.type === 'note').data.text).toBe('# Garaje\nAbrir la puerta con el mando.')
    // Sin CPU elegida no se fija ninguna configuración.
    expect(buildNewProject({ platform: 's7200' }).plc.s7200).toBeUndefined()
  })

  it('recuerda las elecciones, pero no el título ni el enunciado', () => {
    saveNewProjectOptions({ ...DEFAULT_NEW_PROJECT, name: 'X', statement: 'Y', platform: 'iec', table: false, author: 'Ana' })
    const o = loadNewProjectOptions()
    expect(o).toMatchObject({ name: '', statement: '', platform: 'iec', table: false, author: 'Ana' })
  })
})
