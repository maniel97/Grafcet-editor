# Loops and jumps

Almost all grafcets are cyclic: when they finish, they go back to the rest step. And sometimes steps have to be skipped or repeated.

## Starting over

Right-click the last transition > “Loop to step” and click the destination step (normally the initial one). The link goes up **on the left with an arrow**: the standard reads links from top to bottom, and those going up must carry an arrow.

## Repeating (loop)

An OR divergence in which one of the paths goes up to an earlier step: “while not finished, repeat”.

- Below the step, a transition `[C < 3]` that goes back up and another `[C >= 3]` that carries on.
- The counter is kept with stored actions: `C:=0` before the loop and `C:=C+1` inside it.

## Skipping steps

The same downwards: an OR alternative that goes straight down to a later step.

## Long links

If a link crosses half the drawing, right-click it > “Cut with references”: it is drawn as an arrow with “to step 0” at the origin and “from …” at the destination. It is still the same link.

> **Watch out:** a transition is followed either by a loop or by steps below, not both: both would become active at once. The menu only offers what makes sense.

```ejemplo contador
A loop that repeats until the counter reaches its value.
```
