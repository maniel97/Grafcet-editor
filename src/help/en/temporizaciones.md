# Timings

In grafcet, time is written as a **time condition** on a variable: `t1/variable/t2`.

## The usual forms

- `5s/X2`: becomes 1 when 5 s have passed since step 2 became active. It is the typical wait: a transition with `5s/X2` below step 2 waits 5 s and moves on.
- `3s/a`: becomes 1 when `a` has been at 1 for 3 s (on-delay). If `a` drops earlier, it starts again.
- `3s/a/2s`: rises 3 s after `a` rises and drops 2 s after `a` drops.
- `0s/a/2s`: follows `a` when it rises and extends it by 2 s when it drops (off-delay).

The accepted units are `ms`, `s`, `min` and `h`.

## In actions

A conditional action with a time condition is delayed or limited:

- `3s/X4` above `Bocina` (horn): the horn sounds from 3 s into step 4.
- `!5s/X4` above `Bocina`: it sounds only during the first 5 seconds of step 4.

> **Watch out:** time counts from when the variable rises. If the step is deactivated and activated again, it starts from zero.

## In the PLC

The ladder uses one timer for each different time condition (TON in S7-200 or IEC). You can see it with the Ladder button.

```ejemplo semaforo
A traffic light: only times.
```

To practise it step by step:

```tutorial temporizacion
```
