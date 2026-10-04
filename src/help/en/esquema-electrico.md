# The wiring diagram

The **Wiring diagram** button opens the installation diagram: control, power and PLC connections, with the symbols of the IEC 60617 standard. And it is **simulated**: press a push button and you will see current flow, contactors close and motors turn.

## What you can do

- **Insert circuit**: classic circuits ready to simulate and modify (start-stop with self-holding, reversing, star-delta, frequency drive, electro-pneumatics with 5/2 solenoid valves…).
- **PLC connections**: creates the PLC with a device on each input and output of the variables table, already wired.
- **Connect with the PLC and the plant**: the diagram, the grafcet and the plant work together. The diagram's push button gives the PLC input, the output energises the contactor and the contactor moves the plant's conveyor.
- **Several sheets** with a frame, numbered columns and cross references; wire numbers and terminals.
- **Export the diagram** (vector PDF, PNG or SVG), also inside the exercise report.

## Use and Edit

In **Edit** you place devices and draw wires from terminal to terminal. In **Use** you operate push buttons and selectors with the mouse.

## Faults and multimeter

In Use, each device can have faults (open contact, welded contact, cut wire). “Random fault (hidden)” hides one so that you look for it with the **multimeter**, measuring voltages between terminals as in the workshop.

> **Watch out:** pneumatic lines (tubes) do not mix with electrical wires: a solenoid valve is driven through its electrical coil and moves the cylinder through its tubes.

```ejemplo estrella-triangulo-plc
Star-delta starting controlled by the PLC.
```
