# Hoja de ruta

Hacia dónde va Grafcet Editor y en qué orden. Cada punto es una
[issue](https://github.com/maniel97/Grafcet-editor/issues) y cada fase un
[milestone](https://github.com/maniel97/Grafcet-editor/milestones): ahí se ve qué está hecho y qué
falta. No hay fechas: el orden importa más que el calendario.

¿Echas algo en falta o has encontrado un fallo? Abre una
[issue](https://github.com/maniel97/Grafcet-editor/issues/new/choose) o pregunta en
[Discussions](https://github.com/maniel97/Grafcet-editor/discussions).

> **English summary.** Grafcet Editor follows [SemVer](https://semver.org) pre-releases:
> **0.1 alpha** fixes what already exists (S7-200 emulator audit, known bugs, missing checks and
> translations); **0.2 alpha** makes counters and timers easy to use and watch; **0.x beta** is
> the classroom trial (full CI, contribution guide); **1.0** comes after a school term of real use
> without serious bugs, with a documented, frozen project format. Parked ideas (real PLC bridge,
> assembly view, touch schematic) have no milestone. Every item below is a GitHub issue; feel free
> to comment in English.

## Versiones

- **0.1.0-alpha.N** — en pruebas. Cada tanda de arreglos sube la N.
- **0.x.0-beta.N** — completo y probado con alumnado.
- **1.0.0** — tras un trimestre de uso en clase sin fallos graves.

Cada versión tiene su [release](https://github.com/maniel97/Grafcet-editor/releases) con las
novedades. Lo que llega a `main` se publica en <https://grafcet-editor.com>.

## 0.1 alpha — estabilizar

Que todo lo que ya existe funcione bien antes de añadir nada.

- [ ] [#1](https://github.com/maniel97/Grafcet-editor/issues/1) Emulador S7-200: auditoría instrucción por instrucción
- [ ] [#2](https://github.com/maniel97/Grafcet-editor/issues/2) Electroneumática: a0/a1 leen 0 en el primer ciclo del autómata
- [ ] [#3](https://github.com/maniel97/Grafcet-editor/issues/3) Generador de cableado: cilindro solo en el esquema sale como pulsadores y relé
- [ ] [#4](https://github.com/maniel97/Grafcet-editor/issues/4) Verificar: avisos para contadores y acciones memorizadas
- [ ] [#5](https://github.com/maniel97/Grafcet-editor/issues/5) Textos sin traducir en las propiedades del esquema eléctrico
- [ ] [#6](https://github.com/maniel97/Grafcet-editor/issues/6) Tabla de variables: la columna «Presel.» se puede editar pero no se usa

## 0.2 alpha — contadores y temporizaciones

Que contar y temporizar sea cómodo de escribir y fácil de ver al simular.

- [ ] [#7](https://github.com/maniel97/Grafcet-editor/issues/7) Atajos para contadores en acciones y receptividades
- [ ] [#8](https://github.com/maniel97/Grafcet-editor/issues/8) Simulación: objetivo del contador y fijar su valor a mano
- [ ] [#9](https://github.com/maniel97/Grafcet-editor/issues/9) Valores en vivo sobre el lienzo: cuenta atrás y contadores
- [ ] [#10](https://github.com/maniel97/Grafcet-editor/issues/10) Asistente de temporizaciones en el panel de la transición
- [ ] [#11](https://github.com/maniel97/Grafcet-editor/issues/11) Tutorial guiado de contadores

## 0.x beta — en el aula

Probarlo con alumnado real y recoger lo que salga. Esta fase se irá llenando con lo que se
reporte en clase.

- [ ] [#12](https://github.com/maniel97/Grafcet-editor/issues/12) CI: ejecutar las pruebas e2e antes de desplegar
- [ ] [#13](https://github.com/maniel97/Grafcet-editor/issues/13) Guía para contribuir (CONTRIBUTING)

## 1.0

- [ ] [#14](https://github.com/maniel97/Grafcet-editor/issues/14) Documentar y congelar el formato de proyecto

## Aparcado

Ideas sin compromiso: se harán si en clase se ven necesarias
([etiqueta `aparcado`](https://github.com/maniel97/Grafcet-editor/labels/aparcado)).

- [#15](https://github.com/maniel97/Grafcet-editor/issues/15) Puente con un autómata real (WebUSB / Web Serial)
- [#16](https://github.com/maniel97/Grafcet-editor/issues/16) Vista de montaje: carril DIN y lista de materiales
- [#17](https://github.com/maniel97/Grafcet-editor/issues/17) Esquema eléctrico cómodo en pantallas táctiles

## Ya hecho

Lo que ya hay está resumido en el [README](README.md#qué-hace) y, versión a versión, en las
[releases](https://github.com/maniel97/Grafcet-editor/releases).
