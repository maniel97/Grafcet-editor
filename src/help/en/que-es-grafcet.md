# What is a grafcet?

A **grafcet** describes, with a standardised drawing, how an automated system behaves: what the machine does at each moment and what has to happen to move from one situation to the next. It is defined by the **IEC 60848** standard.

## Why a grafcet and not the program straight away?

- **It can be understood without knowing how to program.** The mechanic, the electrician and the programmer read the same thing.
- **It separates the what from the how.** First you think out the sequence; then it is translated into ladder, ST or STL for whichever PLC you use. This editor does that translation.
- **It prevents omissions.** Each situation is a step and each change, a transition with its condition: if something is missing, it shows (and Verify points it out).

## The pieces

- **Steps** (squares): the situations the system can be in. The active ones show where it is. See [Steps](etapas).
- **Transitions** (horizontal bars): the passage from some steps to others, with their **receptivity**, the condition that allows it. See [Transitions](transiciones).
- **Actions** (rectangles to the right of the step): what is done while the step is active. See [Actions](acciones).
- **Links**: they join steps and transitions, which always alternate. They are read from top to bottom; those going up carry an arrow.

## How it evolves

1. At start-up the **initial steps** (double square) become active.
2. A transition is **enabled** when all its preceding steps are active.
3. If, in addition, its receptivity is true, it is **cleared**: the preceding steps are deactivated and the following ones activated, at the same time.
4. Transitions that can be cleared at the same time are cleared together.

> **Watch out:** an enabled transition whose receptivity is false waits. A grafcet never “jumps” steps: there is always a transition in between.

```ejemplo marcha-paro
The simplest grafcet: two steps, two transitions. Open it and click Simulate.
```

To draw your own step by step:

```tutorial primer-grafcet
```
