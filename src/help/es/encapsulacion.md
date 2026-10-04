# Encapsulación

La **encapsulación** (IEC 60848) es otra forma de estructurar: una etapa **contiene** un grafcet entero, que solo vive mientras ella está activa.

## Cómo funciona

- La **etapa encapsulante** se dibuja con las esquinas cortadas.
- Su **grafcet encapsulado** va en un marco con su nombre.
- Al activarse la encapsulante, se activan las etapas del encapsulado marcadas con el **enlace de activación** (un asterisco *).
- Mientras está activa, el encapsulado evoluciona por su cuenta.
- Al desactivarse, **todo lo encapsulado se desactiva**, esté donde esté.

## ¿Macroetapa o encapsulación?

- La **macroetapa** es un trozo de secuencia: se entra por E1 y hay que llegar a S1 para seguir.
- La **encapsulación** es una actividad que dura lo que dura su etapa: el grafcet de fuera puede seguir en cualquier momento y el de dentro se corta. Es lo natural para «mientras estés en marcha, haz esto» o para la vigilancia de una fase.

## Cómo se dibuja

1. Clic derecho en una etapa > «Convertir en etapa encapsulante»: crea también su marco.
2. Dibuja el grafcet encapsulado dentro del marco.
3. Clic derecho en la etapa por la que debe empezar > «Enlace de activación (*)».

> **Ojo:** si una etapa encapsulada es inicial, la encapsulante también tiene que serlo. Y ningún enlace puede cruzar el marco: las etapas de dentro solo se activan por el enlace de activación. Verificar comprueba las dos cosas.

```ejemplo encapsulacion
Una etapa encapsulante con su grafcet encapsulado.
```
