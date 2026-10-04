# Transiciones y receptividades

Una **transición** es el paso de unas etapas a otras. Se dibuja como un trazo horizontal en el enlace, con su **receptividad** a la derecha: la condición lógica que permite el paso.

## Cuándo se franquea

1. Está **validada** si todas sus etapas anteriores están activas.
2. Se **franquea** si está validada y su receptividad vale 1.
3. Al franquearla se desactivan las etapas anteriores y se activan las siguientes, todo a la vez.

En la simulación, una transición validada se ve ámbar y una franqueable, verde. Si no avanza, pasa el ratón por encima: dice qué falta.

## Cómo se escribe una receptividad

| Escribe | Significa |
|---|---|
| `a · b` (o `a*b`) | a Y b |
| `a + b` | a O b |
| `!a` | a negada (se dibuja con raya encima) |
| `↑a` | flanco de subida de a: solo en el instante en que pasa a 1 |
| `↓a` | flanco de bajada |
| `X2` | la etapa 2 está activa |
| `5s/X2` | han pasado 5 s desde que se activó la etapa 2 (ver [Temporizaciones](temporizaciones)) |
| `[C >= 3]` | comparación numérica (contadores, analógicas) |
| `1` | siempre verdadera |

Al escribir, el autocompletado propone las variables que ya existen y los operadores.

> **Ojo:** con la receptividad `1`, la transición se franquea en cuanto se valida: la etapa anterior se atraviesa sin detenerse (*evolución fugaz*) y sus acciones continuas no llegan a ejecutarse. Verificar lo avisa con un consejo.

## Fuentes y sumideros

Una transición **fuente** no tiene etapa anterior: está siempre validada y, cada vez que se cumple (normalmente un flanco, `↑Pieza`), activa sus etapas siguientes. Una **sumidero** no tiene etapa siguiente: al franquearse, solo desactiva.

```ejemplo contador
Receptividades con flancos y comparaciones.
```
