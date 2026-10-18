# RepStrip

Every rep in a set as a bar of the depth reached: clean reps in neutral `line-strong`, fault reps in Plate Red edged with `signal-ink` (so they hold 3:1 on every surface), with their rep number picked out.

- **Consumer provides:** `reps`, an array of `{ depth, fault }`. `depth` runs 0–1 of the lifter's normal full depth; `fault` is the fault's name, or nothing for a clean rep. Optionally a `label` ("Back squat · Set 3") and a `summary` that replaces the computed one.
- The summary is computed as "7/8 in range". A fully clean set reads "Clean set · 8/8 in range": the reward is in words, not colour.
- Fits 3–20 reps. Bars stretch between 12px and 32px wide.
- **Don't** colour clean reps, or show more than one set per strip.
