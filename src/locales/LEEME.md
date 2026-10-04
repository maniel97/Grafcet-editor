# Traducir Grafcet Editor

Los textos de la interfaz se escriben en **español** en el código y cada idioma es un archivo JSON
en esta carpeta: `en.json` (inglés), `fr.json` (francés), `pt.json` (portugués)…

Cada archivo es una lista plana **«texto en español» → «traducción»**:

```json
{
  "Abrir": "Open",
  "Mover a {hoja}": "Move to {hoja}",
  "Texto aún sin traducir": ""
}
```

- **La clave (a la izquierda) no se toca nunca**: es el texto original. Solo se traduce el valor.
- **Un valor vacío (`""`) significa «sin traducir»**: la aplicación muestra el español.
- **Marcadores `{nombre}`**: son partes variables (un número, el nombre de una hoja…). Se copian tal
  cual (mismo nombre, con sus llaves) y se colocan donde los pida el idioma. Una prueba comprueba que
  no falte ninguno.
- **Formato del texto**: algunos textos llevan formato Markdown (`**negrita**`, `` `código` ``,
  listas con `- `). Se conserva el formato y no se traduce lo que está entre acentos graves
  (`` `Marcha` ``, `` `X1` ``): son nombres de variables o expresiones.
- **Vocabulario técnico**: se usan los términos de la norma IEC 60848 en cada idioma (etapa = step /
  étape / etapa; transición = transition; receptividad = receptivity / réceptivité / receptividade;
  acción = action / ação; divergencia en O / en Y = OR / AND divergence…). «Grafcet» no se traduce.

## Añadir un idioma

1. Copia `en.json` con el código del idioma (p. ej. `de.json`) y vacía los valores (o tradúcelos).
2. Añádelo a `LANGUAGES` y a `DICTIONARIES` en `src/lib/i18n.js`.
3. Ejecuta `npm run i18n`: pone el archivo al día con todos los textos del código.

## Para quien programa

- Texto visible: `t('Texto')`; con partes variables, `t('Hoja {n} de {total}', { n, total })`.
  Nunca `t(`texto ${variable}`)`: el texto debe ser fijo para poder traducirlo.
- Si en ese archivo `t` ya es el nombre de una variable (p. ej. una transición), se importa con otro
  nombre: `import { t as tr } from './i18n'` y `tr('Texto')` (el extractor también lo reconoce).
- Texto que se define en un sitio y se traduce en otro (etiquetas de un menú, de un botón que
  traduce por dentro): `N_('Texto')` al definirlo y `t(etiqueta)` al mostrarlo.
- Atributos JSX de un componente nuevo: `node scripts/i18n-wrap.mjs src/components/Archivo.jsx`
  (cambia `title="…"` por `title={t('…')}` o `{N_('…')}`; revisa el resultado).
- Después: `npm run i18n` (pone al día los catálogos: añade los textos nuevos vacíos y quita los
  que ya no se usan). Las pruebas (`npm test`) fallan si los catálogos no están al día.

## Traducir con un modelo de lenguaje (LLM)

Pásale el archivo del idioma (con los valores vacíos que falten) y estas instrucciones:

> Traduce al <idioma> los valores vacíos de este JSON. Es la interfaz de un editor de GRAFCET
> (IEC 60848) para alumnos de FP de automatismos. Reglas: no cambies las claves; conserva
> exactamente los marcadores entre llaves `{…}` y el formato Markdown; no traduzcas lo que va entre
> acentos graves; usa la terminología de IEC 60848 en <idioma>; sé breve en los textos de botones.
> Devuelve el JSON completo.

Después ejecuta `npm run i18n -- --check` y `npm test` para comprobarlo.

## Plataformas de traducción

El formato es «JSON plano clave-valor» (monolingüe, con `es.json` como origen), el que admiten
Weblate, Crowdin y Tolgee sin configuración especial.

## Artículos de la ayuda (wiki)

Los artículos no van en estos JSON: son archivos Markdown en `src/help/<idioma>/<id>.md`. Para
traducir uno, copia `src/help/es/<id>.md` a la carpeta del idioma (`src/help/en/`…) y tradúcelo
entero, título incluido. Lo que no esté traducido se muestra en español. No traduzcas lo que va
entre acentos graves (`5s/X2`), los destinos de los enlaces `[texto](destino)` ni la primera
línea de los bloques ```` ```ejemplo … ```` y ```` ```tutorial … ````.
