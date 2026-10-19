# FormGuard sensor case

Case for a Seeed XIAO nRF52840 Sense with a soldered 400 mAh LiPo (38 x 25 x 6 mm).
It has three stacked parts, is held together with 8 standard M2 x 8 screws (no inserts or nuts), and is designed for FDM printing.

**Outer size: 50 x 37 x 17.5 mm**

| Part | File | Height | Prints |
| --- | --- | --- | --- |
| Base: battery tray; 4 screws come up through it | `output/formguard_base.stl` / `.step` | 9.0 mm | open side up |
| Deck: holds the board in a fitted pocket and keeps the battery down. All 8 screws thread into it | `output/formguard_deck.stl` / `.step` | 6.1 mm | flat floor on the bed |
| Lid: clamps the board, has the LED window and reset hole; 4 screws go down through it | `output/formguard_lid.stl` / `.step` | 2.4 mm plate + ribs and pad | **upside down** (flat top on the bed) |

`output/formguard_case.FCStd` is the FreeCAD file with the parts and the reference board and battery in place.
The print package for the print service is in `print-package/` (and zipped as `formguard_case_print_package.zip`).

## Hardware

| Qty | Item | Notes |
| --- | --- | --- |
| 8 | M2 x 8 machine screw | Button head (ISO 7380), socket cap (DIN 912) or pan head (DIN 7985) all fit. Button head sits flush on the lid; a socket cap stands 0.8 mm proud |
| 1 | 1 mm foam tape, about 38 x 25 | Under the battery so it can't rattle |
| 1 | 1 mm double-sided foam tape, about 9.6 x 11.6 | On the lid pad; holds the board's RF shield (e.g. 3M 4026 or generic foam mounting tape) |

The screws cut their own thread into 1.7 mm pilot holes in the deck:
- **Lid screws:** 4 go down through the lid with about 6 mm of thread in the deck.
- **Base screws:** 4 come up from recesses in the underside of the base with 4 mm of thread in the deck.

Drive them in slowly the first time, and stop as soon as they're snug. Printed threads strip if over-tightened, and they last about 10 to 20 re-assemblies.

## Print settings (for the print service)

- PLA or PETG, 0.2 mm layers, at least 3 perimeters, 20% infill or more. The deck needs solid walls around its pilot holes so the screws have plastic to bite into.
- No supports are needed if each part is oriented as shown in the table above. The screw recesses under the base bridge cleanly.
- Fit clearance is 0.35 mm per side. If the service prints tight, raise `FIT` in the script and re-export.
- The thinnest wall is 0.85 mm, between each base screw recess and the battery pocket.

## Assembly

1. Put the battery in the base, with foam tape underneath. Point the battery's lead end toward the USB-C end of the case so the wires are short.
2. Put the deck on the base. Feed the battery leads up through the rectangular opening in the deck floor.
3. Turn the stack over and fit the 4 corner screws up through the base into the deck.
4. Solder the leads to the BAT+ and GND pads on the underside of the XIAO. The board's underside is open to the opening, so the joints have room.
5. Drop the board, components up, into the deck pocket with the USB-C toward the slot in the end wall. It rests on a 1 mm ledge around its edges.
6. Stick the double-sided tape on the rectangular pad on the underside of the lid, then peel the backing.
7. Put the lid on and fit the 4 lid screws. The tape bonds to the board's metal RF shield and is squeezed 0.2 mm, while the lid ribs hold the pin rows on the ledge. The board (and the IMU) can't shift in any direction.

**To take the board out:** remove only the 4 lid screws and lift off the lid. The board comes up with it, stuck to the tape; peel it off the shield. The battery stays in place, held by the deck. Use fresh tape when you reassemble.

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
