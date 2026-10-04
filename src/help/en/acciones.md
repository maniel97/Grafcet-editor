# Actions

**Actions** say what is done while a step is active. They are drawn in rectangles to the right of the step. They are added with the **+** to the right of the step, from its properties (double-click) or with right-click > “Add action”.

## Kinds (IEC 60848)

- **Continuous**: the output is 1 while the step is active. It is the most common: `Motor`.
- **Conditional**: besides the step, it requires a condition, written on a vertical bar above the action. `Motor` with the condition `!Termico`.
- **Delayed or time-limited**: a conditional action with time. `3s/X2` above: it switches on 3 s after the step becomes active.
- **Stored on activation** (arrow ↑): carried out once, when the step becomes active. `A:=1` sets A to 1 and leaves it so until another action sets it to 0. Also for counters: `C:=C+1`.
- **Stored on deactivation** (arrow ↓): the same, when the step is deactivated.
- **On event**: carried out at the instant of an event while the step is active, e.g. `↑b`.

## Continuous or stored?

With **continuous** actions, looking at the active steps is enough to know which outputs are on. With **stored** ones it is not: you need to know what happened before. So:

- Use continuous actions whenever you can.
- Use stored actions when the output must last over several steps that are not consecutive, or for counters and values.
- Every `A:=1` must have its `A:=0` somewhere; otherwise the output stays at 1 for ever.

> **Watch out:** if an output appears as continuous in two steps, it is 1 if either of them is active (it is an OR). If it is also stored in another step, the two forms clash: Verify points it out with a tip.

```ejemplo cilindros
Only continuous actions: one movement per step.
```

```ejemplo contador
Stored actions: C:=0 at the start and C:=C+1 on each round.
```
