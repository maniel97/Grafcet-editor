# Counters

In grafcet a **counter** is a variable that holds a number (`C`, `Piezas`, `Plazas`…). There is no «counter» block to add: you count with **stored actions** that change its value, and you check it with **comparisons** in the receptivities.

## The three pieces

| To… | You write | Where |
|---|---|---|
| reset to zero | `C:=0` | **stored on activation** action (↑) of the step where everything starts, usually the initial one |
| add one | `C:=C+1` | **stored on activation** action of the step that becomes active once for each thing counted |
| compare | `[C >= 3]` | receptivity of a transition (or condition of an action) |

Accepted comparisons: `=`, `<>` (not equal), `<`, `<=`, `>`, `>=`. Square brackets are the standard's form; it also works without them (`C >= 3`) and combined: `↑P · [C < 3]`.

When you type `C:=…` in a new action, the editor turns it into **stored on activation** by itself: an assignment as a continuous action would do nothing (Verify marks it as an error).

## Counting with a loop (the clearest way)

You count **once per activation** of a step. For example, switching on a lamp at the third press of P:

```
Step 0 (initial)    C:=0
  Marcha
Step 1              (waits for a press)
  ↑P · [C < 2]  → step 2           ↑P · [C >= 2] → step 3
Step 2              C:=C+1, and back to step 1 (transition «1»)
Step 3              Luz
```

- `↑P` (rising edge): each press counts **once**, even if the button is held down.
- The two transitions below step 1 are a **choice**: one counts again, the other finishes. They must be mutually exclusive (`< 2` and `>= 2`).
- The comparison looks at the value **before** the incoming press: with 2 already counted, the third goes to the lamp.

```ejemplo contador
This very grafcet, ready to simulate.
```

## Counting without changing step: on-event action

If the machine has to stay in the same step while it counts, use an **on-event** action: it runs at the instant of the event, while the step is active.

1. Double-click the step, **Add action**, type «On event».
2. Text: `C:=C+1`. In its condition (the event): `↑P`.

Each rising edge of P adds one while the step is active. The exit of the step can be `[C >= 10]`.

## Counting down

`C:=C-1` subtracts one. With both, a car park keeps track of the occupied spaces: `C:=C+1` when a car enters and `C:=C-1` when it leaves; `[C < 5]` lets cars in and `[C > 0]` lets them out.

```ejemplo aparcamiento
Spaces in a car park: adding, subtracting, and the Libre / Completo lamps as conditional actions (C < 5, C >= 5).
```

Other operations work too: `N:=N+5`, `D:=A*2`, `M:=(A+B)/2`.

## What you see when simulating

- In the right-hand panel, **Memory bits and counters**, with their value at every moment.
- **What the grafcet is waiting for** tells you which comparison is missing and the current value: with `[C >= 3]` and C at 1, «C = 1».
- The **timing chart** shows when each step became active (and therefore when it counted).

## Typical mistakes

- **Forgetting `C:=0`**: the counter starts with whatever it had from the previous time. Put it in the initial step (or in the one where each cycle starts).
- **Counting without an edge** (`P` instead of `↑P`): while P is held down, the transition is true again and again and counts too many.
- **Comparisons that are not exclusive** (`[C <= 3]` and `[C >= 3]`): with C at 3 both are true. Verify detects it in OR divergences.
- **Counting in a step that does not repeat**: `C:=C+1` adds once **per activation**; if the step stays active, it does not add again (for that, the on-event action).

## In the PLC

The editor does not use the PLC's counter blocks (CTU, CTD): a counter is a **word** (`MW100` in S7-300/1200, `VW` in S7-200) and `C:=C+1` becomes an addition (`+I` in S7-200). Comparisons use word comparators. This way any operation is translated just as in the grafcet (`+5`, `-1`, `*2`), not only counting one by one.

See also: [Actions](acciones) (stored and on-event) · [Loops and jumps](bucles) · [Transitions and receptivities](transiciones).
