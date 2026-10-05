# Simulate

**Simulate** runs the grafcet as the PLC would, without a PLC. While simulating, the diagram cannot be changed; “Stop” goes back to editing.

## What you see

- **Active step**: green, with a dot.
- **Enabled transition**: amber. **Clearable**: green.
- **Emitted action**: green.
- In the panel on the right, the **inputs** (switch or push button), the **outputs** and the internal variables, counters and timers.

## How to use it

- Switch an input with a click, or with the keys **1–9** (in the panel's order).
- With **Pause**, the **Step** button (⏭) clears one at a time, to see clearly what happens (transient evolution included).
- The speed of time can be changed: useful with long waits.
- If something does not advance, hover over the transition: it tells you which condition is missing.

## Virtual plant and wiring diagram

In the examples that have one, the **plant** (cylinders, conveyors, sensors…) moves with your outputs and switches the inputs by itself: it is like testing on the machine. The **wiring diagram** shows the wired PLC and is simulated too. See [The virtual plant](planta) and [The wiring diagram](esquema-electrico).

## Floating panels

The **chronogram**, the **displacement-step diagram** and the **test scenarios** can be taken out of the panel: with the button in their title or by dragging the title onto the canvas.

- They move by their title bar and resize by their edges and corners (with the keyboard: arrows to move, Shift + arrows for the size).
- Wider, they show more: the chronogram, more seconds.
- **Put back** returns them to the panel. Their place and size are remembered.

## Scenarios

“Record scenario” notes the input changes with their instant. They are saved in the project and replayed with a click: that way you check, after each change, that everything still works. The timing chart shows inputs, steps and outputs over time.

```ejemplo taladradora
With a virtual plant: click Simulate and then Marcha.
```
