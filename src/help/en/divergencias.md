# Choosing and doing at once (OR and AND)

A grafcet need not be a straight line. There are two ways of opening paths.

## OR divergence: choosing a path

A step followed by **several transitions**: the path whose receptivity is true is followed. It is drawn with a **single** horizontal line.

- Right-click a transition > “Add OR alternative”.
- The paths are joined with an **OR convergence**: select the last transitions of each path and right-click > “Converge … transitions (OR)”.

> **Watch out:** the receptivities of an OR divergence must be **mutually exclusive**: if two are true at the same time, both paths would become active. Use `a · !b` and `b` instead of `a` and `b`. Verify checks it.

## AND divergence: doing several things at once

A transition followed by **several steps**: clearing it activates all of them and each branch evolves on its own. It is drawn with a **double line**.

- Right-click the transition > “AND divergence (2 branches)” (and “Add AND branch” for more).
- The branches are joined with an **AND convergence**: select the last steps of each branch and right-click > “Converge … steps (AND)”. The transition after it is cleared only when **all** those steps are active: it is a synchronisation.

> **Watch out:** a waiting step (without actions) is usually needed at the end of each branch, so that the fast branch waits for the slow one.

## Do not mix

An OR is closed with an OR, and an AND with an AND. If an AND divergence is closed with an OR convergence, stray active steps remain and the grafcet ends up with more active steps than it should: check it by simulating.

```ejemplo clasificadora
OR divergence: each part goes to its place.
```

```ejemplo mezcladora
AND divergence: two tanks at once.
```

To practise OR and exclusivity step by step:

```tutorial divergencia-o
```
