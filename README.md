# Grafcet Editor

Editor web de diagramas Grafcet (IEC 60848) que funciona 100 % en el navegador: sin servidor y
sin límites de exportación.

## Arrancar

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # versión de producción en dist/
```

## Pruebas

```bash
npm test           # lógica (Vitest): norma, trazado, variables, simulación, ladder… (< 1 s)
npm run test:e2e   # navegador (Playwright): simulador, ladder, barra, encuadre, bloqueo
npm run test:all   # ambas: pasarlas antes de unir una rama a main
npm run test:perf  # rendimiento al arrastrar (PERF_STEPS=120 por defecto; versión de producción)
```

Las pruebas de navegador usan un Chromium ya instalado (Brave, Chrome o Edge; o
`PW_BROWSER_PATH`) y arrancan su propio servidor.

## Funciones (hito `hito-editor-v1`)

- **Elementos IEC 60848**: etapas (inicial, macroetapa), transiciones con receptividad (negación
  con raya, flancos ↑ ↓, temporización `5s/X2`), acciones (continua, condicionada, memorizada en
  activación / desactivación, al evento).
- **Estructuras**: divergencias y convergencias en O y en Y (doble línea), bucles por la
  izquierda con flecha y saltos de etapas, trazados automáticamente según la norma.
- **Reglas de la norma aplicadas al editar**: alternancia etapa / transición, una transición no
  puede volver atrás y continuar a la vez, etc. Panel **Verificar** con errores y avisos.
- **Edición rápida**: botones `+` con vista previa, menú contextual, panel de propiedades con
  atajos, copiar / pegar / duplicar renumerando, deshacer / rehacer, autoguardado, ayuda (`?`).
- **Tabla de variables**: etapas → marcas (X0 → M0.0), entradas, salidas, marcas,
  temporizadores y contadores con direcciones Siemens o IEC 61131-3, asignación automática,
  CSV, y tabla editable sobre el propio lienzo.
- **Archivos**: guardar / abrir proyecto `.json`; exportar PNG, SVG y PDF (con tamaño de página,
  orientación y vista previa).
- **Abrir**: ejemplos listos (taladradora, cilindros A+B+A−B−, semáforo, mezcladora con O e Y) y
  trabajos anteriores (lo que había antes de abrir o limpiar se guarda solo en el navegador).
- **Notas** de texto en el lienzo; **alinear y espaciar** una selección; uso **táctil**
  (pulsación larga = menú contextual, doble toque = editar, elementos más grandes).
- **Accesibilidad**: tipo de letra (incluidas Atkinson Hyperlegible y OpenDyslexic) y tamaño de
  interfaz y diagrama.

## Simulador

Botón **Simular**: ejecuta el grafcet en el navegador según las reglas de evolución de
IEC 60848 (validación, franqueo simultáneo, prioridad de la activación, evolución fugaz hasta
situación estable; acciones continuas solo en situación estable, memorizadas también en la
fugaz). Interpreta `·` `+` `!` `↑` `↓`, `Xn`, temporizaciones `5s/X2`, comparaciones y
asignaciones `A:=1`, `C:=C+1`.

Panel con marcha / pausa / paso a paso / +1 s / reinicio y velocidad, entradas con interruptor
o pulsador (teclas 1–9), salidas, marcas, temporizaciones, etapas activas, cronograma y
registro de franqueos. El motor (`src/lib/sim/`) es puro y no depende de la interfaz.

## Paso a ladder

Botón **Ladder**: traduce el grafcet por el método de una marca por etapa con SET/RESET, en
secciones ordenadas para que el ciclo del autómata respete la norma (todas las condiciones de
franqueo antes de evolucionar; desactivación antes que activación):

1. Inicialización (primer ciclo) · 2. Auxiliares (flancos de expresiones compuestas) ·
3. Condiciones de franqueo (`Tr_n`) · 4. Desactivación · 5. Activación · 6. Temporizaciones
(`TON`) · 7. Acciones memorizadas · 8. Salidas.

Las negaciones de grupo se convierten en contactos simples (De Morgan); las variables numéricas
(`C:=C+1`, `N >= 3`) usan palabras (`MW100`). Exporta el esquema (SVG, PNG, PDF A4 paginado
entre segmentos) y el programa en **Texto Estructurado** (IEC 61131-3) y **AWL** de S7-300/400
(nemotécnica alemana o inglesa, con direcciones o símbolos). Código en `src/lib/ladder/`.

## Estructura

- `src/components/` — interfaz: lienzo, barra, paneles, diálogos, menú contextual.
- `src/nodes/`, `src/edges/` — dibujo de etapas, transiciones, acciones, tabla y enlaces.
- `src/lib/` — lógica sin interfaz: reglas y verificación de la norma, trazado de enlaces,
  colocación, símbolos y direcciones, historial, archivos y exportación.
