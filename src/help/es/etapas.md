# Etapas

Una **etapa** es una situación estable del sistema: «esperando», «bajando la broca», «llenando»… En cada momento, cada etapa está **activa** o **inactiva**; el conjunto de etapas activas es la *situación* del grafcet.

## Tipos

- **Etapa** (cuadrado con su número): la normal.
- **Etapa inicial** (doble cuadrado): activa al arrancar. Todo grafcet necesita al menos una.
- **Macroetapa** (cuadrado con trazos arriba y abajo, M1…): representa un trozo de grafcet que se dibuja aparte, su *expansión*, con una etapa de entrada E1 y una de salida S1.
- **Etapa encapsulante** (con las esquinas cortadas): mientras está activa, lo está también el grafcet que encapsula. Ver la página «Notación IEC 60848».

## La variable de etapa

Cada etapa tiene una variable, **X** seguida de su número: `X2` vale 1 mientras la etapa 2 está activa. Sirve en receptividades (`X2 · b`), para sincronizar grafcets y en las [temporizaciones](temporizaciones) (`5s/X2`).

> **Ojo:** los números de etapa no tienen por qué ser seguidos, pero sí únicos en todo el proyecto (todas las hojas). Verificar marca un error si hay dos iguales.

## Buenas costumbres

- Numera en el orden en que se recorren: se lee mejor y el ladder queda ordenado.
- Una etapa sin acciones es normal (esperas, reposo).
- Si dos etapas hacen siempre lo mismo y se pasa de una a otra sin condición (receptividad `1`), probablemente sobra una.

```ejemplo taladradora
Etapas con acciones y una etapa de reposo sin ellas.
```
