# Your first grafcet

Let us draw a **start-stop**: pressing Marcha (start) switches a motor on; pressing Paro (stop) switches it off. If you prefer the editor itself to guide you, do the tutorial:

```tutorial primer-grafcet
```

## Step by step

1. **Initial step.** On the toolbar, “Initial step” (or right-click the canvas > “Initial step here”). It is step 0: the rest situation.
2. **Transition.** Select the step and click the **+** that appears below it: it adds a transition, already linked.
3. **Receptivity.** Double-click the transition and type `Marcha`. It is the condition to leave the rest situation.
4. **Step 1.** Select the transition and click its **+**.
5. **Action.** Double-click step 1 > “Add action” and type `Motor` (or the **+** to the right of the step).
6. **Back to rest.** Add a transition below step 1 with the receptivity `Paro`. Right-click it > “Loop to step” and click step 0.
7. **Verify.** The button turns green (✓) if everything complies with the standard.
8. **Simulate.** Click Simulate, switch on Marcha (click or key 1) and watch step 1 become active and Motor turn on.

> **Watch out:** the variables (Marcha, Paro, Motor) appear in the variables table by themselves as you type them. There you give them their PLC address; see [Variables and addresses](variables).

## What if the stop button is normally closed?

For safety, stop buttons are usually **NC**: at rest they give 1 and when pressed, 0 (so a broken wire also stops the machine). Then the receptivity is `!Paro` (“Paro not active”), drawn with a bar above. The example does it that way:

```ejemplo marcha-paro
```
