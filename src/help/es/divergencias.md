# Elegir y hacer a la vez (O e Y)

Un grafcet no tiene por qué ser una línea recta. Hay dos formas de abrir caminos.

## Divergencia en O: elegir un camino

Una etapa seguida de **varias transiciones**: se sigue el camino cuya receptividad se cumpla. Se dibuja con una **línea simple** horizontal.

- Clic derecho en una transición > «Añadir alternativa en O».
- Los caminos se juntan con una **convergencia en O**: selecciona las últimas transiciones de cada camino y, con clic derecho, «Converger en O».

> **Ojo:** las receptividades de una divergencia en O deben ser **excluyentes**: si dos se cumplen a la vez, se activarían los dos caminos. Usa `a · !b` y `b` en vez de `a` y `b`. Verificar lo comprueba.

## Divergencia en Y: hacer varias cosas a la vez

Una transición seguida de **varias etapas**: al franquearla se activan todas y cada rama evoluciona por su cuenta. Se dibuja con una **doble línea**.

- Clic derecho en la transición > «Divergencia en Y (2 ramas)» (y «Añadir rama en Y» para más).
- Las ramas se juntan con una **convergencia en Y**: selecciona las últimas etapas de cada rama y, con clic derecho, «Converger en Y». La transición de después solo se franquea cuando **todas** esas etapas están activas: es una sincronización.

> **Ojo:** suele hacer falta una etapa de espera al final de cada rama (sin acciones) para que la rama rápida espere a la lenta.

## No mezclar

Una O se cierra con una O, y una Y con una Y. Si una divergencia en Y se cierra con una convergencia en O, quedan etapas activas sueltas y el grafcet acaba con más etapas activas de las que debería: compruébalo simulando.

```ejemplo clasificadora
Divergencia en O: cada pieza va a su sitio.
```

```ejemplo mezcladora
Divergencia en Y: dos depósitos a la vez.
```

Para practicar la O y la exclusividad paso a paso:

```tutorial divergencia-o
```
