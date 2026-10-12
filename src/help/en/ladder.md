# From grafcet to PLC

The **Ladder** button translates the grafcet into a PLC program, in several languages:

- **Ladder** (contacts), to view and print.
- **ST** (IEC 61131-3 structured text) and TIA Portal **SCL**.
- **STL** (AWL) for S7-300 and S7-200, ready to import.

## The method

It is the classic method of **one memory bit per step with SET and RESET**, the one taught in class. The program is arranged in sections:

1. **Initialisation**: in the first scan the initial steps are activated and the others deactivated.
2. **Clearing conditions**: one bit per transition = preceding steps active · receptivity.
3. **Deactivation** of the preceding steps and **activation** of the following ones (RESET and SET).
4. **Timers** and **counters**.
5. **Actions**: stored ones with SET/RESET; continuous ones, one coil per output with the OR of its steps.

Computing all the transitions first and then activating and deactivating makes the transitions that can be cleared at the same time be cleared together, as the standard says.

> **Watch out:** outputs are written only once, at the end. If an output appears in several steps, its coil carries the OR of all of them: do not put two coils on the same output.

## Taking it to the PLC

- **STEP 7-Micro/WIN (S7-200)**: download the `.awl` and import it with File > Import. The symbol table is copied and pasted.
- **TIA Portal**: copy the SCL into an external source or an SCL block.
- **Others (CODESYS, etc.)**: the ST is standard.

Right-click a step or transition > “Show in the ladder” takes you to the networks it generates.

The ladder opens in a **panel next to the grafcet**, like the plant and the electrical diagram: drag its left edge to change its width (double-click: equal split) or switch it to full screen with its button. While simulating it is shown **live** (closed contacts and active outputs in green) at the same time as the grafcet and the plant. Click a network: it is highlighted in the grafcet, without closing the ladder. With two or more panels open, the **Stack** button in their header puts them in a column, one above the other (for example, the plant on top and the ladder below, with the grafcet on the left); drag the edge between them to share the height. Double-click a panel header: full screen or back.

```ejemplo taladradora
Open it and click Ladder.
```
