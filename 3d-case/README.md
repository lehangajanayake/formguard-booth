# FormGuard sensor case

Case for a Seeed XIAO nRF52840 Sense with a soldered 400 mAh LiPo (38 x 25 x 6 mm).
It has three stacked parts, is held together with 4 standard M3 x 15 screws (no inserts or nuts), and is designed for FDM printing.

**Outer size: 50 x 37 x 17.5 mm** (plus the screw heads on top)

| Part | File | Height | Prints |
| --- | --- | --- | --- |
| Base: battery tray; the screws thread into its corners | `output/formguard_base.stl` / `.step` | 9.0 mm | open side up |
| Deck: holds the board in a fitted pocket and keeps the battery down | `output/formguard_deck.stl` / `.step` | 6.1 mm | flat floor on the bed |
| Lid: clamps the board, has the LED window and reset hole | `output/formguard_lid.stl` / `.step` | 2.4 mm plate + ribs and pad | **upside down** (flat top on the bed) |

`output/formguard_case.FCStd` is the FreeCAD file with the parts and the reference board and battery in place.
The print package for the print service is in `print-package/` (and zipped as `formguard_case_print_package.zip`).

## Hardware

| Qty | Item | Notes |
| --- | --- | --- |
| 4 | M3 x 15 machine screw | Button head (ISO 7380) is best: it stands 1.65 mm proud. A socket cap (DIN 912) or pan head (DIN 7985) also works but stands 2.4–3 mm proud. M3 x 16 also fits |
| 1 | 1 mm foam tape, about 38 x 25 | Under the battery so it can't rattle |
| 1 | 1 mm double-sided foam tape, about 9.6 x 11.6 | On the lid pad; holds the board's RF shield (e.g. 3M 4026 or generic foam mounting tape) |

The screws go down through the lid and deck and cut their own thread into 2.5 mm pilot holes in the corners of the base:
- **M3 x 15:** about 6.5 mm of thread in the base.
- **M3 x 16:** also fits, with about 7.5 mm.

The heads sit on top of the lid. An M3 head is 5.7 mm across, and a recess that wide would break through the lid's rounded corners.

Drive the screws in slowly the first time, and stop as soon as they're snug. Printed threads strip if over-tightened.

## Print settings (for the print service)

- PLA or PETG, 0.2 mm layers, at least 3 perimeters, 20% infill or more. The base needs solid walls around its pilot holes so the screws have plastic to bite into.
- No supports are needed if each part is oriented as shown in the table above.
- Fit clearance is 0.35 mm per side. If the service prints tight, raise `FIT` in the script and re-export.
- The walls around every screw hole are at least 1.6 mm thick.

## Assembly

1. Put the battery in the base, with foam tape underneath. Point the battery's lead end toward the USB-C end of the case so the wires are short.
2. Put the deck on the base. Feed the battery leads up through the rectangular opening in the deck floor.
3. Solder the leads to the BAT+ and GND pads on the underside of the XIAO. The board's underside is open to the opening, so the joints have room.
4. Drop the board, components up, into the deck pocket with the USB-C toward the slot in the end wall. It rests on a 1 mm ledge around its edges.
5. Stick the double-sided tape on the rectangular pad on the underside of the lid, then peel the backing.
6. Put the lid on and fit the 4 screws through the lid and deck into the base. The tape bonds to the board's metal RF shield and is squeezed 0.2 mm, while the lid ribs hold the pin rows on the ledge. The board (and the IMU) can't shift in any direction.

**To take the board out:** remove the 4 screws and lift off the lid. The board comes up with it, stuck to the tape; peel it off the shield. The battery stays attached by its leads. Use fresh tape when you reassemble.

## Features

- **USB-C:** a slot in the end wall, with the receptacle face 0.2 mm inside the outer surface so a normal cable seats fully. You can charge and flash without opening the case.
- **LEDs:** a 3.7 x 2.3 mm window above the CHG (red) and USR (RGB) LEDs.
- **Reset:** a 1.8 mm hole above the reset button, for a paperclip (for example, to double-tap into the bootloader).
- **Board mount:** the PCB is located on all four sides by the pocket, clamped between the deck ledge and the lid ribs, and taped to a pad on the lid over the RF shield. If your tape isn't 1 mm thick, set `TAPE_T` in the script and re-export.

## Changing the design

Every dimension is a named parameter at the top of `formguard_case.py`. To rebuild and re-export:

```bash
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c "exec(open('formguard_case.py').read())"
```

You can also run the same `exec(...)` line in the FreeCAD Python console to see the parts with the reference board in place.

Check the battery with calipers before ordering. The cavity is 40 x 27 x 7 mm, which leaves 1 mm all round for a 38 x 25 x 6 cell plus foam.
The source dimensions and datasheets are in `reference/` (see `reference/README.md`).
