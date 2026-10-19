# Print request: FormGuard sensor case (3 parts)

A small electronics enclosure, three parts that stack together. **Quantity: 1 set** (one of each part).

## Files

| Part | Print file | Size (mm) | Orientation on the bed |
| --- | --- | --- | --- |
| Base | `formguard_base.stl` | 50 x 37 x 9.0 | As exported: flat bottom down, open side up |
| Deck | `formguard_deck.stl` | 50 x 37 x 6.1 | As exported: flat floor down |
| Lid | `formguard_lid.stl` | 50 x 37 x 6.0 | **Flip it over.** The flat top face goes on the bed, with the two ribs and the small square pad pointing up (see `preview_lid_underside.png`) |

The STL units are millimetres. The `.step` files are the same parts, in case you prefer to slice from STEP.

The `preview_*.png` images show each part. `preview_assembly.png` shows how they fit together.

## Settings

| Setting | Value |
| --- | --- |
| Process | FDM |
| Material | PLA (PETG also fine) |
| Colour | Any. Black or dark grey preferred |
| Layer height | 0.2 mm (0.16 mm if convenient) |
| Walls / perimeters | **3 minimum.** Screws thread straight into the plastic, so the walls around the holes need to be solid |
| Top / bottom layers | 4 / 4 |
| Infill | 20% or more |
| Supports | **None.** None are needed in the orientations above |
| Brim | Optional |

## Dimensions that must stay accurate

Please don't scale the parts, and avoid horizontal-expansion or hole compensation beyond your usual profile.

- **Base:** 4 corner holes, 2.5 mm diameter. M3 screws thread directly into these, so **please don't drill them out.**
- **Deck and lid:** 4 corner holes each, 3.4 mm diameter, for the screws to pass through.
- **Deck:** a 21.65 x 18.48 mm pocket that the circuit board drops into.
- **Lid:** a 1.8 mm hole and a 3.7 x 2.3 mm window. If these close up, please clear them; don't fill them in.

## Please don't

- Don't add or remove anything from the model.
- Don't print the parts as a single merged body.

## Questions

Contact me before printing if anything looks wrong, or if your printer can't hold about ±0.2 mm on small holes.
