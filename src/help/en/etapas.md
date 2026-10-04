# Steps

A **step** is a stable situation of the system: “waiting”, “drill going down”, “filling”… At every moment each step is **active** or **inactive**; the set of active steps is the *situation* of the grafcet.

## Kinds

- **Step** (square with its number): the normal one.
- **Initial step** (double square): active at start-up. Every grafcet needs at least one.
- **Macro-step** (square with bars above and below, M1…): stands for a piece of grafcet drawn separately, its *expansion*, with an input step E1 and an output step S1.
- **Enclosing step** (with cut corners): while it is active, so is the grafcet it encloses. See the “IEC 60848 notation” page.

## The step variable

Each step has a variable, **X** followed by its number: `X2` is 1 while step 2 is active. It is used in receptivities (`X2 · b`), to synchronise grafcets and in [timings](temporizaciones) (`5s/X2`).

> **Watch out:** step numbers need not be consecutive, but they must be unique in the whole project (all sheets). Verify flags an error if two are the same.

## Good habits

- Number in the order the steps are followed: it reads better and the ladder comes out in order.
- A step without actions is normal (waits, rest).
- If two steps always do the same thing and you go from one to the other without any condition (receptivity `1`), one of them is probably unnecessary.

```ejemplo taladradora
Steps with actions and a rest step without them.
```
