# Grafcet Editor

Editor web de diagramas Grafcet (IEC 60848) que funciona 100 % en el navegador: sin servidor y
sin límites de exportación.

## Arrancar

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # versión de producción en dist/
```

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
- **Archivos**: guardar / abrir proyecto `.json`; exportar PNG, SVG y PDF.
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

## Siguientes pasos previstos

- Traducción a ladder (LD), a partir de `buildPlcModel` en `src/lib/plcModel.js` y del
  compilador del simulador (`src/lib/sim/engine.js`).

## Estructura

- `src/components/` — interfaz: lienzo, barra, paneles, diálogos, menú contextual.
- `src/nodes/`, `src/edges/` — dibujo de etapas, transiciones, acciones, tabla y enlaces.
- `src/lib/` — lógica sin interfaz: reglas y verificación de la norma, trazado de enlaces,
  colocación, símbolos y direcciones, historial, archivos y exportación.
