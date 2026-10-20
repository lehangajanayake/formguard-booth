# FormGuard sensor case

Case for a Seeed XIAO nRF52840 Sense with a 400 mAh LiPo (38 x 25 x 6 mm).
A JST PH socket is soldered at 45° to the battery pads on the board's underside, facing the GND pin. With the plug and wires connected, its lowest point is 11 mm below the board (measured). It hangs into a 13 mm deep pit in the base under the board, which leaves 2 mm spare.
The battery lies on the floor beside the board, at the end away from the USB-C. It doesn't run under the board.
The case is two parts, a base and a lid, held together with 4 standard M3 x 10 screws (no inserts or nuts). It's designed for FDM printing.

**Outer size: 67.7 x 37 x 22.3 mm** (plus the screw heads on top)

| Part | File | Height | Prints |
| --- | --- | --- | --- |
| Base: the body, with the battery tray, the connector pit, four fins the board rests on and the USB-C slot. The screws thread into its corners | `output/formguard_base.stl` / `.step` | 19.9 mm | open side up |
| Lid: the board clips to it; ribs hold the board and battery down; LED window and reset hole | `output/formguard_lid.stl` / `.step` | 2.4 mm plate + cradle, latch and ribs (13.6 mm overall) | **upside down** (flat top on the bed) |

`output/formguard_case.FCStd` is the FreeCAD file with the parts and all the reference models in place: board, socket, mated plug, battery and screws.
The print package for the print service is in `print-package/` (and zipped as `formguard_case_print_package.zip`).
For a Prusa printer, `print-package/formguard_case_MK4S_PETG.3mf` is a PrusaSlicer project with both parts on one plate (lid flipped), set to MK4S 0.4, 0.20mm STRUCTURAL, Prusament PETG, 3 perimeters, 20% infill.

## Hardware

| Qty | Item | Notes |
| --- | --- | --- |
| 4 | M3 x 10 machine screw | Button head (ISO 7380) is best: it stands 1.65 mm proud. A socket cap (DIN 912) or pan head (DIN 7985) also works but stands 2.4–3 mm proud. M3 x 12 also fits |
| 1 | 1 mm foam tape, about 38 x 25 | Under the battery. The lid ribs press the cell into it so it can't rattle |

The screws go down through the lid and cut their own thread into 2.5 mm pilot holes in the corners of the base:
- **M3 x 10:** about 7.6 mm of thread in the base.
- **M3 x 12:** also fits, with about 9.6 mm.

The heads sit on top of the lid. An M3 head is 5.7 mm across, and a recess that wide would break through the lid's rounded corners.

Drive the screws in slowly the first time, and stop as soon as they're snug. Printed threads strip if over-tightened.

## Print settings (for the print service)

- PETG preferred because of the lid's snap latch (PLA works, but the latch may crack after many clicks). 0.2 mm layers, at least 3 perimeters, 20% infill or more. The base needs solid walls around its pilot holes so the screws have plastic to bite into.
- No supports are needed if each part is oriented as shown in the table above.
- Fit clearance is 0.35 mm per side. If the service prints tight, raise `FIT` in the script and re-export.
- The walls around every screw hole are at least 1.6 mm thick.

### Checked in PrusaSlicer 2.9.6 (MK4S profile)

| Part | Time | PETG |
| --- | --- | --- |
| Base | 1 h 2 min | 19.5 g |
| Lid | 23 min | 8.3 g |
| Both on one plate | 1 h 24 min | 27.8 g |

- Both STLs are manifold single bodies. They slice with no warnings and no supports.
- In the lid G-code, the latch arm prints on every layer up to its tip, and the tooth prints as a short overhang.
- Each cradle leg gets a full loop on every layer, and the cradle bar prints as a bridge between the legs.
- In the base G-code, each board fin prints on every layer from the floor up to its top at 15.0 mm.

## Assembly

1. Put the battery in the tray in the base, on foam tape. Point its lead end toward the USB-C end so the leads drop into the connector pit.
2. Plug the battery into the JST socket on the board. Tuck the spare lead into the pit beside the plug.
3. Clip the board into the lid. Hold the lid upside down and hook the board's USB-C into the U-shaped cradle at one end, components facing the lid. Then swing the far end of the board up until the latch clicks over its edge.
4. Lower the lid, with the board clipped in, straight down onto the base. The socket and plug go into the pit, the cradle into the USB-C slot in the end wall, and the board's corners onto the four fins.
5. Fit the 4 screws through the lid into the base. The lid ribs press the board onto the fins, so it can't shift in any direction, and the two battery ribs press the cell into its foam.

**To take the board out:** remove the 4 screws and lift off the lid; the board comes with it. Unplug the battery. Push the latch arm back with a fingernail (about 0.5 mm), swing the far end of the board down about 10°, and slide the board away from the cradle (about 1.5 mm) to free the USB-C. To put it back, hook the USB-C in and click the far end up again. No tape or tools needed.

## Features

- **USB-C:** a slot in the end wall, with the receptacle face 0.2 mm inside the outer surface so a normal cable seats fully. You can charge and flash without opening the case.
- **LEDs:** a 3.5 x 2.3 mm window above the CHG (red) and USR (RGB) LEDs.
- **Reset:** a 1.8 mm hole above the reset button, for a paperclip (for example, to double-tap into the bootloader).
- **Board clip (on the lid):** the USB-C is the hinge. A U-shaped cradle on the lid wraps under the part of the USB-C shell that sticks out past the board, and its bar also stops the board edge. At the far end, a flexible latch arm catches 0.5 mm under the board edge. The latch is off-centre so it stays clear of the chip antenna at that edge, and it flexes about 2 %, rooted in a recess in the lid. The script checks that the board swings and slides out with the latch pushed back.
- **Board in the closed case:** the lid locates the board. Its corners sit on four 1.1 x 1 mm fins in the base, and the lid ribs clamp it down onto them. The fins sit under the outer 1 mm of the long edges, 0.2–1.3 mm and 19.7–20.8 mm from the USB end. That keeps them clear of the socket glue (1.5–13 mm), the socket and the plug.
- **Battery:** it lies on 1 mm foam on the floor. Two ribs on the lid press it down 0.3 mm into the foam when the lid is screwed on.

## Changing the design

Every dimension is a named parameter at the top of `formguard_case.py`. To rebuild and re-export:

```bash
/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd -c "exec(open('formguard_case.py').read())"
```

You can also run the same `exec(...)` line in the FreeCAD Python console to see the parts with the reference models in place.
Each build checks the reference models against the case parts and prints any overlap. The only expected overlap is the four screws threading into the base.

The renders in `images/` (used in the main README) come from `render_images.py`. It needs the FreeCAD GUI, so run it in the FreeCAD Python console:

```python
p = "/path/to/3d-case/render_images.py"; exec(open(p).read(), {"__file__": p})
```

Check the battery with calipers before ordering. The battery tray is 40 x 27 mm, which leaves 1 mm all round a 38 x 25 mm cell. If the cell is thicker or thinner than 6 mm, change `BAT_H` so the lid ribs still meet it.
The connector room comes from `CONN_DROP` (11 mm, the measured lowest point with the plug and wires connected) and `CONN_CLEAR` (2 mm spare). Change them if your socket sits differently.
The reference models and source dimensions are in `reference/` (see `reference/README.md`).
