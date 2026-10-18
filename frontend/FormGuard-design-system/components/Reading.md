# Reading

One measured value with its joint label, set in IBM Plex Mono like a gauge reading.

- **Consumer provides:** `value` (the number only), `unit`, `label` (the joint or measure), an optional `note` comparing it to the lifter's normal, and `tone`.
- Set `tone="fault"` only when the value is outside the lifter's own normal range; the value and note turn `signal-ink`. Otherwise it stays neutral.
- **Notes compare to the lifter, not a textbook:** "Past your normal by 7°", "Your usual depth".
- Show two to four Readings in a row at most. If there are more, the screen is a report, not a glance.
