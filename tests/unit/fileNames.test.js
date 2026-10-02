import { afterEach, describe, expect, it } from 'vitest'
import { fileName, setProjectName, slugify } from '../../src/lib/fileNames'
import { normalizeProject } from '../../src/lib/projectFile'

describe('nombres de archivo a partir del nombre del proyecto', () => {
  afterEach(() => setProjectName(''))

  it('sin nombre: los de siempre', () => {
    expect(fileName('json')).toBe('grafcet.json')
    expect(fileName('svg', 'ladder')).toBe('ladder.svg')
    expect(fileName('csv', 'variables')).toBe('variables.csv')
  })
  it('con nombre: sin acentos, espacios ni símbolos', () => {
    setProjectName('Taladradora nº 2 (versión B)')
    expect(slugify('Taladradora nº 2 (versión B)')).toBe('taladradora-n-2-version-b')
    expect(fileName('pdf')).toBe('taladradora-n-2-version-b.pdf')
    expect(fileName('svg', 'ladder')).toBe('taladradora-n-2-version-b-ladder.svg')
  })
  it('el nombre viaja en el proyecto guardado', () => {
    expect(normalizeProject({ name: 'Semáforo', nodes: [], edges: [] }).name).toBe('Semáforo')
    expect(normalizeProject({ nodes: [], edges: [] }).name).toBeUndefined()
  })
})
