# Flag

A one- or two-word status label: `fault` names what's wrong in red with a filled dot; `clear` says "In range" in neutral with a hollow dot.

- **Consumer provides:** `tone` and the words as children. Name the problem, not a severity: "Knees caving", "Back rounding", "Partial rep", "Form slipping".
- **Clear** is neutral on purpose: good form is the expected state, so it gets no colour. The hollow dot versus filled dot means the two read apart without colour.
- Text is set in the `label` style (uppercase, 12px). The fault colour is `signal-ink` (at least 4.8:1 in both themes).
- **Don't** use a Flag for anything that isn't form status, or invent other tones like green, amber or "warning".
