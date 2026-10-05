# The wiring diagram

The **Wiring diagram** button opens the installation diagram: control, power and PLC connections, with the symbols of the IEC 60617 standard. And it is **simulated**: press a push button and you will see current flow, contactors close and motors turn.

## What you can do

- **Insert circuit**: classic circuits ready to simulate and modify (start-stop with self-holding, reversing, star-delta, frequency drive, electro-pneumatics with 5/2 solenoid valves…).
- **PLC connections**: creates the PLC with a device on each input and output of the variables table, already wired.
- **Connect with the PLC and the plant**: the diagram, the grafcet and the plant work together. The diagram's push button gives the PLC input, the output energises the contactor and the contactor moves the plant's conveyor.
- **Placing devices (stamp)**: click a device in the palette and then click on the diagram: one is placed per click, with its preview under the mouse. Esc, “Finish” or the right button release it. Double-click in the palette: one in the first free spot. With a finger, the same: tap the palette and then the diagram.
- **Several sheets** with a frame, numbered columns and cross references; wire numbers and terminals.
- **Export the diagram** (vector PDF, PNG or SVG), also inside the exercise report.

## Use and Edit

In **Edit** you place devices and draw wires from terminal to terminal. In **Use** you operate push buttons and selectors with the mouse.

## Faults and multimeter

In Use, each device can have faults (open contact, welded contact, cut wire). “Random fault (hidden)” hides one so that you look for it with the **multimeter**, measuring voltages between terminals as in the workshop.

## Electro-hydraulics

In the palette, the **Hydraulics** group (ISO 1219): power unit (motor, pump and tank), pressure relief valve, pressure gauge, 4/3 and 4/2 directional valves, cylinder and flow control valve. It is built and simulated like pneumatics, with three differences you can see when simulating:

- **Oil does not compress**: with both cylinder ports closed (closed or tandem centre of the 4/3), the cylinder stays where it is, even halfway.
- **The pump gives flow, not pressure**: if the oil has nowhere to go (cylinder at the end, closed centre), the pressure rises until the **relief valve** opens and the oil returns through it to the tank. The **gauge** shows it: low pressure while moving, the setting at the end of stroke, 0 with the tandem centre (the pump unloads).
- A port without a tube **spills oil**, and without a relief valve you are warned that the pressure rises out of control.

Pressurised tubes are shown in orange. There are two circuits in “Insert circuit”: the press (tandem 4/3) and the lift with braked lowering (closed centre).

> **Watch out:** pneumatic lines (tubes) do not mix with electrical wires: a solenoid valve is driven through its electrical coil and moves the cylinder through its tubes.

```ejemplo estrella-triangulo-plc
Star-delta starting controlled by the PLC.
```
