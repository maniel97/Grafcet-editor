# Variables and addresses

**Variables** are the names you use in receptivities and actions: `Marcha`, `Motor`, `C`… They appear in the **variables table** by themselves as you type them, sorted into inputs, outputs, internal, counters and analogue.

## The table

- **Variables** button on the toolbar: the full table. It can also be placed on the canvas (right-click > “Variable table here”), so that it is printed.
- Each variable has a PLC **address** (`I0.0`, `Q0.1`, `M0.0`…) and a **comment**.
- “Fill empty” (in the full table; in the canvas one, right-click > “Fill empty addresses”) assigns addresses to those without one, in the chosen format: **S7-200**, **S7-300/1200** or **IEC 61131-3** (`%I0.0`).
- Drag a variable to another section to change its type.

## Renaming

Type the new name in the table: it changes in all receptivities and actions, in the plant and in the wiring diagram, and it **keeps** its address and comment.

## Step variables

`X2` is step 2. In the table you can choose for the ladder, ST, STL and the simulation to call it `E2` (a habit in some schools); in the grafcet you still write `X2`, as the standard requires.

## Analogue values

An input compared with a number (`[Temperatura > 60]`) is analogue. In the table you choose its signal (4–20 mA or 0–10 V) and its physical range; the ladder scales it and the simulation uses a slider in those units.

> **Watch out:** a variable name cannot contain spaces or start with a number. Use `PiezaArriba` or `pieza_arriba`.
