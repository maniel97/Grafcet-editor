import { describe, expect, it } from 'vitest'
import { decodeProject, encodeProject, isLocalOnly, shareLink, sharedData } from '../../src/lib/share'
import { EXAMPLES } from '../../src/lib/examples'

describe('compartir por enlace', () => {
  it('el proyecto va y vuelve entero, comprimido', async () => {
    const project = { name: 'Pick & place', ...EXAMPLES.find((e) => e.id === 'pickplace').build() }
    const data = await encodeProject(project)
    expect(data).toMatch(/^[A-Za-z0-9_-]+$/) // seguro para un enlace
    expect(data.length).toBeLessThan(JSON.stringify(project).length / 2)
    const back = await decodeProject(data)
    expect(back.name).toBe('Pick & place')
    expect(back.nodes).toEqual(project.nodes)
    expect(back.plc.scene).toEqual(project.plc.scene)
  })

  it('enlace dañado o recortado: mensaje claro', async () => {
    const data = await encodeProject({ name: 'X', nodes: [], edges: [] })
    await expect(decodeProject(data.slice(0, -6))).rejects.toThrow('incompleto o dañado')
  })

  it('el enlace y su lectura', async () => {
    const link = await shareLink({ name: 'X', nodes: [], edges: [] }, { origin: 'https://grafcet.example', pathname: '/app/' })
    expect(link).toMatch(/^https:\/\/grafcet\.example\/app\/#p=/)
    expect(sharedData(link.slice(link.indexOf('#')))).toBe(link.split('#p=')[1])
    expect(sharedData('#otra')).toBe(null)
  })

  it('aviso si la aplicación solo se usa en este equipo', () => {
    expect(isLocalOnly({ protocol: 'http:', hostname: 'localhost' })).toBe(true)
    expect(isLocalOnly({ protocol: 'file:', hostname: '' })).toBe(true)
    expect(isLocalOnly({ protocol: 'https:', hostname: 'grafcet.example' })).toBe(false)
  })
})
