# Partial grafcets and forcing

A real automated system has several parts working at the same time: production, safety, operating modes… Each one is drawn as a **partial grafcet** (G1, G2…) and some can **command** others.

## Partial grafcets

Select the steps and transitions of a part and right-click > “Enclose in a partial grafcet”: they are drawn inside a G1 frame. All partial grafcets evolve at the same time, and each one can read the steps of the others (`X12` in a receptivity).

## Forcing

A **forcing order** is an action that imposes a situation on another partial grafcet while the step that holds it lasts:

| Order | Effect on G2 |
|---|---|
| `F/G2{3}` | only step 3 active |
| `F/G2{3, 5}` | only steps 3 and 5 active |
| `F/G2{}` | no step active (empty) |
| `F/G2{*}` | frozen: it stays as it is |
| `F/G2{INIT}` | in its initial situation |

While it is forced, **G2 does not evolve**: its transitions are not cleared. When the forcing ends, it carries on from the imposed situation.

> **Watch out:** forcing is a hierarchy. The forcing grafcet (safety, operating modes) is *above* the forced one (production). A grafcet cannot force itself, and Verify warns if a non-existent grafcet is forced or a step that does not belong to it.

## The typical case: emergency stop

- G1 (safety) rests while there is no emergency.
- With the emergency, G1 moves to a step with `F/G2{}`: production stops dead.
- After resetting, a step with `F/G2{INIT}` leaves production in its initial situation, ready to start.

```ejemplo emergencia
Safety G1 forces production G2 to stop and restart.
```

To organise the start and stop modes systematically, see [GEMMA](gemma).
