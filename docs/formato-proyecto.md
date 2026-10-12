# Formato del archivo de proyecto

Un proyecto de Grafcet Editor es un objeto JSON. Se guarda tal cual en el archivo `.json`
(Guardar), y con la misma forma va dentro de un PDF (adjunto de las hojas de ejercicio y los
dosieres), en los enlaces para compartir (comprimido, detrás de `#p=`), en el autoguardado del
navegador y en «Trabajos anteriores».

**Compromiso de compatibilidad**: desde la versión 1.0, un proyecto guardado con una versión del
editor se abre en todas las posteriores. Hasta entonces se procura igual: cada cambio de formato
lleva su migración y las pruebas abren proyectos guardados con versiones anteriores (ver
[Versiones y migraciones](#versiones-y-migraciones)).

El código: `src/lib/projectFormat.js` (versión y migraciones), `src/lib/projectFile.js` (guardar y
abrir). Las pruebas: `tests/unit/projectFormat.test.js`.

## Primer nivel

```json
{
  "format": "grafcet-editor",
  "version": 1,
  "app": "0.1.0-alpha.9",
  "savedAt": "2026-10-12T10:00:00.000Z",
  "name": "Taladradora",
  "nodes": [],
  "edges": [],
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "plc": {}
}
```

| Campo | Qué es |
|---|---|
| `format` | Siempre `"grafcet-editor"`. Opcional al abrir (los autoguardados no lo llevan). |
| `version` | Versión del **formato** (número entero). Sin ella, se toma la 1. |
| `app` | Versión del editor que lo guardó. Informativa: para abrirlo solo cuenta `version`. |
| `savedAt` | Fecha y hora de guardado (ISO 8601). Informativa. |
| `name` | Nombre del proyecto (opcional). |
| `nodes` | Elementos del diagrama: etapas, transiciones, notas, marcos y la tabla de variables. Obligatorio. |
| `edges` | Enlaces entre etapas y transiciones. Obligatorio. |
| `viewport` | Encuadre del lienzo al guardar (`x`, `y`, `zoom`). Opcional: sin él, se encuadra todo. |
| `plc` | Todo lo demás: variables, direcciones, planta, esquema eléctrico, ejercicio… Opcional. |

Lo único imprescindible para que un archivo se reconozca como proyecto es que `nodes` y `edges`
sean listas. Los campos que el editor no conoce dentro de los nodos, los enlaces y `plc` se conservan
(y se vuelven a guardar); los de primer nivel que no están en esta tabla se descartan al abrir.

## Versiones y migraciones

- `version` es la versión del **formato**, no la del editor. Solo sube cuando un cambio hace que un
  editor anterior no entienda bien lo que guarda el nuevo: un campo que cambia de forma o de
  significado, algo que se mueve de sitio. **Añadir un campo opcional nuevo no la sube**: los
  editores anteriores lo ignoran.
- Al subirla, se añade a `MIGRATIONS` (`src/lib/projectFormat.js`) una función pura que pasa un
  proyecto de la versión anterior a la nueva, y se documenta aquí el cambio.
- Al abrir, se aplican por orden las migraciones desde la versión del archivo hasta la actual.
- Un archivo con una versión **más nueva** que la del editor no se abre: se avisa de que se guardó
  con una versión más nueva y de que hay que recargar la página para tener la última.
- Al sacar cada versión del editor, `npm run formato:guardar` guarda su proyecto de referencia en
  `tests/fixtures/formato/` (con su resumen). Las pruebas comprueban que todos los guardados siguen
  abriéndose con el mismo contenido, conformes a la norma y simulables.

### Formato 1

Es el actual. Las primeras versiones del editor guardaban algunas cosas de otra manera sin cambiar
el número; se reconocen por su forma y se adaptan siempre al abrir:

| Antes | Ahora |
|---|---|
| Acciones como nodos sueltos (`type: "action"`, texto en `data.label`) unidos a su etapa | Acciones de la etapa (`data.actions`) |
| Enlaces con `type: "step"` | `type: "grafcet"` |
| Planta por modelos fijos en `plc.plant` (cilindros, cinta, depósito) | Escena de elementos libres (`plc.scene`) |
| Asignaciones (`C:=C+1`) guardadas como acción continua | Memorizadas al activar (`stored-on`) |

## Nodos

Campos comunes de cada elemento de `nodes`:

| Campo | Qué es |
|---|---|
| `id` | Identificador único en el proyecto (texto). |
| `type` | `step`, `transition`, `note`, `frame` o `variables`. |
| `position` | Posición en el lienzo: `{ x, y }` en píxeles (cuadrícula de 10). |
| `data` | Datos propios de cada tipo (abajo). |
| `width`, `height` | Tamaño fijado a mano (notas y marcos). |
| `zIndex` | Orden de dibujo (los marcos van detrás: `-1`). |
| `deletable` | `false` en la tabla de variables (no se borra con Supr). |
| `selected`, `dragging`, `resizing`, `measured` | Estado de la interfaz (React Flow) que puede quedar guardado. Se ignora al abrir. |

`data.sheet` (en todos los tipos): id de la hoja del proyecto donde está el elemento (ver
`plc.sheets`). Sin él, la hoja activa.

### Etapa (`step`)

| Campo de `data` | Qué es |
|---|---|
| `label` | Número o nombre de la etapa (`"0"`, `"1"`, `"E1"`, `"M1"`). Su variable es `X` + label. |
| `initial` | `true` si es etapa inicial. |
| `actions` | Lista de acciones (abajo). |
| `macro` | `true` si es una macroetapa (se detalla en el marco de expansión `M` + número). |
| `encapsulating` | `true` si es una etapa encapsulante (su grafcet encapsulado va en un marco). |
| `activationLink` | `true` si es una etapa con enlace de activación (`*`) dentro de un grafcet encapsulado. |

Cada acción es un objeto `{ text, kind, condition }` (también se acepta un texto suelto, que es una
acción continua):

| Campo | Qué es |
|---|---|
| `text` | La acción: una salida (`Motor`), una asignación (`C:=C+1`) o una orden de forzado (`F/G2{3}`). |
| `kind` | `continuous`, `conditional`, `stored-on` (memorizada al activar), `stored-off` (al desactivar) o `event` (al evento). |
| `condition` | Condición de las condicionadas y evento de las de `event` (`↑b`). |

### Transición (`transition`)

| Campo de `data` | Qué es |
|---|---|
| `condition` | Receptividad, con la sintaxis del editor (`a · b`, `↑P`, `5s/X2`, `[C >= 3]`; ver la ayuda «Transiciones y receptividades»). |

### Nota (`note`)

| Campo de `data` | Qué es |
|---|---|
| `text` | Texto con formato ligero (`# título`, `- lista`, `**negrita**`, `` `código` ``). |
| `color` | `yellow`, `blue`, `green` o `gray`. |

### Marco (`frame`)

Rodea un grafcet parcial, la expansión de una macroetapa o un grafcet encapsulado (IEC 60848). Sus
elementos son los que caen dentro; el marco no los agrupa.

| Campo de `data` | Qué es |
|---|---|
| `kind` | `grafcet` (parcial), `macro` (expansión de macroetapa) o `encapsulation` (encapsulado). |
| `name` | Nombre: `G1`, `M1`… |
| `step` | En un encapsulado: número de su etapa encapsulante. |

### Tabla de variables (`variables`)

Única en el proyecto, con `id: "variables-table"`.

| Campo de `data` | Qué es |
|---|---|
| `showComments` | Muestra la columna de comentarios. |
| `autoPlace` | Solo en los ejemplos: `"spread"` o `"left"`, para colocarla al abrirlos. |

## Enlaces

| Campo | Qué es |
|---|---|
| `id` | Identificador único (texto). |
| `source`, `target` | Ids de los nodos que une (de etapa a transición o de transición a etapa). |
| `type` | Siempre `"grafcet"`. |
| `sourceHandle`, `targetHandle` | Conector usado (normalmente `null`). |
| `data.reference` | `true`: se dibuja como referencia de enlace (cortado, con flecha), como dibuja la norma los enlaces largos. |
| `selected` | Estado de la interfaz. Se ignora al abrir. |

## plc

Todas las secciones son opcionales; al abrir, faltan las que no se usan.

| Campo | Qué es |
|---|---|
| `variables` | Tabla de variables: tipo, dirección y comentario de cada una. |
| `steps` | Dirección y comentario de cada etapa. |
| `scheme` | Formato de direcciones: `siemens` (S7-300/1200), `iec` o `s7200`. |
| `showAddresses` | Mostrar las direcciones en el diagrama. |
| `stepPrefix` | Prefijo de las marcas de etapa al asignar direcciones. |
| `sheets` | Hojas del proyecto. |
| `scene` | Planta virtual. |
| `electrical` | Esquema eléctrico, neumático e hidráulico. |
| `scenarios` | Escenarios de prueba de la simulación. |
| `sequence` | Secuencia esperada de los cilindros (`A+ B+ B- A-`), para el diagrama espacio-fase. |
| `exercise` | Ejercicio con autocorrección. |
| `dossier` | Opciones y textos del dosier de la práctica. |
| `guide` | Guion de prácticas (del profesorado). |
| `gemma` | Configuración de la GEMMA. |
| `cpu` | Programa del autómata emulado (S7-200). |
| `titleBlock` | Cajetín de los planos en PDF. |
| `plant` | Formato antiguo de la planta (ver [Formato 1](#formato-1)). |

### Variables y etapas

`plc.variables` es un diccionario por nombre de variable:

```json
"variables": {
  "Marcha": { "type": "input", "address": "I0.0", "comment": "Pulsador verde NA" },
  "Nivel": { "type": "analogIn", "address": "IW64", "signal": "4-20mA", "min": 0, "max": 100, "unit": "%" }
}
```

| Campo | Qué es |
|---|---|
| `type` | `input`, `output`, `memory`, `timer`, `counter`, `analogIn` o `analogOut`. Sin él, el editor lo deduce del grafcet. |
| `address` | Dirección en el autómata (`I0.0`, `Q0.1`, `MW100`…). |
| `comment` | Comentario. |
| `signal`, `min`, `max`, `unit` | Solo analógicas: señal (`4-20mA` o `0-10V`), rango y unidad. |

`plc.steps` es un diccionario por **id del nodo** de la etapa (no por su número):
`{ "s0": { "address": "M0.0", "comment": "Reposo" } }`, con los campos `address` y `comment`.

### Hojas

`plc.sheets`: lista de `{ id, name }`. Sin ella, una sola hoja (`h1`). Cada nodo dice en
`data.sheet` en qué hoja está.

### Planta (`scene`)

| Campo | Qué es |
|---|---|
| `elements` | Elementos de la planta: `{ id, type, x, y, rot, ... }`. `x`, `y`: punto de anclaje en px; `rot`: 0, 90, 180 o 270. El resto de propiedades depende del tipo (variable que usa, contacto, color, tiempos…): están en `SCENE_TYPES` (`src/lib/sim/scene.js`). |
| `gravity` | `true`: vista de frente con gravedad (en vez de desde arriba). |
| `view` | `"iso"`: vista isométrica. |
| `relief` | `true`: dibujo con relieve. |

### Esquema eléctrico (`electrical`)

| Campo | Qué es |
|---|---|
| `enabled` | Conectar el esquema con el autómata y la planta al simular. |
| `components` | Componentes: `{ id, type, x, y, ... }`. Las propiedades de cada tipo están en `ELEC_TYPES` (`src/lib/elec/catalog.js`); `sheet`: hoja del esquema. |
| `wires` | Cables: `{ id, from: { c, t }, to: { c, t } }` (componente y borne de cada extremo). |
| `sheets` | Hojas del esquema: lista de `{ id, name }`. |
| `frame` | Dibujar el marco de la hoja; `frameCols`: número de columnas. |
| `wireNumbers` | Numerar los cables. |

### Escenarios y secuencia

`plc.scenarios`: lista de `{ id, name, duration, events }`; `events` es una lista de cambios de
entradas `{ t, name, value }` (instante en segundos, variable y valor). `plc.sequence`: texto con la
secuencia esperada de los cilindros.

### Ejercicio (`exercise`)

Lo prepara el profesorado (Exportar > Ejercicio). Los campos y sus valores por defecto están en
`DEFAULT_EXERCISE` (`src/lib/exercise.js`):

| Campo | Qué es |
|---|---|
| `title`, `statement` | Título y enunciado (Markdown sencillo). |
| `parts` | Qué recibe hecho el alumnado: `plant`, `variables`, `electrical`, cada uno `none`, `given` o `locked`. |
| `checks` | Qué se comprueba (norma, secuencia, escenarios de comportamiento, requisitos). |
| `hints`, `grade` | Pistas y nota. |
| `processData` | Anotar los totales del proceso (veces que se comprueba, minutos…). |
| `sheet` | Cabecera de la hoja de prácticas (asignatura, curso, ciclo, centro, profesor). |
| `student` | `true` en la copia del alumnado. |
| `sealed` | Comprobaciones selladas (en la copia del alumnado; la solución no viaja). |
| `hintsShown`, `process` | Del alumnado: pistas vistas y totales del proceso. |
| `frozen` | Comprobaciones congeladas al preparar el ejercicio. |

### Dosier, guion, GEMMA, autómata y cajetín

- `dossier`: opciones y textos del dosier (`DEFAULT_DOSSIER`, `src/lib/dossier.js`): `page`,
  `sections` (apartados que salen), `cover` (datos de la portada), `statement`, `theory`,
  `improvements`, `problems`, `ladderListing` y `scenario`.
- `guide`: guion de prácticas (`DEFAULT_GUIDE`, `src/components/GuideDialog.jsx`): `title`, `sheet`,
  `rules`, `practices` (lista de prácticas) y `currentGuided`.
- `gemma`: `{ production, states, transitions }` (`src/lib/gemma.js`): grafcet de producción, estados
  usados con su orden de forzado y pasos entre estados `{ from, to, condition }`.
- `cpu`: `{ enabled, source, text, name }`: si se emula el autómata S7-200, con el programa generado
  (`source: "generated"`) o uno cargado de archivo (`"file"`, con su texto y nombre).
- `titleBlock`: `{ company, project, author, revision, date, drawing }`, los datos del cajetín.

### Planta antigua (`plant`)

Solo en proyectos de las primeras versiones: lista de modelos `{ id, type, name, extend, retract,
retracted, extended, time }`. Al abrir se convierte en `scene` (ver [Formato 1](#formato-1)).

## Lista de campos

Todos los campos que se guardan, como rutas (`[]`: cada elemento de una lista; `*`: cada clave de un
diccionario; `nodes[step]`: los nodos de ese tipo). Una prueba comprueba que lo que guardan el
proyecto de referencia, los ejemplos, los ejercicios y los guiones está en esta lista: un campo nuevo
se documenta aquí al añadirlo. Las listas con muchos tipos (elementos de la planta, componentes del
esquema) se documentan por remisión al código.

```campos
format
version
app
savedAt
name
viewport
nodes[].id
nodes[].type
nodes[].position
nodes[].position.x
nodes[].position.y
nodes[].width
nodes[].height
nodes[].zIndex
nodes[].deletable
nodes[].selected
nodes[].dragging
nodes[].resizing
nodes[].measured
nodes[step].data
nodes[step].data.label
nodes[step].data.initial
nodes[step].data.actions
nodes[step].data.actions[]
nodes[step].data.actions[].text
nodes[step].data.actions[].kind
nodes[step].data.actions[].condition
nodes[step].data.macro
nodes[step].data.encapsulating
nodes[step].data.activationLink
nodes[step].data.sheet
nodes[transition].data
nodes[transition].data.condition
nodes[transition].data.sheet
nodes[note].data
nodes[note].data.text
nodes[note].data.color
nodes[note].data.sheet
nodes[frame].data
nodes[frame].data.kind
nodes[frame].data.name
nodes[frame].data.step
nodes[frame].data.sheet
nodes[variables].data
nodes[variables].data.showComments
nodes[variables].data.autoPlace
nodes[variables].data.sheet
nodes[action].data
nodes[action].data.label
edges[].id
edges[].source
edges[].target
edges[].type
edges[].sourceHandle
edges[].targetHandle
edges[].data
edges[].data.reference
edges[].selected
plc
plc.variables
plc.variables.*
plc.variables.*.type
plc.variables.*.address
plc.variables.*.comment
plc.variables.*.signal
plc.variables.*.min
plc.variables.*.max
plc.variables.*.unit
plc.steps
plc.steps.*
plc.steps.*.address
plc.steps.*.comment
plc.scheme
plc.showAddresses
plc.stepPrefix
plc.sheets
plc.sheets[]
plc.sheets[].id
plc.sheets[].name
plc.scene
plc.scene.elements
plc.scene.elements[]
plc.scene.gravity
plc.scene.view
plc.scene.relief
plc.electrical
plc.electrical.enabled
plc.electrical.components
plc.electrical.components[]
plc.electrical.wires
plc.electrical.wires[]
plc.electrical.sheets
plc.electrical.sheets[]
plc.electrical.frame
plc.electrical.frameCols
plc.electrical.wireNumbers
plc.scenarios
plc.scenarios[]
plc.scenarios[].id
plc.scenarios[].name
plc.scenarios[].duration
plc.scenarios[].events
plc.scenarios[].events[]
plc.sequence
plc.exercise
plc.exercise.title
plc.exercise.statement
plc.exercise.parts
plc.exercise.checks
plc.exercise.hints
plc.exercise.grade
plc.exercise.processData
plc.exercise.sheet
plc.exercise.student
plc.exercise.sealed
plc.exercise.hintsShown
plc.exercise.process
plc.exercise.frozen
plc.dossier
plc.dossier.page
plc.dossier.sections
plc.dossier.cover
plc.dossier.statement
plc.dossier.theory
plc.dossier.improvements
plc.dossier.problems
plc.dossier.ladderListing
plc.dossier.scenario
plc.guide
plc.guide.title
plc.guide.sheet
plc.guide.rules
plc.guide.practices
plc.guide.practices[]
plc.guide.currentGuided
plc.gemma
plc.gemma.production
plc.gemma.states
plc.gemma.transitions
plc.gemma.transitions[]
plc.cpu
plc.cpu.enabled
plc.cpu.source
plc.cpu.text
plc.cpu.name
plc.titleBlock
plc.titleBlock.company
plc.titleBlock.project
plc.titleBlock.author
plc.titleBlock.revision
plc.titleBlock.date
plc.titleBlock.drawing
plc.plant
plc.plant[]
plc.plant[].id
plc.plant[].type
plc.plant[].name
plc.plant[].extend
plc.plant[].retract
plc.plant[].retracted
plc.plant[].extended
plc.plant[].time
```

---

## Project file format (English summary)

A project is a JSON object: `{ format: "grafcet-editor", version, app, savedAt, name, nodes, edges,
viewport, plc }`. Only `nodes` and `edges` (arrays) are required. `version` is the **file format**
version (integer, currently 1; missing means 1); `app` is the editor version that saved it
(informative). The same object is used in `.json` files, PDF attachments, share links (compressed),
autosave and the recent-work list.

- **Nodes**: `step` (`label`, `initial`, `actions` [`{ text, kind, condition }`], `macro`,
  `encapsulating`, `activationLink`), `transition` (`condition`), `note` (`text`, `color`), `frame`
  (`kind`, `name`, `step`) and the single `variables` table. `data.sheet` places a node on a sheet.
- **Edges**: `{ id, source, target, type: "grafcet" }`, optional `data.reference`.
- **plc**: variables table (keyed by name), step addresses (keyed by node id), addressing scheme,
  sheets, virtual plant (`scene`), electrical diagram, test scenarios, expected sequence, exercise,
  dossier, practice guide, GEMMA, emulated CPU and title block. Element-specific properties of the
  plant and the electrical diagram are documented in the code (`SCENE_TYPES`, `ELEC_TYPES`).
- **Compatibility**: from 1.0 on, files saved by any version open in all later ones. Adding an
  optional field does not change `version`; changing the shape or meaning of a field does, together
  with a migration in `MIGRATIONS` (`src/lib/projectFormat.js`). Files from a newer format are
  refused with a clear message. `npm run formato:guardar` stores a reference project for each release
  in `tests/fixtures/formato/`, and the tests open all of them.
- The list of fields above (```campos block) is checked by the tests: every saved field must be
  listed.
