# Timings

A **timing** is a condition that becomes true when some time has passed. It is not a device you add: you **write** it in a receptivity or above an action, and the editor creates the timer by itself (and the PLC one, when converting to ladder).

## The most common form: waiting in a step

To make a step last a certain time, write this in the transition below it:

```
5s/X2
```

It reads «**5 seconds since step 2 became active**». It is 0 when step 2 becomes active and turns to 1 when it has been active for 5 s; then the transition is cleared.

Step by step:

1. Select the step (for example, step 2) and press the **+** below it: a transition appears.
2. Double-click the transition and type `5s/X2`. Under «Common receptivities» there is a button that writes it with the step above.
3. Press **Simulate**: when step 2 becomes active, the transition will clear by itself after 5 s.

> **Watch out:** the number after X is the **step being waited for**, usually the one right above. If you write `5s/X1` below step 2, it counts from when step 1 became active (Verify warns with a tip).

```ejemplo semaforo
A traffic light: each light, a step with its time (10s/X0, 8s/X1, 3s/X2).
```

## Units

`ms` (milliseconds), `s` (seconds), `min` (minutes) and `h` (hours). Decimals are allowed with a point or a comma: `0.5s/X3`, `1,5s/X3`, `2min/X4`.

## Waiting for something to last: delay on a variable

A timing can also be placed on an input or any variable, not only on a step:

| You write | It is 1… | What for |
|---|---|---|
| `3s/a` | when `a` has been at 1 for **3 s in a row**. If `a` drops earlier, it starts again | filtering: a part that just passes by does not count, only one that stays |
| `0s/a/2s` | when `a` rises, and stays at 1 **2 s after** `a` drops | extending: a lamp that stays on for a while after releasing the button |
| `3s/a/2s` | 3 s after `a` rises, and drops 2 s after `a` drops | both at once |

The general form in the standard is `t1/a/t2`: `t1` delays the rise and `t2` the fall.

```ejemplo apilador-trampilla
1s/Pila: the trapdoor only opens if the sensor sees the stack for 1 s (a falling box cuts the beam for an instant and does not count).
```

## In an action: switch on later, or only for a while

A **conditional action** with a timing above it (double-click the step, action type «Conditional», and the timing in its condition):

- **Delayed** (`4s/X1` above `Vibrador`): the vibrator switches on 4 s after step 1 becomes active, and stays on until the step is deactivated.
- **Limited** (`!2s/X1` above `Aviso`): the warning sounds only during the first 2 seconds of step 1. The `!` means «not»: «while 2 s have **not** yet passed».

```ejemplo silo-vibrador
Both in the same step: the warning sounds for 2 s when discharging starts and the vibrator starts after 4 s.
```

## What you see when simulating

- In the right-hand panel, **Timers**: one bar for each, with the elapsed time and the total (`1.2 / 5 s`). Green once it has been reached; «step inactive» if it has not started yet.
- **What the grafcet is waiting for** tells you how much is left, e.g. for 5s/X2: 3.8 s left.
- To avoid waiting: **+1 s** moves time forward one second, and the **speed** selector (×2, ×5…) speeds everything up.

## Rules worth knowing

- The time **starts from zero** every time the step becomes active (or the variable rises). If the step is deactivated before the time is up, the count is lost.
- A timing is not a variable you have to declare: there is no need to add it to the table.
- In the **variable table** they appear under *Timers* with their address (T1, T37…). The time comes from the grafcet: to change it, change the receptivity or the action.

## In the PLC

When converting to ladder (**Ladder** button), each different timing becomes a **TON** timer (on-delay). Those of the form `a/2s` (off-delay) also use an auxiliary bit. In the S7-200 they are 100 ms timers, from T37 onwards; if a time is too long for the timer, the export warns.

See also: [Counters](contadores) · [Actions](acciones) · [Transitions and receptivities](transiciones).

To practise it step by step:

```tutorial temporizacion
```
