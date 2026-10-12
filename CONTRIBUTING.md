# Cómo contribuir

Gracias por querer ayudar. Grafcet Editor es una herramienta para enseñar automatismos: lo que más
se agradece son **fallos bien contados**, **ejemplos y ejercicios de clase**, **mejoras de la ayuda**
y **traducciones**. También código, claro.

- **Un fallo**: abre una [issue](https://github.com/maniel97/Grafcet-editor/issues/new/choose) con
  la plantilla «Fallo». Si puedes, adjunta el proyecto (`.json`) donde pasa.
- **Una duda, una idea a medio pensar o un ejercicio para compartir**:
  [Discussions](https://github.com/maniel97/Grafcet-editor/discussions).
- **Un cambio grande** (una función nueva, otro idioma, reorganizar código): abre antes una issue
  para hablarlo. Así nadie pierde trabajo. Lo que ya está previsto está en la
  [hoja de ruta](ROADMAP.md).

Al contribuir aceptas que tu aportación se publique con la misma licencia del proyecto
([GPL-3.0 o posterior](LICENSE)). Usar asistentes de IA está bien (el proyecto se hace así); tú
respondes de lo que envías: revisado y probado.

## Arrancar

Hace falta **Node.js 22** o posterior y un navegador Chromium (Chrome, Edge o Brave) para las pruebas
de navegador.

```bash
git clone https://github.com/maniel97/Grafcet-editor.git
cd Grafcet-editor
npm ci
npm run dev        # http://localhost:5173
```

## Pruebas

Antes de enviar un cambio, **pasa la suite completa** y comprueba que termina sin errores:

```bash
npm run test:quiet   # lógica (Vitest), navegador (Playwright) y aplicación instalable (PWA)
npm run lint         # oxlint
```

- Los cambios de lógica llevan su prueba en `tests/unit/`; los de interfaz, en `tests/e2e/`.
- Las pruebas de navegador se hacen sobre la versión compilada, como la que se publica.
- **Nada de pausas fijas** (`waitForTimeout`) para esperar a que algo pase: se espera a una condición
  real (`expect(...).toBeVisible()`, `expect.poll`, `stableBox` de `tests/e2e/helpers.js` para lo que
  se mueve). Si sospechas que una prueba falla solo a veces, `npm run test:stress` la repite con
  mucha carga.
- Si cambias la interfaz, mira cómo queda: **ningún texto puede pisar a otro**, tampoco en pantallas
  estrechas ni con la letra grande (Opciones).

## Dónde está cada cosa

La estructura general está en el [README](README.md#estructura). Lo más habitual:

| Para… | Mira en |
|---|---|
| reglas de la norma y Verificar | `src/lib/validation.js`, `src/lib/grafcetRules.js`, `src/lib/tips.js` |
| sintaxis de receptividades y simulación | `src/lib/sim/expression.js`, `src/lib/sim/engine.js` |
| el lienzo y los paneles | `src/components/GrafcetCanvas.jsx`, `src/components/PropertiesPanel.jsx` |
| dibujo de etapas, transiciones y acciones | `src/nodes/` |
| paso a ladder, ST y AWL | `src/lib/ladder/` |
| planta virtual | `src/components/SceneView.jsx`, `src/lib/sim/scene*.js` |
| esquema eléctrico y neumática | `src/components/elec/`, `src/lib/elec/` |
| ejemplos, ejercicios y tutoriales | `src/lib/examples.js`, `src/lib/exerciseBank.js`, `src/lib/tutorials.js` |
| wiki de ayuda | `src/help/` |
| formato del archivo `.json` | [docs/formato-proyecto.md](docs/formato-proyecto.md), `src/lib/projectFormat.js` |

## Cómo se escribe el código

- **Comentarios en español**, explicando el porqué (lo que no se ve leyendo el código). Mira cómo
  está escrito lo de alrededor y sigue igual: nombres, estilo, cantidad de comentarios.
- **La norma manda**: lo que se dibuja, se verifica o se simula sigue IEC 60848. Si algo no está
  claro en la norma, coméntalo en la issue.
- **Todo texto visible se traduce**: `t('Texto')` (ver [Traducciones](#traducciones)).
- **Menús sencillos**: lo que solo usa el profesorado o es muy especializado va detrás de
  Opciones > **Modo educativo**, no en la barra.
- **Sin dependencias nuevas** sin hablarlo antes: la aplicación funciona sin conexión y en un solo
  archivo (versión portable), y cada librería pesa.
- Saltos de línea `LF` y codificación UTF-8.
- **El formato del archivo es un compromiso**: los proyectos guardados tienen que seguir abriéndose.
  Un campo nuevo se documenta en [docs/formato-proyecto.md](docs/formato-proyecto.md) (una prueba
  lo exige); si un cambio hace que un editor anterior no entienda el archivo, sube la versión del
  formato y lleva su migración (ver el documento).

## Añadir un ejemplo

Los ejemplos están en `src/lib/examples.js` (diálogo Abrir > Ejemplos). Cada uno es un objeto con:

```js
{
  id: 'cinta-contador',          // único, en minúsculas y con guiones
  level: 2,                       // nivel (LEVELS, al principio del archivo)
  title: 'Cinta con contador',
  description: 'Qué enseña, en una frase.',
  tags: ['Contador', 'Planta'],
  build() {
    // step(id, número, x, y, acciones), trans(id, receptividad, x, y), links([[origen, destino]…])
    // o cycle([...]) para una secuencia lineal. Cuadrícula: etapa -> transición +100 px,
    // transición -> etapa +70 px.
    return { nodes, edges, plc: { scene } } // plc (variables, planta, esquema) es opcional
  },
}
```

- Los comentarios de la tabla de variables (qué es cada señal y qué hace cada etapa) van en
  `src/lib/exampleComments.js`: mejor explicar de más, son para aprender.
- Las pruebas (`tests/unit/examples.test.js`, `tests/unit/tips.test.js`) comprueban que cada ejemplo
  es **conforme a la norma, se simula, pasa a ladder sin avisos y Verificar no da consejos**.
- Los textos de los ejemplos (título, descripción, notas) están solo en español por ahora.
- Para enlazarlo desde un artículo de la wiki: un bloque ` ```ejemplo cinta-contador``` `.

## Añadir o cambiar un artículo de la wiki

La wiki está en `src/help/<idioma>/<id>.md` (es, en, fr, pt), y el índice, en `src/help/index.js`
(`SECTIONS`). El formato (Markdown sencillo) está explicado al principio de `src/help/Markdown.jsx`:
títulos, listas, tablas, recuadros `> **Ojo:** …`, enlaces a otros artículos `[texto](id)` y dos
bloques especiales:

- ` ```ejemplo <id>``` `: tarjeta con «Abrir en el editor».
- ` ```tutorial <id>``` `: tarjeta con «Hacer el tutorial».

Escribe para quien empieza: frases cortas, qué es, para qué sirve y qué pulsar exactamente.

**El artículo tiene que estar en los cuatro idiomas con la misma estructura** (mismos apartados,
mismo número de elementos en cada lista y tabla, mismos enlaces, bloques y código): una prueba lo
comprueba (`tests/unit/help.test.js`). Si no puedes traducirlo, dilo en el pull request y te
ayudamos.

## Traducciones

La interfaz se escribe en español en el código y cada idioma es un archivo de `src/locales/`. La guía
completa (también para añadir un idioma o traducir con un modelo de lenguaje) está en
[src/locales/LEEME.md](src/locales/LEEME.md). Lo esencial para quien programa:

```js
t('Abrir')                                  // texto visible
t('Hoja {n} de {total}', { n, total })      // con partes variables (nunca t(`… ${n}`))
const LABEL = N_('Etapa')  // …  t(LABEL)    // se define en un sitio y se traduce en otro
```

Después, `npm run i18n` pone al día los catálogos (añade los textos nuevos sin traducir y quita los
que ya no se usan) y `npm run i18n -- --check` comprueba que todo está al día: las pruebas fallan si
falta una traducción.

## Tutoriales

Los tutoriales guiados están en `src/lib/tutorials.js`. Cada paso dice qué es, para qué sirve y qué
pulsar (y la otra forma de hacerlo); el foco sigue a lo que toca hacer y el paso se da por hecho al
comprobarlo en la página. Cada tutorial lo hace entero un robot en `tests/e2e/ayuda.spec.js`: uno
nuevo lleva su prueba.

## Commits y pull requests

- **Un tema por pull request**, con una descripción de qué cambia y por qué. Si cambia la interfaz,
  una captura.
- **Mensajes de commit en español**: una primera línea que diga qué cambia («Asistente de
  temporizaciones en el panel de la transición») y, debajo, el porqué y lo que no sea evidente.
- Si cierra una issue: `Fixes #N` al final del mensaje.
- Si cierra algo de la [hoja de ruta](ROADMAP.md), marca su casilla.
- Cada envío a `main` se publica solo en <https://grafcet-editor.com>: por eso todo lo que entra
  tiene que pasar las pruebas. Las versiones (`0.1.0-alpha.N`) las saca el mantenedor: al sacar
  cada una, `npm run formato:guardar` guarda su proyecto de referencia para las pruebas del formato.

---

## Contributing (English summary)

Bug reports (with the `.json` project if possible), classroom examples, help articles and
translations are as welcome as code. Open an issue before large changes. Contributions are
published under GPL-3.0-or-later.

- **Setup**: Node.js 22+, `npm ci`, `npm run dev`. A Chromium browser is needed for e2e tests.
- **Before sending a change**: `npm run test:quiet` (unit, browser and PWA tests) and
  `npm run lint` must pass. No fixed sleeps in tests; no overlapping text in the UI.
- **Code**: comments in Spanish, explaining why; follow IEC 60848; every visible string goes through
  `t()`; no new dependencies without discussing them first.
- **Examples** live in `src/lib/examples.js` and must be conformant, simulable and free of
  Verificar tips. **Help articles** (`src/help/<lang>/<id>.md`) must exist in the four languages
  with the same structure. **UI translations**: `src/locales/` and `npm run i18n` (guide:
  `src/locales/LEEME.md`).
- **Commits** in Spanish, one topic per pull request, `Fixes #N` when it closes an issue. Every
  push to `main` is published to <https://grafcet-editor.com>.
