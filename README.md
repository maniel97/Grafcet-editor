# Grafcet Editor

> ⚠️ **Versión alfa (0.1.0-alpha.2): en pruebas.** Puede tener fallos y algunas cosas pueden cambiar.
> Guarda tus proyectos descargándolos (archivo `.json`). Los fallos, en
> [Issues](https://github.com/maniel97/Grafcet-editor/issues).

**Editor y simulador de grafcet (IEC 60848) para la enseñanza de automatismos.**
Se usa en el navegador, sin instalar nada: **<https://grafcet-editor.com>** ·
código: <https://github.com/maniel97/Grafcet-editor>

Gratis, de código abierto (GPL-3.0) y sin enviar nada a ningún servidor: todo funciona en tu
navegador, también sin conexión (se puede instalar como aplicación).

## Qué hace

- **Dibujar grafcet según IEC 60848**: etapas, transiciones, acciones (continuas, condicionadas,
  memorizadas, al evento), divergencias y convergencias en O y en Y, macroetapas, encapsulación,
  grafcets parciales y forzado, varias hojas. Las reglas de la norma se aplican al editar y
  **Verificar** explica los errores y los descuidos típicos.
- **Simular** como lo haría el autómata: temporizaciones, contadores, flancos, cronograma,
  escenarios de prueba y «qué espera el grafcet» en cada momento.
- **Planta virtual**: cilindros, cintas, detectores, depósitos…, vista desde arriba (también
  isométrica) o de frente con gravedad. Se mueve con las salidas y activa sola las entradas.
- **Esquema eléctrico** (IEC 60617) con el autómata cableado, también simulado, con neumática y
  electrohidráulica (ISO 1219), averías y polímetro.
- **Paso al autómata**: ladder, Texto Estructurado, SCL (TIA Portal), AWL y STL de S7-200
  importable en STEP 7-Micro/WIN.
- **Para clase**: ejemplos por niveles, ejercicios con corrección automática, tutoriales guiados,
  wiki de ayuda, dosier de prácticas en PDF. En español, inglés, francés y portugués.

## Cómo se ha hecho

Desarrollado con asistencia de inteligencia artificial (**Claude**, de Anthropic) mediante
«vibe coding»: la IA escribe el código bajo la dirección, la revisión y las pruebas de
**Maniel Montes**. Cada cambio queda en el historial del repositorio (con `Co-Authored-By: Claude`)
y más de mil pruebas automáticas (lógica y navegador) comprueban el funcionamiento antes de
publicar.

Es una **herramienta educativa**: no está certificada para programar máquinas reales. Revisa
siempre el programa antes de cargarlo en un autómata.

## Licencia

© 2026 Maniel Montes. Software libre bajo la **GNU General Public License v3.0 o posterior**
([LICENSE](LICENSE)): puedes usarlo, copiarlo, estudiarlo y modificarlo gratis; las versiones
modificadas que se publiquen deben seguir siendo libres y con su código.

Los nombres de productos y empresas citados (Siemens, SIMATIC, STEP 7-Micro/WIN, TIA Portal,
CODESYS, Schneider Electric, Omron…) son marcas de sus respectivos propietarios; este proyecto no
tiene relación con ellos ni cuenta con su respaldo. Las normas IEC 60848, IEC 60617, IEC 61131-3 e ISO 1219 se citan como
referencia; los símbolos están dibujados para este proyecto.

Las librerías de terceros que incluye la aplicación (React, React Flow, jsPDF…) tienen sus propias
licencias (MIT, ISC, BSD, OFL…): la compilación las reúne en `THIRD-PARTY-LICENSES.txt`, enlazado
desde Ayuda > «Acerca de».

---

## Para desarrollar

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # versión de producción en dist/
```

### Pruebas

```bash
npm test           # lógica (Vitest): norma, trazado, variables, simulación, ladder… (segundos)
npm run test:e2e   # navegador (Playwright): editor, simulador, planta, esquema, ayuda…
npm run test:all   # todas: pasarlas antes de unir una rama a main
npm run test:perf  # rendimiento al arrastrar (versión de producción)
npm run lint       # oxlint
```

Las pruebas de navegador usan un Chromium ya instalado (Brave, Chrome o Edge; o
`PW_BROWSER_PATH`) y arrancan su propio servidor.

### Publicación

La aplicación es 100 % estática. `.github/workflows/pages.yml` publica en **GitHub Pages** en cada
envío a `main` (pasa las pruebas unitarias, compila y publica), con el dominio propio
`grafcet-editor.com`. Se compila con rutas relativas: funciona igual en la raíz de un dominio o en
una subcarpeta.

**Instalable y sin conexión (PWA)**: el navegador ofrece «Instalar» y la aplicación funciona sin
internet (`public/sw.js` guarda todos sus archivos). Cuando se publica una versión nueva, avisa
con «Hay una versión nueva del editor · Recargar». En `npm run dev` no se activa (a propósito);
se prueba con `npm run test:pwa`.

**Versión portable (un solo archivo)**: `npm run build:portable` genera
`dist-portable/grafcet-editor.html`, con todo dentro. Se abre con doble clic desde cualquier
carpeta o USB, sin instalar nada y sin conexión.

### Estructura

- `src/components/` — interfaz: lienzo, barra, paneles, diálogos, planta, esquema eléctrico.
- `src/nodes/`, `src/edges/` — dibujo de etapas, transiciones, acciones, tabla y enlaces.
- `src/lib/` — lógica sin interfaz: norma y verificación, simulación (`sim/`), paso a ladder y
  exportaciones (`ladder/`), esquema eléctrico, neumática e hidráulica (`elec/`), ejercicios.
- `src/help/` — wiki de ayuda en cuatro idiomas (Markdown).
- `src/locales/` — traducciones de la interfaz (`npm run i18n` las comprueba).
- `tests/unit/`, `tests/e2e/` — pruebas de lógica y de navegador.
