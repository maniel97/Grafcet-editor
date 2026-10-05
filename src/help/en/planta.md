# The virtual plant

The **virtual plant** is an animated model of the machine: push buttons, cylinders, conveyors, sensors, tanks… It moves with the grafcet's **outputs** and switches the **inputs** by itself: it is like testing the program on the real machine, without breaking anything.

## Opening it

When simulating, it opens next to the grafcet if the project has a plant; in the simulation panel, **“Virtual plant”** closes and reopens it. Drag the divider to share the width (double-click: half and half).

## Use and Edit

- **Use**: it is operated like the machine: push buttons, switches, part feeders. The inputs given by the plant appear in the panel marked “plant”. Potentiometers are adjusted with the mouse wheel (with Shift, finer), with the arrow keys or, on a touch screen, by dragging your finger slowly.
- **Edit**: elements are placed and configured. Drag them from the palette, rotate them with **R**, delete them with **Del**. In their properties you choose each one's variable (if it does not exist, it is added to the table).

“Connections” shows what is connected and what is missing: grafcet inputs nobody gives, outputs that move nothing.

## Displacement-step diagram

While you simulate, the **“Displacement-step diagram”** section of the panel draws what the cylinders have done: one row per cylinder with its positions 0 (retracted) and 1 (extended) and one column per step, with each movement as a diagonal. It is the diagram of the pneumatics textbooks, but of what **your** program does: compare it with the one the exercise asks for.

- **Steps** or **Time**: the horizontal axis by steps or in seconds (displacement-time diagram).
- If at the end everything is back in its initial position, the last step is marked “5=1”: the cycle is closed.
- **Expected sequence** (e.g. `A+ B+ B− A−`; the pneumatic generator fills it in): its diagram is drawn in grey underneath and it is checked whether they match; if not, it says in which step the difference is. It also appears in the exercise report, with the test scenario.
- **Signal lines**: at each change of step, the limit switch that triggers the next movement (`a1`, `b1`…).

## More realism

- **Gravity**: front view; parts fall, rest on platforms and on cylinder rods.
- **Relief**: a drawing with volume, for presentation only.
- **Faults** (in Use): a sensor that gives no signal, a cylinder that jams… to practise diagnosis.
- **Control panel**: push buttons and pilot lights can go on a separate desk.
- **My groups**: save a station to reuse it in other projects.

> **Watch out:** if something does not move, look first at “Connections” and then at the “What the grafcet is waiting for” section of the simulation panel.

```ejemplo taladradora
A drilling machine with its plant.
```

```ejemplo cargador-gravedad
With gravity: parts fall from the feeder.
```

To try it step by step:

```tutorial planta
```
