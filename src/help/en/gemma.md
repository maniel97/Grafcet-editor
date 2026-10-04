# GEMMA: start and stop modes

The **GEMMA guide** (*Guide d'Étude des Modes de Marches et d'Arrêts*) is a template so that no situation of a real machine is forgotten: not only producing, but also stopping, starting, going to the initial position or reacting to a failure.

## The three groups of states

- **A — Stop procedures**: A1 stop in the initial state, A2 stop requested at end of cycle, A6 setting to the initial state…
- **F — Operating procedures**: F1 normal production, F2–F3 preparation and closing runs, F4–F6 check and test runs.
- **D — Failure procedures**: D1 emergency stop, D2 diagnosis, D3 production despite the failure.

Each machine uses only some of them. The GEMMA is filled in by ticking the ones used and the conditions to go from one to another.

## From GEMMA to grafcet

The result is a **mode-control grafcet**: one step per GEMMA state, each with the **forcing order** it imposes on the production grafcet (see [Partial grafcets and forcing](grafcets-parciales)). For example:

- D1 (emergency): `F/G1{}` — production stopped.
- A6 (setting to the initial state): `F/G1{INIT}`.
- F1 (normal production): no forcing, production evolves.

## The assistant

1. Enclose the production grafcet in a partial grafcet (G1).
2. **GEMMA** button on the toolbar: tick the states you use, add the transitions between them with their condition and write each state's forcing order. “Load the typical example” fills in a common case to start with.
3. “Generate the mode-control grafcet” draws it on the GEMMA sheet, in a GC frame.

> **Watch out:** the GEMMA does not replace hard-wired safety. The emergency stop button cuts the power by hardware; the GEMMA decides how the program behaves before and after.

```ejemplo gemma-linea
Start, stop at end of cycle, emergency with failure and reset to the initial position.
```
