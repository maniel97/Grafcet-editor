// Guarda el proyecto de referencia del formato con la versión actual del editor (al sacar una
// versión): tests/fixtures/formato/<versión>.json y su resumen. Las pruebas comprueban después que
// todos los guardados siguen abriéndose igual (tests/unit/projectFormat.test.js).
//
//   npm run formato:guardar
import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/projectFormat.test.js', '-t', 'guarda el proyecto de referencia'], {
  stdio: 'inherit',
  env: { ...process.env, FORMATO_GUARDAR: '1' },
})
process.exit(result.status ?? 1)
