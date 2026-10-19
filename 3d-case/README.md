# FormGuard sensor case

Case for a Seeed XIAO nRF52840 Sense with a soldered 400 mAh LiPo (38 x 25 x 6 mm).
It has three stacked parts, uses standard M2 screws, and is designed for FDM printing.

**Outer size: 50 x 37 x 17.5 mm**

| Part | File | Height | Prints |
| --- | --- | --- | --- |
| Base: battery tray with 4 heat-set inserts | `output/formguard_base.stl` / `.step` | 9.0 mm | open side up |
| Deck: holds the board in a fitted pocket and keeps the battery down | `output/formguard_deck.stl` / `.step` | 6.1 mm | flat floor on the bed |
| Lid: clamps the board, has the LED window and reset hole | `output/formguard_lid.stl` / `.step` | 2.4 mm plate + 3.6 mm ribs | **upside down** (flat top on the bed) |

`output/formguard_case.FCStd` is the FreeCAD file with the parts and the reference board and battery in place.

## Hardware

| Qty | Item | Notes |
| --- | --- | --- |
| 4 | M2 x 10 button-head screw, ISO 7380 | A pan head (ISO 14583 / DIN 7985) also fits in the 4.2 mm counterbore |
| 4 | M2 brass heat-set insert, about 3.5 OD x 3 long | The hole is 3.2 mm diameter, 4.5 mm deep |
| 1 | 1 mm foam tape, about 38 x 25 | Under or on top of the battery so it can't rattle |
| 1 | 1 mm double-sided foam tape, about 9.6 x 11.6 | On the lid pad; holds the board's RF shield (e.g. 3M 4026 or generic foam mounting tape) |

## Print settings (for the print service)

- PLA or PETG, 0.2 mm layers, at least 3 perimeters (the walls next to the inserts are about 1.4 mm), 20% infill or more.
- No supports are needed if each part is oriented as shown in the table above.
- Fit clearance is 0.35 mm per side. If the service prints tight, raise `FIT` in the script and re-export.
- If you want the service to install the heat-set inserts, ask for M2 inserts in the 4 holes on the top face of the base.

## Assembly

1. Install the 4 inserts into the base, flush with the top face.
2. Put the battery in the base, foam tape underneath. Point the battery's lead end toward the USB-C end of the case so the wires are short.
3. Put the deck on the base. Feed the battery leads up through the rectangular opening in the deck floor.
4. Solder the leads to the BAT+ and GND pads on the underside of the XIAO. The board's underside is open to the opening, so the joints have room.
5. Drop the board, components up, into the deck pocket with the USB-C toward the slot in the end wall. It rests on a 1 mm ledge around its edges.
6. Stick the double-sided tape on the rectangular pad on the underside of the lid, then peel the backing.
7. Put the lid on and fit the 4 screws. The tape bonds to the board's metal RF shield and is squeezed 0.2 mm, while the lid ribs hold the pin rows on the ledge. The board (and the IMU) can't shift in any direction.

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
