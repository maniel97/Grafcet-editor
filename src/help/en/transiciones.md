# Transitions and receptivities

A **transition** is the passage from some steps to others. It is drawn as a horizontal bar on the link, with its **receptivity** to the right: the logical condition that allows the passage.

## When it is cleared

1. It is **enabled** if all its preceding steps are active.
2. It is **cleared** if it is enabled and its receptivity is 1.
3. Clearing it deactivates the preceding steps and activates the following ones, all at once.

In the simulation, an enabled transition shows amber and a clearable one, green. If it does not advance, hover over it: it tells you what is missing.

## How to write a receptivity

| Type | Meaning |
|---|---|
| `a · b` (or `a*b`) | a AND b |
| `a + b` | a OR b |
| `!a` | a negated (drawn with a bar above) |
| `↑a` | rising edge of a: only at the instant it becomes 1 |
| `↓a` | falling edge |
| `X2` | step 2 is active |
| `5s/X2` | 5 s have passed since step 2 became active (see [Timings](temporizaciones)) |
| `[C >= 3]` | numeric comparison (counters, analogue values) |
| `1` | always true |

As you type, autocomplete suggests the existing variables and the operators.

> **Watch out:** with the receptivity `1`, the transition is cleared as soon as it is enabled: the preceding step is passed through without stopping (*transient evolution*) and its continuous actions are never carried out. Verify points it out with a tip.

## Source and sink transitions

A **source** transition has no preceding step: it is always enabled and, every time it is true (normally an edge, `↑Pieza`), it activates its following steps. A **sink** has no following step: when cleared, it only deactivates.

```ejemplo contador
Receptivities with edges and comparisons.
```
