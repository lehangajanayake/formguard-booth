# JointMarker

A joint on the body map, in one of three states: `idle` (not yet calibrated), `tracked` (being read: a dot inside a halo ring, like the logo's dot) or `fault` (off right now, in red).

- **Consumer provides:** `state`, a `label` (also used as its accessible name) and an optional `size` in pixels (default 32, never below 24).
- The dot-in-a-halo is the brand motif from the logo: use it only to mean "tracked". A fault marker turns the dot Plate Red and the ring `signal-ink`.
- Only joints with an active fault turn red. Everything else stays neutral, so a glance finds the problem.
- Position markers on the body map with the consumer's own layout; the marker centres on its joint.
