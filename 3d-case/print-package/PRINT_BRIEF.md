# Print request: FormGuard sensor case (3 parts)

A small electronics enclosure, three parts that stack together. **Quantity: 1 set** (one of each part).

## Files

| Part | Print file | Size (mm) | Orientation on the bed |
| --- | --- | --- | --- |
| Base | `formguard_base.stl` | 50 x 37 x 9.0 | As exported: flat bottom down, open side up |
| Deck | `formguard_deck.stl` | 50 x 37 x 6.1 | As exported: flat floor down |
| Lid | `formguard_lid.stl` | 50 x 37 x 6.0 | **Flip it over.** The flat top face goes on the bed, with the two ribs and the small square pad pointing up (see `preview_lid_underside.png`) |

The STL units are millimetres. The `.step` files are the same parts, in case you prefer to slice from STEP.

The `preview_*.png` images show each part. `preview_base_underside.png` shows the screw recesses under the base, and `preview_assembly.png` shows how the parts fit together.

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
| Supports | **None.** None are needed in the orientations above; the screw recesses under the base bridge cleanly |
| Brim | Optional |

## Dimensions that must stay accurate

Please don't scale the parts, and avoid horizontal-expansion or hole compensation beyond your usual profile.

- **Deck:** 8 holes, 1.7 mm diameter. M2 screws thread directly into these, so **please don't drill them out.**
- **Deck:** a 21.65 x 18.48 mm pocket that the circuit board drops into.
- **Base:** 4 recesses underneath, 4.2 mm diameter, for screw heads.
- **Lid:** 4 holes, 2.4 mm diameter, each with a 4.4 mm counterbore for the screw heads.
- **Lid:** a 1.8 mm hole and a 3.7 x 2.3 mm window. If these close up, please clear them; don't fill them in.
- **Base:** the wall between each corner recess and the inner pocket is about 0.85 mm. Please make sure your slicer doesn't drop it.

## Please don't

- Don't add or remove anything from the model.
- Don't print the parts as a single merged body.

## Questions

Contact me before printing if anything looks wrong, or if your printer can't hold about ±0.2 mm on small holes.
