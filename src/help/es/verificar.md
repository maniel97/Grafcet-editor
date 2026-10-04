# Verificar

El botón **Verificar** revisa el grafcet continuamente. Su número indica cuántos **errores** (rojo) o **avisos** (ámbar) hay; con **✓**, todo en orden. Pulsa un mensaje para ir al elemento; «Más en la ayuda» abre el artículo que explica la regla.

## Qué comprueba

- **La sintaxis de la norma**: que haya etapa inicial, que toda etapa tenga número y no se repita, que etapas y transiciones se alternen, que toda transición tenga receptividad.
- **La estructura**: etapas sin entrada (nunca se activan) o sin salida (no se desactivan nunca), transiciones sueltas, bucles que a la vez continúan hacia abajo, etapas a las que no se llega desde ninguna inicial.
- **Las divergencias en O**: si dos caminos pueden cumplirse a la vez, lo dice y da un ejemplo de valores con los que pasa.
- **Macroetapas, grafcets parciales y encapsulación**: que cada macroetapa tenga su expansión (con entrada y salida), que los forzados apunten a grafcets que existen, que cada encapsulante tenga su grafcet encapsulado.
- **Consejos**: errores típicos al aprender, como receptividades que usan salidas, temporizaciones de otra etapa, receptividades siempre falsas, etapas que se atraviesan sin detenerse o salidas mandadas a la vez con acción continua y memorizada.

## Errores, avisos y consejos

- Un **error** hace que el grafcet no sea conforme o no pueda funcionar: hay que corregirlo.
- Un **aviso** señala algo que probablemente no quieres, pero puede ser intencionado.
- Un **consejo** es pedagógico: explica la regla y no impide nada.

Si estás seguro de que un aviso es intencionado, déjalo: no impide simular ni generar el ladder.

> **Ojo:** Verificar no sabe qué tiene que hacer tu máquina. Un grafcet conforme puede estar mal pensado: por eso existe la [simulación](simular).
