import { afterEach, describe, expect, it } from 'vitest'
import { LANGUAGES, setLanguage, t } from '../../src/lib/i18n'
import en from '../../src/lib/locales/en'
import fr from '../../src/lib/locales/fr'
import pt from '../../src/lib/locales/pt'

describe('idiomas', () => {
  afterEach(() => setLanguage('es'))
  it('español por defecto: el texto tal cual', () => expect(t('Exportar')).toBe('Exportar'))
  it('traduce y, si falta, deja el español', () => {
    setLanguage('en')
    expect(t('Exportar')).toBe('Export')
    expect(t('Texto sin traducir')).toBe('Texto sin traducir')
    setLanguage('fr')
    expect(t('Verificar')).toBe('Vérifier')
    setLanguage('pt')
    expect(t('Deshacer')).toBe('Desfazer')
  })
  it('textos con parte variable', () => {
    setLanguage('en')
    expect(t('Mover a Hoja 2')).toBe('Move to Hoja 2')
    setLanguage('fr')
    expect(t('Borrar GEMMA')).toBe('Supprimer GEMMA')
  })
  it('idioma desconocido: español', () => {
    setLanguage('xx')
    expect(t('Exportar')).toBe('Exportar')
  })
  it('los diccionarios cubren lo mismo (lo que tiene el inglés lo tienen el francés y el portugués)', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['es', 'en', 'fr', 'pt'])
    const missing = (dict) => Object.keys(en).filter((k) => !(k in dict) && !/…$/.test(k) && !['Converger en Y', 'Bloquear la edición', 'Desbloquear la edición', 'Restablecer'].includes(k))
    expect(missing(fr)).toEqual([])
    expect(missing(pt)).toEqual([])
  })
})
