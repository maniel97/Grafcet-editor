# Enclosure

**Enclosure** (IEC 60848) is another way of structuring: a step **contains** a whole grafcet, which only lives while the step is active.

## How it works

- The **enclosing step** is drawn with cut corners.
- Its **enclosed grafcet** goes in a frame with its name.
- When the enclosing step becomes active, the enclosed steps marked with the **activation link** (an asterisk *) become active.
- While it is active, the enclosed grafcet evolves on its own.
- When it is deactivated, **everything enclosed is deactivated**, wherever it is.

## Macro-step or enclosure?

- The **macro-step** is a piece of sequence: you enter through E1 and must reach S1 to carry on.
- **Enclosure** is an activity that lasts as long as its step: the outer grafcet can move on at any moment and the inner one is cut off. It is the natural choice for “while running, do this” or for monitoring a phase.

## How to draw it

1. Right-click a step > “Convert to enclosing step”: it also creates its frame.
2. Draw the enclosed grafcet inside the frame.
3. Right-click the step it must start with > “Activation link (*)”.

> **Watch out:** if an enclosed step is initial, the enclosing step must be initial too. And no link may cross the frame: the inner steps are only activated through the activation link. Verify checks both.

```ejemplo encapsulacion
An enclosing step with its enclosed grafcet.
```
