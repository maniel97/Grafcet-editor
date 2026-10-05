import { afterEach, describe, expect, it } from 'vitest'
import { LANGUAGES, N_, setLanguage, t } from '../../src/lib/i18n'
import { audit } from '../../scripts/i18n.mjs'

describe('idiomas', () => {
  afterEach(() => setLanguage('es'))
  it('español por defecto: el texto tal cual', () => expect(t('Exportar')).toBe('Exportar'))
  it('traduce y, si falta (o está vacío), deja el español', () => {
    setLanguage('en')
    expect(t('Exportar')).toBe('Export')
    expect(t('Texto sin traducir')).toBe('Texto sin traducir')
    setLanguage('fr')
    expect(t('Verificar')).toBe('Vérifier')
    setLanguage('pt')
    expect(t('Deshacer')).toBe('Desfazer')
  })
  it('partes variables con nombre (también en español)', () => {
    expect(t('Mover a {hoja}', { hoja: 'Hoja 2' })).toBe('Mover a Hoja 2')
    setLanguage('en')
    expect(t('Mover a {hoja}', { hoja: 'Hoja 2' })).toBe('Move to Hoja 2')
    setLanguage('fr')
    expect(t('Borrar {nombre}', { nombre: 'GEMMA' })).toBe('Supprimer GEMMA')
  })
  it('N_ marca sin traducir', () => {
    setLanguage('en')
    expect(N_('Exportar')).toBe('Exportar')
  })
  it('idioma desconocido: español', () => {
    setLanguage('xx')
    expect(t('Exportar')).toBe('Exportar')
    expect(LANGUAGES.map((l) => l.id)).toEqual(['es', 'en', 'fr', 'pt'])
  })
})

describe('catálogos (src/locales, npm run i18n)', () => {
  const a = audit()
  it('el catálogo de origen (es.json) está al día con el código', () => expect(a.stale).toEqual([]))
  it('cada idioma tiene exactamente los textos del código (vacío: sin traducir)', () => {
    for (const lang of Object.keys(a.missing)) {
      expect(a.missing[lang], lang).toEqual([])
      expect(a.extra[lang], lang).toEqual([])
    }
  })
  it('las traducciones conservan los marcadores {nombre}', () => expect(a.badPlaceholders).toEqual([]))
  it('ningún t() con texto variable (se usan marcadores)', () => expect(a.dynamic).toEqual([]))
  it('ninguna variable local «t» tapa a la función t() (fallaría al ejecutarse)', () => expect(a.shadowed).toEqual([]))
})

describe('marcadores', () => {
  // Antes solo se sustituían los de letras sin tilde: «© {año}» se veía tal cual.
  it('admiten tildes y ñ', () => expect(t('© {año} {autor}.', { año: 2026, autor: 'Ana' })).toBe('© 2026 Ana.'))
})
