# Bucles y saltos

Casi todos los grafcets son cíclicos: al acabar, vuelven a la etapa de reposo. Y a veces hace falta saltarse etapas o repetirlas.

## Volver a empezar

Clic derecho en la última transición > «Bucle a etapa» y pulsa la etapa de destino (normalmente la inicial). El enlace sube **por la izquierda y con flecha**: la norma lee los enlaces de arriba abajo, y los que suben deben llevar flecha.

## Repetir (bucle)

Una divergencia en O en la que uno de los caminos sube a una etapa anterior: «mientras no haya acabado, repite».

- Bajo la etapa, una transición `[C < 3]` que vuelve arriba y otra `[C >= 3]` que sigue.
- El contador se lleva con acciones memorizadas: `C:=0` antes del bucle y `C:=C+1` dentro.

## Saltar etapas

Lo mismo hacia abajo: una alternativa en O que baja directamente a una etapa posterior.

## Enlaces largos

Si un enlace cruza medio dibujo, clic derecho sobre él > «Cortar con referencias»: se dibuja como una flecha con «a la etapa 0» en el origen y «de …» en el destino. Sigue siendo el mismo enlace.

> **Ojo:** de una transición sale o un bucle o etapas debajo, no las dos cosas: se activarían las dos a la vez. El menú solo ofrece lo que tiene sentido.

```ejemplo contador
Un bucle que se repite hasta que el contador llega a su valor.
```
