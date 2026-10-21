import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { download, expectNoErrors, fixture, openEditor, openExample } from './helpers'
import { attachmentsOf } from '../../src/lib/pdfAttach'

test('entregar varias prácticas: cuaderno con portada, índice, resumen, orden y cada proyecto dentro', async ({ page }) => {
  const errors = await openEditor(page)
  await openExample(page, /Taladradora/)
  await page.getByRole('button', { name: /Exportar/ }).click()
  await page.getByRole('menuitem', { name: /Entregar varias prácticas/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Entregar varias prácticas' })

  // El proyecto abierto y dos archivos (uno de ellos, un ejercicio del alumnado).
  await dialog.getByRole('button', { name: 'El proyecto abierto' }).click()
  await dialog.getByLabel('Archivos de las prácticas').setInputFiles([fixture('ejercicio-alumno.json'), fixture('neumatica-planta.json')])
  const list = dialog.getByRole('list', { name: 'Orden de las prácticas' })
  await expect(list.getByRole('listitem')).toHaveCount(3)
  // El mismo proyecto otra vez: no se repite.
  await dialog.getByRole('button', { name: 'El proyecto abierto' }).click()
  await expect(dialog).toContainText('ya estaba en el cuaderno')
  await expect(list.getByRole('listitem')).toHaveCount(3)

  const preview = dialog.getByLabel('Vista previa del cuaderno')
  const pages = preview.getByRole('img', { name: /^Página \d+ de \d+$/ })
  await expect(pages.first()).toBeVisible({ timeout: 30000 })
  await dialog.getByRole('textbox', { name: 'Alumno/a' }).fill('Ana Pérez')
  await expect(pages.nth(0)).toContainText('Cuaderno de prácticas')
  await expect(pages.nth(0)).toContainText('3 prácticas')
  await expect(pages.nth(0)).toContainText('Ana Pérez')
  await expect(pages.nth(1)).toContainText('Índice')
  await expect(pages.nth(1)).toContainText('Práctica nº 1. Taladradora')
  await expect(pages.nth(2)).toContainText('Resumen')
  // Cada práctica con su grafcet, dibujado sin abrirla (el ejercicio sin empezar no tiene).
  await expect(pages.nth(2)).toContainText('0 de 1')
  for (const n of [1, 3]) await expect(preview).toContainText(`${n}.1. Grafcet`)
  await expect(preview).not.toContainText('2.1. Grafcet')
  await expect(pages.nth(3).locator('image')).toHaveCount(1)
  await pages.nth(3).screenshot({ path: 'test-results/cuaderno-grafcet.png' })

  // Secciones juntas (por defecto) o cada una en su página: más páginas.
  const together = await pages.count()
  await pages.nth(4).screenshot({ path: 'test-results/cuaderno-juntas.png' })
  await dialog.getByRole('checkbox', { name: 'Juntar las secciones (menos páginas)' }).uncheck()
  await expect.poll(() => pages.count()).toBeGreaterThan(together)
  await dialog.getByRole('checkbox', { name: 'Juntar las secciones (menos páginas)' }).check()
  await expect.poll(() => pages.count()).toBe(together)

  // Reordenar: la segunda sube a la primera posición.
  const second = await list.getByRole('listitem').nth(1).getByRole('textbox').inputValue()
  await list.getByRole('listitem').nth(1).getByRole('button', { name: 'Subir' }).click()
  await expect(pages.nth(1)).toContainText(`Práctica nº 1. ${second.replace(/^Práctica\s*\d+\s*[.:-]\s*/i, '')}`)

  // PDF con los tres proyectos dentro, en el orden del cuaderno.
  const file = await download(page, () => dialog.getByRole('button', { name: 'Guardar PDF' }).click())
  const bytes = new Uint8Array(readFileSync(await file.path()))
  const inside = attachmentsOf(bytes).map((a) => a.name)
  expect(inside).toHaveLength(3)
  expect(inside.every((n) => /^0[1-3]-[a-z0-9-]+\.json$/.test(n))).toBe(true)
  await page.screenshot({ path: 'test-results/cuaderno.png' })
  expectNoErrors(errors)
})
