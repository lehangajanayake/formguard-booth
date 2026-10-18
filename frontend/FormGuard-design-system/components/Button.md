# Button

Use `primary` for the one thing the screen is for, at most once per screen; `secondary` for other main actions; `quiet` for everything else.

- **Consumer provides:** the label as children, `onClick`, and optionally `variant`, `size`, `fullWidth`, `disabled` and any native button attribute.
- **Label:** verb first, sentence case, no full stop: "Start set", "Become a test lifter", "Recalibrate".
- **Size:** 48px tall by default, for chalky hands between sets. `size="sm"` (36px) is for dense desktop screens only.
- **Primary** is Plate Red with Chalk text (4.8:1 in both themes). **Secondary** is `ink` with `ground` text. **Quiet** has a `line-strong` border.
- **Focus:** 2px `ink` ring, offset 2px. **Disabled:** 40% opacity.
- **Don't** put two primary buttons on one screen, use the primary button for a destructive action, or add icons for decoration.
