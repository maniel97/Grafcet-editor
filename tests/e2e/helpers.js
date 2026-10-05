import { expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

export const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))

// Abre el editor (perfil nuevo: sin autoguardado previo, con el diagrama de ejemplo) y, si se
// indica, carga un proyecto. Registra los errores de la consola para comprobarlos al final.
// tour: dejar que se ofrezca la visita guiada de la primera vez (por defecto, ya vista).
// education: con el modo educativo activado (menús de ejercicios, guiones y entregas).
export async function openEditor(page, project, { tour = false, education = false } = {}) {
  const errors = []
  if (!tour) await page.addInitScript(() => localStorage.setItem('grafcet-tour', 'visto'))
  if (education) await page.addInitScript(() => localStorage.setItem('grafcet-editor:settings', JSON.stringify({ education: true })))
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
// Se ignoran las marcas que React acaba de desmontar (sin nodo padre): pasa si se redibuja justo
// entre la búsqueda y la lectura, y haría fallar la prueba de forma intermitente.
export const activeSteps = async (page) =>
  (
    await page
      .locator('[aria-label="Etapa activa"]')
      .evaluateAll((els) => els.map((el) => el.closest('.react-flow__node')?.dataset.id).filter(Boolean))
  )
    .sort()
    .join(',')

export async function download(page, action) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), action()])
  return d
}

export const expectNoErrors = (errors) => expect(errors, errors.join('\n')).toEqual([])

// Guarda desde el diálogo de exportación (con vista previa) en el formato elegido.
export async function saveFromDialog(page, format) {
  const dialog = page.getByRole('dialog', { name: 'Exportar', exact: true })
  await dialog.getByRole('radio', { name: format.toUpperCase(), exact: true }).click()
  await expect(dialog.getByRole('button', { name: `Guardar ${format.toUpperCase()}` })).toBeEnabled()
  return download(page, () => dialog.getByRole('button', { name: `Guardar ${format.toUpperCase()}` }).click())
}

// Pasos que se repiten en muchas pruebas.

// Abre un ejemplo (Abrir > Ejemplos…). `name`: texto o expresión del botón del ejemplo.
export async function openExample(page, name) {
  await page.getByTitle('Abrir un proyecto, un ejemplo o un trabajo anterior').click()
  await page.getByRole('menuitem', { name: /Ejemplos/ }).click()
  // Si el nombre vale para varios (p. ej. «Taladradora» y «Taladradora con marcha de
  // verificación»), el de título más corto: el que se buscaba.
  const buttons = page.getByRole('button', { name })
  await buttons.first().waitFor()
  const titles = await buttons.evaluateAll((list) => list.map((b) => b.querySelector('span')?.textContent?.length ?? 999))
  await buttons.nth(titles.indexOf(Math.min(...titles))).click()
  // La tabla de variables se coloca y la vista se reencuadra un instante después de abrirse:
  // se espera a que termine (si no, un clic podría caer donde ya no está lo buscado).
  await page.locator('[data-auto-place="pending"]').waitFor({ state: 'detached' })
  let last = ''
  await expect
    .poll(async () => {
      const now = await page.locator('.react-flow__viewport').getAttribute('style')
      const stable = now === last
      last = now
      return stable
    }, { intervals: [100] })
    .toBe(true)
}

// Abre el diálogo de exportación en un formato ('PNG', 'SVG' o 'PDF') y lo devuelve.
export async function openExport(page, format) {
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: new RegExp(format) }).click()
  return page.getByRole('dialog', { name: 'Exportar', exact: true })
}

// Abre la tabla de variables y devuelve el diálogo.
export async function openVariables(page) {
  await page.getByTitle(/Tabla de variables: direcciones/).click()
  return page.getByRole('dialog', { name: 'Tabla de variables' })
}

// Carga un proyecto desde un objeto (sin archivo en disco).
export async function loadProject(page, project) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'proyecto.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'grafcet-editor', version: 1, ...project })),
  })
  await page.waitForTimeout(400)
}
