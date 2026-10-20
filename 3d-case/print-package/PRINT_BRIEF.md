# Print request: FormGuard sensor case (2 parts)

A small electronics enclosure: a base and a lid. **Quantity: 1 set** (one of each part).

## Files

| Part | Print file | Size (mm) | Orientation on the bed |
| --- | --- | --- | --- |
| Base | `formguard_base.stl` | 67.7 x 37 x 19.9 | As exported: flat bottom down, open side up |
| Lid | `formguard_lid.stl` | 67.7 x 37 x 13.6 | **Flip it over.** The flat top face goes on the bed, with the ribs, the U-shaped cradle and the latch arm pointing up (see `preview_lid_underside.png`) |

The STL units are millimetres. The `.step` files are the same parts, in case you prefer to slice from STEP.

**Prusa printers:** `formguard_case_MK4S_PETG.3mf` is a ready PrusaSlicer project with both parts on one plate, the lid already flipped. It's set for an Original Prusa MK4S (0.4 mm nozzle), 0.20mm STRUCTURAL, Prusament PETG, 3 perimeters and 20% infill. For another Prusa, open it and pick your printer; the parts fit any Prusa bed, including the MINI.
Sliced in PrusaSlicer 2.9.6: about **1 h 24 min and 28 g of PETG** for the set, with no supports and no warnings.

The `preview_*.png` images show each part. `preview_assembly.png` shows how they fit together.

## Settings

| Setting | Value |
| --- | --- |
| Process | FDM |
| Material | **PETG preferred** (the lid has a flexible snap latch). PLA works but the latch may crack after many clicks |
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
- **Lid:** 4 corner holes, 3.4 mm diameter, for the screws to pass through.
- **Base:** four small fins (1.1 x 1 mm) inside, which the circuit board rests on. Their tops must stay level with each other.
- **Lid:** a 1.8 mm hole and a 3.5 x 2.3 mm window. If these close up, please clear them; don't fill them in.
- **Lid latch:** the 6 x 1.2 mm arm at one end must flex. Please print it solid (it is only 3 lines thick) and don't add supports or a brim around it.
- **Lid cradle:** the small U-shaped bridge at the other end prints as a 9 mm bridge. No supports needed.

## Please don't

- Don't add or remove anything from the model.
- Don't print the parts as a single merged body.

## Questions

Contact me before printing if anything looks wrong, or if your printer can't hold about ±0.2 mm on small holes.
