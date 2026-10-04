# Verify

The **Verify** button checks the grafcet continuously. Its number shows how many **errors** (red) or **warnings** (amber) there are; with **✓**, all is well. Click a message to go to the element; “More in Help” opens the article that explains the rule.

## What it checks

- **The syntax of the standard**: that there is an initial step, that every step has a number and it is not repeated, that steps and transitions alternate, that every transition has a receptivity.
- **The structure**: steps without input (never activated) or without output (never deactivated), loose transitions, loops that also carry on downwards, steps that cannot be reached from any initial step.
- **OR divergences**: if two paths can be true at the same time, it says so and gives an example of values for which it happens.
- **Macro-steps, partial grafcets and enclosure**: that each macro-step has its expansion (with input and output), that forcing orders point to existing grafcets, that each enclosing step has its enclosed grafcet.
- **Tips**: typical beginner mistakes, such as receptivities that use outputs, timings of another step, receptivities that are always false, steps passed through without stopping or outputs driven both by a continuous and a stored action.

## Errors, warnings and tips

- An **error** means the grafcet is not compliant or cannot work: it must be corrected.
- A **warning** points out something you probably do not want, but it may be intentional.
- A **tip** is educational: it explains the rule and does not prevent anything.

If you are sure a warning is intentional, leave it: it does not prevent simulating or generating the ladder.

> **Watch out:** Verify does not know what your machine has to do. A compliant grafcet can be badly thought out: that is what [simulation](simular) is for.
