import { expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

// Abre el editor (perfil nuevo: sin autoguardado previo, con el diagrama de ejemplo) y, si se
// indica, carga un proyecto. Registra los errores de la consola para comprobarlos al final.
export async function openEditor(page, project) {
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
  await page.goto('/')
  await page.waitForSelector('.react-flow__node')
  if (project) {
    await page.locator('input[type=file]').setInputFiles(fixture(project))
    await page.waitForTimeout(400)
  }
  return errors
}

// Ids de las etapas activas en la simulación (las que llevan la marca de actividad).
export const activeSteps = async (page) =>
  (
    await page
      .locator('[aria-label="Etapa activa"]')
      .evaluateAll((els) => els.map((el) => el.closest('.react-flow__node').dataset.id))
  )
    .sort()
    .join(',')

export async function download(page, action) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), action()])
  return d
}

export const expectNoErrors = (errors) => expect(errors, errors.join('\n')).toEqual([])
