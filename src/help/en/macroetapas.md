# Macro-steps

When a grafcet grows, part of the sequence can be **summed up in a single step** and drawn separately. That step is a **macro-step**: a square with a bar above and another below, numbered M1, M2…

## Why?

- The main grafcet can be read at a glance: “dose”, “drill”, “unload”.
- The detail of each part is in its place, without crossing the rest.
- Each idea (the *expansion*) can be reviewed and tested separately.

## How it works (IEC 60848)

Macro-step M1 is detailed in its **expansion**: a piece of grafcet with an **input step E1** and an **output step S1**.

1. When the transition before M1 is cleared, **E1** becomes active.
2. The expansion evolves like any grafcet.
3. The transition after M1 is enabled only when **S1** is active. Clearing it deactivates S1.

> **Watch out:** according to the standard, a macro-step has no actions of its own (what it does is in its expansion) and cannot be initial; the latter is checked by Verify.

## How to draw it

1. Right-click a step > “Convert to macro-step”.
2. Draw the expansion and enclose it in a frame with the same name (M1): select its steps and right-click > “Enclose as macro-step expansion” (or right-click the canvas > “Expansion frame here”).
3. Number its input step **E1** and its output step **S1** (for M2, E2 and S2).

Verify warns if the macro-step lacks its expansion, or if the expansion lacks its input or output step.

```ejemplo macroetapa
Dosing, summed up in M1 and detailed in its expansion.
```
