# Exercises

An **exercise** comes with a statement and what the teacher provides already done (the plant, the variables table, the wiring diagram…). You draw the grafcet, and the editor tells you whether it is right.

> **Education mode:** the classroom tools (Open > Exercises and Mark submissions, Export > Exercise for students and Practice guide) appear when you turn on **Options > Education mode**. Without it the menus stay simpler; an exercise you are given opens with Open > Open file and works the same.

## For students

1. Open the exercise: Open > Exercises, or with Open > Open file the file your teacher gave you (a .json or the PDF practice sheet: the exercise is inside). There are exercises from level 1 to 5; the ones marked **Guided** walk you through step by step, telling you what to click at each moment.
2. Read the statement in the **Exercise** panel (on the right; the toolbar button opens and closes it).
3. Draw the grafcet. You can simulate and verify it as usual.
4. Click **Check** as many times as you like. Each check shows in green or red, with what fails. If you get stuck, open a **hint** (if the teacher offers them): they appear one at a time and are counted; if there is a grade, each one can subtract.
5. To hand it in, Export > **Exercise report**: the PDF carries your project inside (it opens in the editor) and has sections for the theory, the improvements and the problems found.

> **Watch out:** what the teacher gives locked (for example, the variables table) cannot be changed: use those names in the grafcet. If you type one that is not there, the check points it out as a possible typo.

## What is checked

- That there is a grafcet (an initial step and some transition).
- That it complies with the standard: Verify without errors.
- With the variables table given, that you only use its variables.
- In exercises with a plant, that the machine performs the required sequence with the teacher's test scenario.
- With each test scenario, that the machine responds like the teacher's: outputs turn on and off at the same moments (within a time margin) and the same parts arrive. If something fails, **See it in the simulation** plays that scenario so you can see where.

## For teachers

```tutorial preparar-ejercicio
```

1. Solve the exercise in the editor: that is your solution and it is not handed out.
2. Prepare the test scenarios: record them in the simulation (for example, press Marcha and wait for a cycle) or click **Draw scenario** and drag along each input's row to decide when it is pressed; below you see live what your grafcet does.
3. Export > **Exercise for students**: write the statement, choose what is given already done (and whether it is locked) and what is checked. Click **Test**: with your solution, everything must be green.
4. **Save and download for students** creates the file to hand out, without your grafcet.
5. **Practice sheet (PDF)** creates a sheet like the usual ones, to print or hand out: a header for the name, the statement, what is provided (table, plant, wiring diagram), the assessment criteria in words and the test scenarios. The exercise file travels inside the PDF as an attachment: opening the PDF in the editor loads the exercise. Anyone can assess the exercise from the paper without knowing the program, and the **fingerprint** in the footer identifies the file inside.
6. **Requirements, hints and grade** (in the same dialog): tick what the grafcet must use (a timer, a counter, an edge, an OR or AND divergence, a conditional or stored action, a maximum number of steps). Write hints, one per line, from the most general to the most specific, or untick **Offer hints** if you prefer to give them in person. The **grade** is optional and only a guide: the share of criteria met, and each hint seen can subtract.

## Mark submissions

With your exercise open (the one with your solution), Open > **Mark submissions** and add the class PDF reports (they carry the project inside) or their .json files.

- Each submission is marked again with **your** checks, not with the ones in the file.
- The table shows each criterion, the hints seen, the grade (if you ask for it) and the process data (if you ask for them).
- It warns about **very similar work** (same drawing and same logic): a warning, not proof.
- **Download CSV** takes it to a spreadsheet. Nothing leaves your browser.

**Process data** (in the exercise dialog, off by default): only totals are recorded (times they check, active minutes, simulations and hints seen). Students are told when they open the exercise and the data appear on a page of their report.

## Practice guide

Several practices in a single PDF, like a classic practice guide: Export > **Practice guide**.

- Header and footer details (subject, course, programme, school, teacher) and the **general rules**: submission, assessment and what each practice must include.
- The practices: the open project and the ones you add from files (exercise .json files or PDF sheets). Order them with the arrows.
- **Guided**: the open project can be shown with its solution (grafcet, wiring, ladder and table), like the practice done in class as an example; the solved project is inside too.
- When the guide is opened in the editor, you choose the practice.

In Open > Exercises there is an example guide with five PLC practices: open practice 1 solved and use **Use the example guide**.

> **Watch out:** the checks travel sealed in the file, but it is not a security system: the checker is based on behaviour, not on copying your grafcet.

```ejemplo cilindros
A good starting point for an exercise with a plant.
```
