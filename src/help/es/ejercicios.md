# Ejercicios

Un **ejercicio** trae un enunciado y lo que el profesor da hecho (la planta, la tabla de variables, el esquema…). El grafcet lo dibujas tú, y el editor te dice si está bien.

> **Modo educativo:** las herramientas de clase (Abrir > Ejercicios y Corregir entregas, Exportar > Ejercicio para el alumnado y Guion de prácticas) aparecen al activar **Opciones > Modo educativo**. Sin él, los menús quedan más sencillos; un ejercicio que te den se abre con Abrir > Abrir archivo y funciona igual.

## Para el alumnado

1. Abre el ejercicio: Abrir > Ejercicios, o con Abrir > Abrir archivo el archivo que te haya dado el profesor (un .json o la hoja de prácticas en PDF: el ejercicio va dentro). Hay ejercicios de los niveles 1 a 5; los que llevan **Guiado** te acompañan paso a paso, diciéndote qué pulsar en cada momento.
2. Lee el enunciado en el panel **Ejercicio** (a la derecha; el botón de la barra lo abre y lo cierra).
3. Dibuja el grafcet. Puedes simularlo y verificarlo como siempre.
4. Pulsa **Comprobar** cuantas veces quieras. Cada comprobación sale en verde o en rojo, con lo que falla. Si te atascas, abre una **pista** (si el profesor las ofrece): salen de una en una y quedan contadas; si hay nota, cada una puede restar.
5. Para entregar, Exportar > **Dossier de la práctica**: el PDF lleva tu proyecto dentro (se abre en el editor) y tiene apartados para el contenido teórico, las mejoras y los problemas encontrados.

> **Ojo:** lo que el profesor da bloqueado (por ejemplo, la tabla de variables) no se puede cambiar: usa esos nombres en el grafcet. Si escribes uno que no está, la comprobación te lo señala como posible errata.

## Qué se comprueba

- Que hay un grafcet (etapa inicial y alguna transición).
- Que cumple la norma: Verificar sin errores.
- Con la tabla de variables dada, que solo usas sus variables.
- En los ejercicios con planta, que la máquina hace la secuencia pedida con el escenario de prueba del profesor.
- Con cada escenario de prueba, que la máquina responde como la del profesor: las salidas se encienden y se apagan en los mismos momentos (con un margen de tiempo) y llegan las mismas piezas. Si algo falla, **Verlo en la simulación** reproduce ese escenario para que veas dónde.

## Para el profesorado

1. Resuelve el ejercicio en el editor: esa es tu solución y no se reparte.
2. Prepara los escenarios de prueba: grábalos en la simulación (por ejemplo, pulsar Marcha y esperar un ciclo) o pulsa **Dibujar escenario** y arrastra en la fila de cada entrada para decidir cuándo se pulsa; debajo ves en vivo lo que hace tu grafcet.
3. Exportar > **Ejercicio para el alumnado**: escribe el enunciado, elige qué se da hecho (y si va bloqueado) y qué se comprueba. Pulsa **Probar**: con tu solución, todo debe salir en verde.
4. **Guardar y descargar para el alumnado** crea el archivo que se reparte, sin tu grafcet.
5. **Hoja de prácticas (PDF)** crea una hoja como las de siempre, para imprimir o repartir: cabecera para el nombre, enunciado, lo que se da (tabla, planta, esquema), los criterios de evaluación en palabras y los escenarios de prueba. El archivo del ejercicio va dentro del PDF como adjunto: al abrir el PDF en el editor se carga el ejercicio. Cualquiera puede evaluar el ejercicio con el papel, sin conocer el programa, y la **huella** del pie identifica el archivo de dentro.
6. **Requisitos, pistas y nota** (en el mismo diálogo): marca lo que el grafcet tiene que usar (una temporización, un contador, un flanco, una divergencia en O o en Y, una acción condicionada o memorizada, un máximo de etapas). Escribe pistas, una por línea, de la más general a la más concreta, o desmarca **Ofrecer pistas** si prefieres darlas en persona. La **nota** es opcional y orientativa: la parte de criterios cumplidos, y cada pista vista puede restar.

## Corregir entregas

Con tu ejercicio abierto (el que tiene tu solución), Abrir > **Corregir entregas** y añade los dossiers en PDF de la clase (llevan el proyecto dentro) o sus .json.

- Cada entrega se corrige de nuevo con **tus** comprobaciones, no con las que trae el archivo.
- La tabla muestra cada criterio, las pistas vistas, la nota (si la pides) y los datos del proceso (si los pides).
- Avisa de **trabajos muy parecidos** (mismo dibujo y misma lógica): es un aviso, no una prueba.
- **Descargar CSV** la lleva a una hoja de cálculo. Nada sale de tu navegador.

**Datos del proceso** (en el diálogo del ejercicio, desactivados por defecto): se anotan solo totales (veces que comprueba, minutos con actividad, simulaciones y pistas vistas). El alumno lo ve avisado al abrir el ejercicio y salen en una página de su dossier.

## Guion de prácticas

Varias prácticas en un solo PDF, como un guion de los de siempre: Exportar > **Guion de prácticas**.

- Datos de la cabecera y el pie (asignatura, curso, ciclo, centro, profesor/a) y las **normas generales**: entrega, evaluación y qué debe incluir cada práctica.
- Las prácticas: el proyecto abierto y las que añadas desde archivos (.json de ejercicios u hojas en PDF). Ordénalas con las flechas.
- **Guiada**: el proyecto abierto puede salir con su solución (grafcet, conexionado, ladder y tabla), como la práctica que se hace en clase de ejemplo; el proyecto resuelto va también dentro.
- Al abrir el guion en el editor se elige la práctica.

En Abrir > Ejercicios hay un guion de ejemplo con cinco prácticas de autómatas: abre resuelta la práctica 1 y usa **Usar el guion de ejemplo**.

> **Ojo:** las comprobaciones viajan selladas en el archivo, pero no es un sistema de seguridad: el corrector se basa en el comportamiento, no en copiar tu grafcet.

```ejemplo cilindros
Un buen punto de partida para un ejercicio con planta.
```
