# Reference dimensions for the FormGuard case

Source files for the case design, kept here so the numbers can be verified by hand.
Measured values come from the official STEP model, opened in FreeCAD 1.1.3.

## Seeed XIAO nRF52840 (Sense), `xiao-nrf52840/`

| File | What it is | Source |
| --- | --- | --- |
| `XIAO-nRF52840.step` | Official 3D model | https://files.seeedstudio.com/wiki/XIAO-BLE/seeed-studio-xiao-nrf52840-3d-model.zip |
| `*.png` (CustomizedView) | Renders that ship with the 3D model | same zip |
| `top.dxf`, `bottom.dxf` | Board outline and silkscreen, top and bottom | https://files.seeedstudio.com/wiki/XIAO-BLE/XIAO-nRF52840-DXF.zip |
| `bottom-pad-positioning/` | Dimensioned DXF, bottom silkscreen PDF, pad coordinate table (.xls) | https://files.seeedstudio.com/wiki/XIAO-BLE/Bottom-pad-positioning.zip |
| `pinout.png` | Pinout diagram | https://files.seeedstudio.com/wiki/XIAO-BLE/pinout2.png |

Wiki page: https://wiki.seeedstudio.com/XIAO_BLE/

### Measured from the STEP

The STEP is Y-up: +Y is the component side; the PCB top is at Y = 1.0 and its bottom at Y = -0.25.

| Feature | Value |
| --- | --- |
| PCB outline | 20.95 x 17.78 mm (the wiki says 21 x 17.8) |
| PCB thickness | 1.25 mm (STEP PCB spans y = -0.25 to 1.0) |
| Tallest part on top | USB-C shell, 3.2 mm above the PCB top (4.46 mm from the PCB bottom) |
| RF shield can | 10.6 x 12.6 mm, 2.0 mm above the PCB top |
| USB-C overhang | 1.5 mm past the short edge of the PCB |
| USB-C shell | 8.9 wide x 4.2 tall (STEP y 0.01 to 4.21), centred on the board width; it hangs below the PCB top where it overhangs the edge |
| Reset button | top side, beside the USB-C on one side, 0.7 mm tall |
| CHG (red) and USR (RGB) LEDs | top side, beside the USB-C on the side opposite the reset button, about 0.3–3 mm in from the USB end |
| Underside | flat; no parts on the bottom, only pads |

### Bottom pads (from `Bottom Key coordinates .xls`, origin at board centre)

| Pad | x (mm) | y (mm) |
| --- | --- | --- |
| BAT+ | 0.635 | 4.445 |
| GND (BAT-) | 2.54 | 4.445 |
| NFC1 / NFC2 | -8.89 | -3.81 / -5.715 |
| SWD test points | 6.35 / 8.89 | +/-1.27 |
| USB-C (top side) | 4.953 | 0 |

The battery is soldered to the BAT and GND pads on the underside, so its wires leave from the bottom of the board.

## 400 mAh LiPo battery (Core Electronics CE04375), `battery-400mah/`

Product page: https://core-electronics.com.au/polymer-lithium-ion-battery-400mah-38456.html

| Item | Value | Where it comes from |
| --- | --- | --- |
| Cell size | 38 x 25 x 6 mm | Product page only (no cell drawing is published) |
| Weight | 11 g | Product page |
| Voltage / capacity | 3.7 V nominal / 400 mAh | Product page |
| Connector | JST-PH 2-pin, plugs into the socket on the board | Product page |
| Protection board (PCM) | 17 x 3.8 x 0.6 mm, DW01 + 8205 | `PCM-datasheet.pdf` |
| Safety data | | `MSDS.pdf` |
| 3D model | `battery_400mah.step`, built by `make_reference_models.py` | No cell drawing or CAD model is published, so it's modelled from the dimensions above |

Pouch cells are not precise, and they swell with age. The case allows about 1 mm of clearance on each side of the cell. Measure the actual cell with calipers before printing.

## JST PH connector on the board, `jst-ph/`

| File | What it is | Source |
| --- | --- | --- |
| `JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.step` | B2B-PH-K-S socket (2-pin, top entry): 5.9 x 4.55 x 6.0 mm housing, 3.4 mm pins | KiCad 3D library, https://gitlab.com/kicad/libraries/kicad-packages3D/-/raw/master/Connector_JST.3dshapes/JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical.step (CC-BY-SA 4.0) |
| `PHR-2_mated_envelope.step` | Space the mated PHR-2 plug and its lead exit take, built by `make_reference_models.py` | JST serves its own PHR-2 model only through a request form, so this is an envelope. It uses the socket's cross section and extends 3 mm below the socket, with lead stubs |

As soldered, the socket sits at 45° on the BAT/GND pads, facing the GND pin. With the plug and wires connected, its lowest point is 11 mm below the PCB (measured by the user).
In the model, with the pins on the pads, the KiCad socket hangs 7.9 mm and the plug envelope's leads reach 11.75 mm, close to the measurement.

## Screws, `screws/`

| File | What it is | Source |
| --- | --- | --- |
| `ISO7380-1_M3x15.step` | M3 x 15 hexagon socket button head screw, built by `make_reference_models.py` | ISO 7380-1 dimensions: head 5.7 dia x 1.65, 2.0 hex socket. No free official CAD download was found |

`make_reference_models.py` rebuilds the three modelled files. Run it in FreeCAD the same way as `formguard_case.py`.
